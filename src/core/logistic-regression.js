// logistic-regression.js —— 稀疏输入逻辑回归（全批梯度下降 + L2 正则）。
// 输入特征 = 稀疏 TF-IDF（文本）+ 稠密数值特征（14 维）。
function sigmoid(x) {
  if (x >= 0) { const z = Math.exp(-x); return 1 / (1 + z); }
  const z = Math.exp(x); return z / (1 + z);
}

export function trainLogisticRegression(samples, V, D, { lr = 0.5, epochs = 300, l2 = 1e-4 } = {}) {
  const wSparse = new Float64Array(V);
  const wDense = new Float64Array(D);
  let b = 0;
  const N = samples.length;
  const lossHist = [], accHist = [];

  for (let ep = 0; ep < epochs; ep++) {
    const gSparse = new Float64Array(V);
    const gDense = new Float64Array(D);
    let gb = 0, loss = 0, correct = 0;

    for (const s of samples) {
      let z = b;
      for (const [id, val] of s.sparse) z += wSparse[id] * val;
      for (let j = 0; j < D; j++) z += wDense[j] * s.dense[j];
      const p = sigmoid(z);
      const y = s.label;
      const err = p - y;
      gb += err;
      for (const [id, val] of s.sparse) gSparse[id] += err * val;
      for (let j = 0; j < D; j++) gDense[j] += err * s.dense[j];

      const pc = Math.min(1 - 1e-12, Math.max(1e-12, p));
      loss += -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
      if ((p >= 0.5 ? 1 : 0) === y) correct++;
    }

    for (let i = 0; i < V; i++) wSparse[i] -= lr * (gSparse[i] / N);
    for (let j = 0; j < D; j++) wDense[j] -= lr * (gDense[j] / N);
    b -= lr * (gb / N);

    // 权重衰减（L2）
    const decay = 1 - lr * l2;
    for (let i = 0; i < V; i++) wSparse[i] *= decay;
    for (let j = 0; j < D; j++) wDense[j] *= decay;

    lossHist.push(loss / N);
    accHist.push(correct / N);
  }

  return {
    wSparse, wDense, b, lossHist, accHist,
    predict(sample) {
      let z = b;
      for (const [id, val] of sample.sparse) z += wSparse[id] * val;
      for (let j = 0; j < D; j++) z += wDense[j] * sample.dense[j];
      return sigmoid(z);
    }
  };
}
