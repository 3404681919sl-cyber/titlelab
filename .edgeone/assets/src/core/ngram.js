// ngram.js —— 字符级 1-gram + 2-gram 提取（中文无需分词，bigram 天然覆盖高频子串）。
export function charNgrams(text) {
  const grams = [];
  for (let i = 0; i < text.length; i++) {
    grams.push(text[i]);
    if (i + 1 < text.length) grams.push(text[i] + text[i + 1]);
  }
  return grams;
}
