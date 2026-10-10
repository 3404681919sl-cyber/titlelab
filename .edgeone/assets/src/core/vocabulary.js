// vocabulary.js —— 在训练集上构建词表（df>=2，按 df 降序取 top K），返回 term 映射与文档频率。
// 词表仅在 train 集构建，防止数据泄漏。
export function buildVocabulary(docs, { maxTerms = 2000, minDf = 2 } = {}) {
  const df = new Map(); // term -> document frequency
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const terms = [...df.entries()]
    .filter(([, d]) => d >= minDf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms);

  const termToId = new Map();
  const idToTerm = new Array(terms.length);
  terms.forEach(([t], i) => { termToId.set(t, i); idToTerm[i] = t; });
  return { termToId, idToTerm, df: new Map(terms), size: terms.length };
}

// 将文档转为稀疏词表索引数组（去重）
export function docToTermIds(doc, termToId) {
  const ids = [];
  const seen = new Set();
  for (const t of doc) {
    const id = termToId.get(t);
    if (id !== undefined && !seen.has(id)) { seen.add(id); ids.push(id); }
  }
  return ids;
}
