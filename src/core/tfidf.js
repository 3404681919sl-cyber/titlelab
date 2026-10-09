// tfidf.js —— sublinear TF + 平滑 IDF + L2 归一化，输出稀疏 [id, value][] 向量。

// 由词表构建 idf 数组（按 term id 顺序）
export function buildIdf(vocab, nDocs) {
  const idf = new Float64Array(vocab.size);
  vocab.df.forEach((d, term) => {
    const id = vocab.termToId.get(term);
    idf[id] = Math.log((1 + nDocs) / (1 + d)) + 1;
  });
  return idf;
}

// 对单个文档做 TF-IDF 向量化（稀疏）
export function vectorize(termIds, idf) {
  // 统计词频
  const tf = new Map();
  for (const id of termIds) tf.set(id, (tf.get(id) || 0) + 1);
  const vec = [];
  let norm = 0;
  for (const [id, f] of tf) {
    const v = (1 + Math.log(f)) * idf[id];
    vec.push([id, v]);
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i][1] /= norm;
  return vec; // [[id, value], ...]
}
