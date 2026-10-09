// trainer.js —— 训练编排：数据加载 → 特征工程 → 切分 → LR + MLP → 融合 → 指标。
import { buildDataset } from '../data/dataset.js';
import { preprocess } from './preprocess.js';
import { charNgrams } from './ngram.js';
import { buildVocabulary, docToTermIds } from './vocabulary.js';
import { buildIdf, vectorize } from './tfidf.js';
import { extractNumeric, computeStats, zscore } from './numeric-features.js';
import { stratifiedSplit } from './split.js';
import { trainLogisticRegression } from './logistic-regression.js';
import { trainMLP } from './mlp.js';
import { accuracy, precisionRecallF1, auc } from './metrics.js';

const D = 14;

export async function train(onProgress) {
  const raw = buildDataset(42);
  const docs = raw.map(s => {
    const t = preprocess(s.text);
    return { text: t, label: s.label, category: s.category, grams: charNgrams(t), denseRaw: extractNumeric(t) };
  });

  const { train: tr, val, test } = stratifiedSplit(docs, { seed: 42 });
  const vocab = buildVocabulary(tr.map(d => d.grams), { maxTerms: 2000, minDf: 2 });
  const V = vocab.size;
  const idf = buildIdf(vocab, tr.length);
  const numericStats = computeStats(tr.map(d => d.denseRaw));

  const toSample = d => ({
    sparse: vectorize(docToTermIds(d.grams, vocab.termToId), idf),
    dense: zscore(d.denseRaw, numericStats),
    label: d.label
  });
  const trS = tr.map(toSample), valS = val.map(toSample), teS = test.map(toSample);

  const tick = async (p) => { await new Promise(r => setTimeout(r, 0)); };

  onProgress && onProgress({ phase: 'lr', text: '训练逻辑回归（300 轮）', pct: 0.2 });
  await tick();
  const lr = trainLogisticRegression(trS, V, D);

  onProgress && onProgress({ phase: 'mlp', text: '训练神经网络', pct: 0.3 });
  await tick();
  const mlp = await trainMLP(trS, V, D, {
    valSamples: valS,
    onProgress: (ep, total) => {
      onProgress && onProgress({ phase: 'mlp', text: `神经网络训练 epoch ${ep}/${total}`, pct: 0.3 + 0.55 * (ep / total) });
    }
  });

  onProgress && onProgress({ phase: 'ens', text: '融合双模型并评估', pct: 0.9 });
  await tick();

  // 融合权重在验证集上网格搜索（0~1，步长 0.05）
  let bestW = 0.5, bestAuc = -1;
  for (let w = 0; w <= 1.0001; w += 0.05) {
    const scores = valS.map(s => w * lr.predict(s) + (1 - w) * mlp.predict(s));
    const a = auc(valS.map(s => s.label), scores);
    if (a > bestAuc) { bestAuc = a; bestW = w; }
  }

  const ensembleScore = teS.map(s => bestW * lr.predict(s) + (1 - bestW) * mlp.predict(s));
  const teLabels = teS.map(s => s.label);
  const report = {
    acc: accuracy(teLabels, ensembleScore),
    ...precisionRecallF1(teLabels, ensembleScore),
    auc: auc(teLabels, ensembleScore),
    sampleCount: raw.length,
    trainCount: tr.length,
    testCount: test.length,
    w: bestW,
    lrAcc: accuracy(teLabels, teS.map(s => lr.predict(s))),
    mlpAcc: accuracy(teLabels, teS.map(s => mlp.predict(s)))
  };

  // 构建"按赛道分数分布"用于同赛道分位展示
  const scoreProb = input => bestW * lr.predict(input) + (1 - bestW) * mlp.predict(input);
  const catScores = {}, allScores = [];
  for (const d of docs) {
    const inp = { sparse: vectorize(docToTermIds(d.grams, vocab.termToId), idf), dense: zscore(d.denseRaw, numericStats) };
    const p = scoreProb(inp);
    allScores.push(p);
    (catScores[d.category] = catScores[d.category] || []).push(p);
  }
  for (const c in catScores) catScores[c].sort((a, b) => a - b);
  allScores.sort((a, b) => a - b);

  onProgress && onProgress({ phase: 'done', text: '模型就绪', pct: 1 });

  return {
    vocab, idf, numericStats, lr, mlp, report, V, D, catScores, allScores, bestW,
    prepareInput(text) {
      const t = preprocess(text);
      const grams = charNgrams(t);
      return {
        text: t,
        grams,
        sparse: vectorize(docToTermIds(grams, vocab.termToId), idf),
        dense: zscore(extractNumeric(t), numericStats)
      };
    },
    scoreProb(input) {
      return { pl: lr.predict(input), pm: mlp.predict(input), p: scoreProb(input) };
    }
  };
}
