// numeric-features.js —— 14 项数值特征提取与 z-score 标准化（统计量仅来自训练集）。
import { displayLength, countEmoji } from './preprocess.js';
import { SUSPENSE_WORDS, EMOTION_WORDS } from '../data/lexicon.js';

export const FEATURE_NAMES = [
  '长度适配', '字数甜区', '数字占比', '数字开头', '问号数', '感叹号数',
  '悬念词命中', '情绪词命中', 'emoji密度', '分隔符数', '括号标记', '冒号使用',
  '字符多样性', '钩子结尾'
];

const DIGIT_RE = /\d/g;
const SEP_RE = /[｜|，,\s]/g;
const BRACKET_RE = /[【】「」]/g;

function countHits(text, words) {
  let c = 0;
  for (const w of words) if (text.includes(w)) c++;
  return c;
}

// 提取 14 项原始特征（未标准化）
export function extractNumeric(text) {
  const len = displayLength(text);
  const emoji = countEmoji(text);
  const digits = (text.match(DIGIT_RE) || []).length;
  const unique = new Set(text).size;
  const f = new Array(14);
  f[0] = len;                                       // 长度
  f[1] = (len >= 8 && len <= 20) ? 1 : 0;           // 字数甜区
  f[2] = len > 0 ? digits / len : 0;                // 数字占比
  f[3] = /^\d/.test(text) ? 1 : 0;                  // 数字开头
  f[4] = (text.match(/\?/g) || []).length;          // 问号
  f[5] = (text.match(/[!！]/g) || []).length;       // 感叹号
  f[6] = countHits(text, SUSPENSE_WORDS);           // 悬念词
  f[7] = countHits(text, EMOTION_WORDS);            // 情绪词
  f[8] = len > 0 ? emoji / len : 0;                 // emoji 密度
  f[9] = (text.match(SEP_RE) || []).length;         // 分隔符
  f[10] = BRACKET_RE.test(text) ? 1 : 0;            // 括号
  f[11] = /[:：]/.test(text) ? 1 : 0;               // 冒号
  f[12] = len > 0 ? unique / len : 0;               // 字符多样性
  f[13] = /[?？!！…~～]/.test(text) ? 1 : 0;        // 钩子结尾
  return f;
}

export function computeStats(rows) {
  const n = rows.length, dim = 14;
  const mean = new Float64Array(dim), std = new Float64Array(dim);
  for (const r of rows) for (let j = 0; j < dim; j++) mean[j] += r[j];
  for (let j = 0; j < dim; j++) mean[j] /= n;
  for (const r of rows) for (let j = 0; j < dim; j++) std[j] += (r[j] - mean[j]) ** 2;
  for (let j = 0; j < dim; j++) std[j] = Math.sqrt(std[j] / n) || 1;
  return { mean, std };
}

export function zscore(row, stats) {
  const z = new Float64Array(14);
  for (let j = 0; j < 14; j++) z[j] = (row[j] - stats.mean[j]) / stats.std[j];
  return z;
}
