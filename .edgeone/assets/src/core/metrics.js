// metrics.js —— 分类指标：accuracy / precision / recall / f1 / AUC（秩法）。
export function accuracy(labels, preds) {
  let c = 0;
  for (let i = 0; i < labels.length; i++) if ((preds[i] >= 0.5 ? 1 : 0) === labels[i]) c++;
  return c / labels.length;
}

export function confusion(labels, preds) {
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < labels.length; i++) {
    const p = preds[i] >= 0.5 ? 1 : 0;
    if (p === 1 && labels[i] === 1) tp++;
    else if (p === 1 && labels[i] === 0) fp++;
    else if (p === 0 && labels[i] === 1) fn++;
  }
  const tn = labels.length - tp - fp - fn;
  return { tp, fp, fn, tn };
}

export function precisionRecallF1(labels, preds) {
  const { tp, fp, fn } = confusion(labels, preds);
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

// AUC 用 Mann-Whitney U 秩统计，等价于概率形式的 ROC AUC
export function auc(labels, scores) {
  const n = labels.length;
  let nPos = 0, nNeg = 0, rankSum = 0;
  const idx = [...Array(n).keys()].sort((a, b) => scores[a] - scores[b] || labels[a] - labels[b]);
  for (let i = 0; i < n; i++) {
    const j = idx[i];
    if (labels[j] === 1) { nPos++; rankSum += i + 1; }
    else nNeg++;
  }
  if (nPos === 0 || nNeg === 0) return 0.5;
  return (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}
