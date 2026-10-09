/** TF-IDF 稀疏向量化 —— sublinear TF + 平滑 IDF + L2 归一化（与 sklearn 一致的公式） */
import type { SparseVector } from '../../types/model';
import { buildVocabulary, type Vocabulary } from './vocabulary';

export interface TfidfModel {
  vocab: Vocabulary;
  /** idf = ln((1+N)/(1+df)) + 1 */
  idf: Float64Array;
  /** 训练文档数 */
  docCount: number;
}

/** 在 train 集上拟合 TF-IDF（词表与 idf 均只来自 train 集，防泄漏） */
export function fitTfidf(docs: string[][]): TfidfModel {
  const vocab = buildVocabulary(docs);
  const n = docs.length;
  const idf = new Float64Array(vocab.size);
  for (let i = 0; i < vocab.size; i++) {
    idf[i] = Math.log((1 + n) / (1 + vocab.df[i])) + 1;
  }
  return { vocab, idf, docCount: n };
}

/**
 * 将一篇文档转为稀疏 TF-IDF 向量。
 * tf = 1 + log(count)；OOV 的 n-gram 直接丢弃；
 * 结果按 indices 升序、整体 L2 归一化。
 */
export function transformTfidf(model: TfidfModel, doc: string[]): SparseVector {
  const counts = new Map<number, number>();
  for (const g of doc) {
    const idx = model.vocab.index.get(g);
    if (idx === undefined) continue;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  const indices = new Int32Array(entries.length);
  const values = new Float64Array(entries.length);
  let norm = 0;
  entries.forEach(([idx, count], i) => {
    indices[i] = idx;
    const w = (1 + Math.log(count)) * model.idf[idx];
    values[i] = w;
    norm += w * w;
  });
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < values.length; i++) values[i] /= norm;
  }
  return { indices, values };
}
