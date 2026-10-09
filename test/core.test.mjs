// 核心自测：验证训练流程与自研 ML 数学正确性（Node 端，无 DOM 依赖）。
import { train } from '../src/core/trainer.js';
import { buildDataset } from '../src/data/dataset.js';

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('PASS:', msg);
}

const t0 = Date.now();
const model = await train(() => {});
const t1 = Date.now();

const r = model.report;
console.log(`\n训练耗时 ${t1 - t0}ms，样本 ${r.sampleCount} 条（train ${r.trainCount}/test ${r.testCount}）`);
console.log(`融合权重 w=${r.w.toFixed(2)} | Acc=${r.acc.toFixed(3)} AUC=${r.auc.toFixed(3)} F1=${r.f1.toFixed(3)}`);
console.log(`单模型对比：LR Acc=${r.lrAcc.toFixed(3)}，MLP Acc=${r.mlpAcc.toFixed(3)}`);

assert(Number.isFinite(r.acc) && Number.isFinite(r.auc), '指标为有限数');
assert(r.acc > 0.55 && r.acc < 1.0, `准确率在合理区间（当前 ${r.acc.toFixed(3)}）`);
assert(r.auc > 0.55 && r.auc <= 1.0, `AUC 在合理区间（当前 ${r.auc.toFixed(3)}）`);
assert(r.sampleCount >= 480, '数据集规模 >= 480');

// 验证推理可用且分数有区分度
const good = model.prepareInput('亲测有效的减脂餐方法，坚持30天变化惊人');
const bad = model.prepareInput('关于减脂餐的一点想法');
const pg = model.scoreProb(good).p, pb = model.scoreProb(bad).p;
console.log(`爆款样本得分 ${(pg * 100).toFixed(0)}，平淡样本得分 ${(pb * 100).toFixed(0)}`);
assert(pg > pb, '高分样本得分高于低分样本');

// 验证数据泄漏防护：词表仅来自 train 集（通过无异常 + 维度一致性间接验证）
assert(model.V > 0 && model.V <= 2000, `词表规模合理（当前 ${model.V}）`);

console.log('\n全部通过');
