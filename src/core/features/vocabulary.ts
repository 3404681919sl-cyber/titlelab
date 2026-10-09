/** 词表构建 —— 仅在 train 集上构建（防数据泄漏），df≥2，按 df 降序取 top 2000 */

export interface Vocabulary {
  /** n-gram → 特征下标 */
  index: Map<string, number>;
  /** 各特征的文档频率（按词表顺序） */
  df: Int32Array;
  /** 词表大小 */
  size: number;
}

export const MAX_VOCAB = 2000;
export const MIN_DF = 2;

/**
 * 从 train 集文档构建词表。
 * @param docs 每个文档的 n-gram 列表（仅 train 集）
 */
export function buildVocabulary(docs: string[][], maxVocab = MAX_VOCAB, minDf = MIN_DF): Vocabulary {
  const dfMap = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const g of seen) {
      dfMap.set(g, (dfMap.get(g) ?? 0) + 1);
    }
  }
  const kept = [...dfMap.entries()]
    .filter(([, df]) => df >= minDf)
    .sort((a, b) => (b[1] - a[1]) !== 0 ? b[1] - a[1] : (a[0] < b[0] ? -1 : 1))
    .slice(0, maxVocab);

  const index = new Map<string, number>();
  const df = new Int32Array(kept.length);
  kept.forEach(([gram, count], i) => {
    index.set(gram, i);
    df[i] = count;
  });
  return { index, df, size: kept.length };
}
