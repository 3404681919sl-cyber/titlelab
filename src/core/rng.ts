/** mulberry32 种子伪随机数生成器 —— 全项目唯一随机性来源（可复现） */

export type Rng = () => number;

/** 返回 [0, 1) 的确定性 PRNG，种子固定则序列固定 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** 项目默认种子（SPEC/ARCHITECTURE 锁定 seed=42） */
export function createRng(seed = 42): Rng {
  return mulberry32(seed);
}

/** [min, max) 整数 */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min));
}

/** 从数组中按 rng 取一个元素 */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
