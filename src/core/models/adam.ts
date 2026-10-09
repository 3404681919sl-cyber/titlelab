/** Adam 优化器 —— β1=0.9, β2=0.999, eps=1e-8，含 bias correction */

export class AdamOptimizer {
  private m: Float64Array;
  private v: Float64Array;
  private t = 0;

  constructor(
    readonly size: number,
    public lr = 1e-3,
    public beta1 = 0.9,
    public beta2 = 0.999,
    public eps = 1e-8,
  ) {
    this.m = new Float64Array(size);
    this.v = new Float64Array(size);
  }

  /** theta -= lr * m̂ / (√v̂ + eps)，grad 为本次梯度 */
  step(theta: Float64Array, grad: Float64Array): void {
    this.t += 1;
    const { beta1, beta2, lr, eps } = this;
    const bc1 = 1 - Math.pow(beta1, this.t);
    const bc2 = 1 - Math.pow(beta2, this.t);
    for (let i = 0; i < this.size; i++) {
      const g = grad[i];
      this.m[i] = beta1 * this.m[i] + (1 - beta1) * g;
      this.v[i] = beta2 * this.v[i] + (1 - beta2) * g * g;
      const mHat = this.m[i] / bc1;
      const vHat = this.v[i] / bc2;
      theta[i] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
    }
  }
}
