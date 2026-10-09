/** 字符 n-gram 切分 —— ARCHITECTURE.md 4.2：字符 1-gram + 2-gram 并集 */

/** 生成字符 1-gram 与 2-gram（相邻两字滑窗，按码点切分以正确处理 emoji） */
export function charNgrams(text: string): string[] {
  const cps = Array.from(text);
  const grams: string[] = [];
  for (let i = 0; i < cps.length; i++) {
    grams.push(cps[i]);
    if (i + 1 < cps.length) {
      grams.push(cps[i] + cps[i + 1]);
    }
  }
  return grams;
}
