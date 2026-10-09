// preprocess.js —— 文本预处理：NFKC 归一化 + 小写 + 空白压缩。保留标点与 emoji（是特征信号）。
export function preprocess(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// 统计 emoji 数量（按 Unicode 扩展平面粗略计数，用于 emojiDensity 特征）
const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}]/gu;
export function countEmoji(text) {
  const m = text.match(EMOJI_RE);
  return m ? m.length : 0;
}

// 可视长度：emoji 按 2 字符计入（对齐小红书双行显示逻辑）
export function displayLength(text) {
  return text.length + countEmoji(text);
}
