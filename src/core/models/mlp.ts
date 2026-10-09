/**
 * MLP —— input→32(ReLU)→16(ReLU)→1(sigmoid)，He 初始化 + Adam + L2。
 * 第一层稀疏前向/反向（只累加非零特征对应的权重列）。
 * lossAndGrads 提供全批解析梯度，供数值梯度检验对照（防沉默逻辑错误）。
 */
import type { SparseVector } from '../../types/model';
import type { Rng } from '../rng';
import { AdamOptimizer } from './adam';
import type { TrainingSample } from './logistic-regression';

export interface MlpShape {
  inputDim: number;
  h1: number;
  h2: number;
}

export function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

export class MLP {
  readonly shape: MlpShape;
  /** 展平参数：W1(D×h1) | b1(h1) | W2(h1×h2) | b2(h2) | W3(h2) | b3(1) */
  readonly theta: Float64Array;
  private readonly oB1: number;
  private readonly oW2: number;
  private readonly oB2: number;
  private readonly oW3: number;
  private readonly oB3: number;
  private readonly isBias: Uint8Array;
  private adam: AdamOptimizer;

  constructor(shape: MlpShape, rng?: Rng) {
    this.shape = shape;
    const { inputDim: d, h1, h2 } = shape;
    const size = d * h1 + h1 + h1 * h2 + h2 + h2 + 1;
    this.theta = new Float64Array(size);
    this.oB1 = d * h1;
    this.oW2 = this.oB1 + h1;
    this.oB2 = this.oW2 + h1 * h2;
    this.oW3 = this.oB2 + h2;
    this.oB3 = this.oW3 + h2;
    this.isBias = new Uint8Array(size);
    for (let i = 0; i < h1; i++) this.isBias[this.oB1 + i] = 1;
    for (let j = 0; j < h2; j++) this.isBias[this.oB2 + j] = 1;
    this.isBias[this.oB3] = 1;
    this.adam = new AdamOptimizer(size, 1e-3);
    if (rng) this.heInit(rng);
  }

  /** He 初始化（ReLU 配套），确定性 rng */
  private heInit(rng: Rng): void {
    const { inputDim: d, h1, h2 } = this.shape;
    const gauss = (): number => {
      const u1 = Math.max(rng(), 1e-12);
      const u2 = rng();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    for (let i = 0; i < d * h1; i++) this.theta[i] = gauss() * Math.sqrt(2 / d);
    for (let i = 0; i < h1 * h2; i++) this.theta[this.oW2 + i] = gauss() * Math.sqrt(2 / h1);
    for (let i = 0; i < h2; i++) this.theta[this.oW3 + i] = gauss() * Math.sqrt(2 / h2);
  }

  /** 前向到 logit，写入激活缓存 */
  private forward(
    x: SparseVector,
    z1: Float64Array, a1: Float64Array,
    z2: Float64Array, a2: Float64Array,
  ): number {
    const { h1, h2 } = this.shape;
    for (let j = 0; j < h1; j++) z1[j] = this.theta[this.oB1 + j];
    for (let k = 0; k < x.indices.length; k++) {
      const i = x.indices[k];
      const v = x.values[k];
      for (let j = 0; j < h1; j++) z1[j] += v * this.theta[i * h1 + j];
    }
    for (let j = 0; j < h1; j++) a1[j] = z1[j] > 0 ? z1[j] : 0;
    for (let j = 0; j < h2; j++) z2[j] = this.theta[this.oB2 + j];
    for (let i = 0; i < h1; i++) {
      if (a1[i] === 0) continue;
      for (let j = 0; j < h2; j++) z2[j] += a1[i] * this.theta[this.oW2 + i * h2 + j];
    }
    for (let j = 0; j < h2; j++) a2[j] = z2[j] > 0 ? z2[j] : 0;
    let z3 = this.theta[this.oB3];
    for (let j = 0; j < h2; j++) z3 += a2[j] * this.theta[this.oW3 + j];
    return z3;
  }

  predictProb(x: SparseVector): number {
    const { h1, h2 } = this.shape;
    const z3 = this.forward(x, new Float64Array(h1), new Float64Array(h1), new Float64Array(h2), new Float64Array(h2));
    return sigmoid(z3);
  }

  /**
   * 全批 loss 与解析梯度（不更新参数）。
   * loss = mean BCE + (l2/2)·Σw²（权重项，不含偏置）；
   * grad = mean(dBCE) + l2·w。
   * 数值梯度检验的直接对照实现。
   */
  lossAndGrads(samples: TrainingSample[], l2: number): { loss: number; grad: Float64Array } {
    const { h1, h2 } = this.shape;
    const grad = new Float64Array(this.theta.length);
    const z1 = new Float64Array(h1), a1 = new Float64Array(h1);
    const z2 = new Float64Array(h2), a2 = new Float64Array(h2);
    const dz1 = new Float64Array(h1);
    const n = samples.length;
    let bce = 0;
    for (const s of samples) {
      const z3 = this.forward(s.x, z1, a1, z2, a2);
      const p = sigmoid(z3);
      const pc = Math.min(Math.max(p, 1e-7), 1 - 1e-7);
      bce += -(s.y * Math.log(pc) + (1 - s.y) * Math.log(1 - pc));
      dz1.fill(0);
      // 输出层
      const dz3 = p - s.y;
      grad[this.oB3] += dz3;
      for (let j = 0; j < h2; j++) {
        if (z2[j] <= 0) continue;
        const dz2 = this.theta[this.oW3 + j] * dz3;
        grad[this.oW3 + j] += a2[j] * dz3;
        grad[this.oB2 + j] += dz2;
        for (let i = 0; i < h1; i++) {
          if (a1[i] === 0) continue;
          grad[this.oW2 + i * h2 + j] += a1[i] * dz2;
          dz1[i] += this.theta[this.oW2 + i * h2 + j] * dz2;
        }
      }
      // 第一层（稀疏：只回传到非零特征行）
      for (let i = 0; i < h1; i++) {
        if (z1[i] <= 0) continue;
        grad[this.oB1 + i] += dz1[i];
        for (let k = 0; k < s.x.indices.length; k++) {
          grad[s.x.indices[k] * h1 + i] += s.x.values[k] * dz1[i];
        }
      }
    }
    let l2loss = 0;
    for (let idx = 0; idx < this.theta.length; idx++) {
      grad[idx] /= n;
      if (this.isBias[idx]) continue;
      grad[idx] += l2 * this.theta[idx];
      l2loss += this.theta[idx] * this.theta[idx];
    }
    return { loss: bce / n + (l2 / 2) * l2loss, grad };
  }

  /** 一个 mini-batch 的前向+反向+Adam 更新，返回平均 loss（含 L2 惩罚项） */
  trainBatch(batch: TrainingSample[], l2: number): number {
    const { loss, grad } = this.lossAndGrads(batch, l2);
    this.adam.step(this.theta, grad);
    return loss;
  }
}
