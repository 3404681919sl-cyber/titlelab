/** 文本预处理 —— ARCHITECTURE.md 4.1：NFKC / 小写 / 空白压缩，不去标点与 emoji */

/**
 * 规范化标题文本：
 * 1. NFKC 归一化（全角→半角、兼容字符统一）
 * 2. 英文转小写
 * 3. 首尾空白去除、连续空白压缩为单个空格
 */
export function preprocess(text: string): string {
  const normalized = text.normalize('NFKC').toLowerCase();
  return normalized.trim().replace(/\s+/g, ' ');
}

/** 按码点切分（正确处理 emoji 等增补平面字符） */
export function codePoints(text: string): string[] {
  return Array.from(text);
}
