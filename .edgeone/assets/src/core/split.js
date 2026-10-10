// split.js —— 按标签分层切分 60/20/20，种子固定，指标可复现。
import { mulberry32, shuffleInPlace } from './rng.js';

export function stratifiedSplit(samples, { train = 0.6, val = 0.2, seed = 42 } = {}) {
  const byLabel = { 0: [], 1: [] };
  for (const s of samples) byLabel[s.label].push(s);

  const rng = mulberry32(seed);
  const trainSet = [], valSet = [], testSet = [];
  for (const label of [0, 1]) {
    const bucket = shuffleInPlace(byLabel[label].slice(), rng);
    const n = bucket.length;
    const nTrain = Math.floor(n * train);
    const nVal = Math.floor(n * val);
    trainSet.push(...bucket.slice(0, nTrain));
    valSet.push(...bucket.slice(nTrain, nTrain + nVal));
    testSet.push(...bucket.slice(nTrain + nVal));
  }
  shuffleInPlace(trainSet, rng); shuffleInPlace(valSet, rng); shuffleInPlace(testSet, rng);
  return { train: trainSet, val: valSet, test: testSet };
}
