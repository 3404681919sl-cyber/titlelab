/** 逻辑回归 —— 全批梯度下降 + L2（ARCHITECTURE.md 5.1：lr=0.5, 300 epochs, λ=1e-4） */
import type { SparseVector } from '../../types/model';

export interface TrainingSample {
  x: SparseVector;
  y: 0 | 1;
}

export interface LrTrainOptions {
  epochs?: number;
  lr?: number;
  l2?: number;
}

function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

export class LogisticRegression {
  readonly w: Float64Array;
  b = 0;

  constructor(readonly dim: number) {
    this.w = new Float64Array(dim);
  }

  predictProb(x: SparseVector): number {
    let z = this.b;
    for (let k = 0; k < x.indices.length; k++) {
      z += x.values[k] * this.w[x.indices[k]];
    }
    return sigmoid(z);
  }

  /** 全批训练，返回每个 epoch 的平均 loss（供收敛曲线绘制） */
  fit(samples: TrainingSample[], opts: LrTrainOptions = {}): number[] {
    const epochs = opts.epochs ?? 300;
    const lr = opts.lr ?? 0.5;
    const l2 = opts.l2 ?? 1e-4;
    const n = samples.length;
    const losses: number[] = [];
    const gw = new Float64Array(this.dim);
    for (let epoch = 0; epoch < epochs; epoch++) {
      gw.fill(0);
      let gb = 0;
      let loss = 0;
      for (const s of samples) {
        const p = this.predictProb(s.x);
        const pc = Math.min(Math.max(p, 1e-7), 1 - 1e-7);
        loss += -(s.y * Math.log(pc) + (1 - s.y) * Math.log(1 - pc));
        const e = p - s.y;
        gb += e;
        for (let k = 0; k < s.x.indices.length; k++) {
          gw[s.x.indices[k]] += e * s.x.values[k];
        }
      }
      // L2 梯度与损失（不含偏置）
      for (let j = 0; j < this.dim; j++) {
        gw[j] = gw[j] / n + l2 * this.w[j];
        loss += (l2 / 2) * this.w[j] * this.w[j];
      }
      this.b -= (lr * gb) / n;
      for (let j = 0; j < this.dim; j++) this.w[j] -= lr * gw[j];
      losses.push(loss / n);
    }
    return losses;
  }
}
