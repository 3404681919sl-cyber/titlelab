// mlp.js —— 双隐层前馈神经网络（V+14 → 32 → 16 → 1），He 初始化 + Adam + 早停。
// 稀疏首层：仅对非零文本特征累加，避免 2014 维全物化。
function relu(x) { return x > 0 ? x : 0; }
function sigmoid(x) {
  if (x >= 0) { const z = Math.exp(-x); return 1 / (1 + z); }
  const z = Math.exp(x); return z / (1 + z);
}

class Adam {
  constructor(size) { this.m = new Float64Array(size); this.v = new Float64Array(size); this.t = 0; }
  step(w, g, lr, wd) {
    this.t++;
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    const bc1 = 1 - Math.pow(b1, this.t);
    const bc2 = 1 - Math.pow(b2, this.t);
    for (let i = 0; i < w.length; i++) {
      let gi = g[i];
      if (wd) gi += wd * w[i];
      this.m[i] = b1 * this.m[i] + (1 - b1) * gi;
      this.v[i] = b2 * this.v[i] + (1 - b2) * gi * gi;
      w[i] -= (lr * (this.m[i] / bc1)) / (Math.sqrt(this.v[i] / bc2) + eps);
    }
  }
}

// He 初始化（Box-Muller 高斯，std = sqrt(2/fan_in)）
function initWeight(n, fanIn, rng) {
  const std = Math.sqrt(2 / fanIn);
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    a[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std;
  }
  return a;
}

function binaryCE(p, y) {
  const pc = Math.min(1 - 1e-12, Math.max(1e-12, p));
  return -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
}

export async function trainMLP(samples, V, D, {
  H = 24, H2 = 12, lr = 1e-3, wd = 1e-4, epochs = 150,
  batchSize = 32, patience = 3, seed = 42, valSamples = null, onProgress = null
} = {}) {
  const rng = (() => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

  const W1 = initWeight(H * V, V, rng);
  const W1d = initWeight(H * D, D, rng);
  const b1 = new Float64Array(H);
  const W2 = initWeight(H2 * H, H, rng);
  const b2 = new Float64Array(H2);
  const W3 = initWeight(H2, H2, rng);
  const b3 = new Float64Array(1);

  const aW1 = new Adam(H * V), aW1d = new Adam(H * D), ab1 = new Adam(H);
  const aW2 = new Adam(H2 * H), ab2 = new Adam(H2), aW3 = new Adam(H2), ab3 = new Adam(1);

  const N = samples.length;

  function forward(s) {
    const z1 = new Float64Array(H), h1 = new Float64Array(H);
    for (let i = 0; i < H; i++) {
      let z = b1[i];
      const base = i * V;
      for (const [id, val] of s.sparse) z += W1[base + id] * val;
      const base2 = i * D;
      for (let j = 0; j < D; j++) z += W1d[base2 + j] * s.dense[j];
      z1[i] = z; h1[i] = relu(z);
    }
    const z2 = new Float64Array(H2), h2 = new Float64Array(H2);
    for (let k = 0; k < H2; k++) {
      let z = b2[k];
      const base = k * H;
      for (let i = 0; i < H; i++) z += W2[base + i] * h1[i];
      z2[k] = z; h2[k] = relu(z);
    }
    let z3 = b3[0];
    for (let k = 0; k < H2; k++) z3 += W3[k] * h2[k];
    return { p: sigmoid(z3), h1, z1, h2, z2 };
  }

  function backward(s, fwd, g) {
    const y = s.label;
    const d3 = fwd.p - y;
    g.b3 += d3;
    for (let k = 0; k < H2; k++) g.W3[k] += d3 * fwd.h2[k];

    const dh2 = new Float64Array(H2);
    for (let k = 0; k < H2; k++) {
      const dz = d3 * W3[k];
      dh2[k] = dz * (fwd.z2[k] > 0 ? 1 : 0);
      g.b2[k] += dh2[k];
      const base = k * H;
      for (let i = 0; i < H; i++) g.W2[base + i] += dh2[k] * fwd.h1[i];
    }

    for (let i = 0; i < H; i++) {
      let dz = 0;
      for (let k = 0; k < H2; k++) dz += dh2[k] * W2[k * H + i];
      const dh1 = dz * (fwd.z1[i] > 0 ? 1 : 0);
      g.b1[i] += dh1;
      const base = i * V;
      for (const [id, val] of s.sparse) g.W1[base + id] += dh1 * val;
      const base2 = i * D;
      for (let j = 0; j < D; j++) g.W1d[base2 + j] += dh1 * s.dense[j];
    }
  }

  const trainLossHist = [], valLossHist = [];
  let bestValLoss = Infinity, noImprove = 0;

  for (let ep = 0; ep < epochs; ep++) {
    const order = [...Array(N).keys()];
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }

    let trainLoss = 0, seen = 0;
    for (let start = 0; start < N; start += batchSize) {
      const batch = order.slice(start, start + batchSize);
      const g = {
        W1: new Float64Array(H * V), W1d: new Float64Array(H * D), b1: new Float64Array(H),
        W2: new Float64Array(H2 * H), b2: new Float64Array(H2), W3: new Float64Array(H2), b3: 0
      };
      for (const idx of batch) {
        const s = samples[idx];
        const fwd = forward(s);
        backward(s, fwd, g);
        trainLoss += binaryCE(fwd.p, s.label);
        seen++;
      }
      const m = batch.length;
      for (let i = 0; i < g.W1.length; i++) g.W1[i] /= m;
      for (let i = 0; i < g.W1d.length; i++) g.W1d[i] /= m;
      for (let i = 0; i < g.b1.length; i++) g.b1[i] /= m;
      for (let i = 0; i < g.W2.length; i++) g.W2[i] /= m;
      for (let i = 0; i < g.b2.length; i++) g.b2[i] /= m;
      for (let i = 0; i < g.W3.length; i++) g.W3[i] /= m;
      const gb3 = new Float64Array([g.b3 / m]);

      aW1.step(W1, g.W1, lr, wd);
      aW1d.step(W1d, g.W1d, lr, wd);
      ab1.step(b1, g.b1, lr, wd);
      aW2.step(W2, g.W2, lr, wd);
      ab2.step(b2, g.b2, lr, wd);
      aW3.step(W3, g.W3, lr, wd);
      ab3.step(b3, gb3, lr, wd);
    }

    trainLoss /= (seen || 1);
    trainLossHist.push(trainLoss);

    // 每 5 个 epoch 在验证集上算一次 loss 做早停
    if (valSamples && (ep + 1) % 5 === 0) {
      let vl = 0;
      for (const s of valSamples) vl += binaryCE(forward(s).p, s.label);
      vl /= valSamples.length;
      valLossHist.push(vl);
      if (vl < bestValLoss - 1e-4) { bestValLoss = vl; noImprove = 0; }
      else { noImprove++; if (noImprove >= patience) { trainLossHist.push(trainLoss); break; } }
    }

    if (onProgress && (ep % 2 === 0 || ep === epochs - 1)) {
      onProgress(ep + 1, epochs, { trainLoss, valLoss: bestValLoss });
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return {
    W1, W1d, b1, W2, b2, W3, b3, trainLossHist, valLossHist,
    predict(sample) { return forward(sample).p; }
  };
}
