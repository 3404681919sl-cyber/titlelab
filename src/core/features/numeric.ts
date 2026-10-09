/** 14 项数值特征 —— ARCHITECTURE.md 4.3 锁定清单 */
import { EMOTION_WORDS, SUSPENSE_WORDS } from '../../data/lexicon';
import { codePoints } from '../preprocess';

export const NUMERIC_FEATURE_NAMES: readonly string[] = [
  '长度归一', '甜区字数', '数字占比', '数字开头', '问号数', '叹号数',
  '悬念词命中', '情绪词命中', 'emoji密度', '分隔符数', '括号结构', '冒号结构',
  '字符多样性', '钩子结尾',
];

export const NUMERIC_DIM = 14;

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const SEPARATORS = new Set(['｜', '|', '、', '，', ',', ' ', '·', '/', '/']);
const BRACKET_OPEN = new Set(['【', '「', '（', '(', '[', '『']);

/** 统计词表中命中的不同词数（去重） */
function countHits(text: string, words: readonly string[]): { count: number; hits: string[] } {
  const found: string[] = [];
  for (const w of words) {
    if (text.includes(w)) found.push(w);
  }
  return { count: found.length, hits: found };
}

export interface NumericFeatures {
  values: Float64Array;
  /** 命中的悬念词（诊断展示用） */
  suspenseHits: string[];
  /** 命中的情绪词（诊断展示用） */
  emotionHits: string[];
  /** emoji 个数（诊断提示用） */
  emojiCount: number;
  /** 可见字符数（按码点） */
  charCount: number;
}

/** 计算预处理后文本的 14 项数值特征（原始值，未标准化） */
export function computeNumeric(text: string): NumericFeatures {
  const cps = codePoints(text);
  const n = cps.length;
  const digits = cps.filter((c) => c >= '0' && c <= '9').length;
  const firstNonSpace = cps.find((c) => c !== ' ');
  const hasLeadingDigit = firstNonSpace !== undefined && firstNonSpace >= '0' && firstNonSpace <= '9';

  const questionMarks = cps.filter((c) => c === '?' || c === '？').length;
  const exclamations = cps.filter((c) => c === '!' || c === '！').length;

  const susp = countHits(text, SUSPENSE_WORDS);
  const emo = countHits(text, EMOTION_WORDS);

  const emojiCount = (text.match(EMOJI_RE) ?? []).length;

  let separators = 0;
  let hasBracket = 0;
  for (const c of cps) {
    if (SEPARATORS.has(c)) separators++;
    if (BRACKET_OPEN.has(c)) hasBracket = 1;
  }
  // 空白已压缩为单空格，但原始分隔统计按压缩后文本即可
  const hasColon = text.includes(':') || text.includes('：') ? 1 : 0;
  const uniqueRatio = n > 0 ? new Set(cps).size / n : 0;
  const lastCp = cps[n - 1] ?? '';
  const endsWithHook = ['?', '？', '!', '！', '…', '。', '~', '～'].includes(lastCp) ? 1 : 0;

  const values = new Float64Array(NUMERIC_DIM);
  values[0] = Math.min(n, 40) / 40;
  values[1] = n >= 8 && n <= 20 ? 1 : 0;
  values[2] = n > 0 ? digits / n : 0;
  values[3] = hasLeadingDigit ? 1 : 0;
  values[4] = questionMarks;
  values[5] = exclamations;
  values[6] = susp.count;
  values[7] = emo.count;
  values[8] = n > 0 ? emojiCount / n : 0;
  values[9] = separators;
  values[10] = hasBracket;
  values[11] = hasColon;
  values[12] = uniqueRatio;
  values[13] = endsWithHook;
  return { values, suspenseHits: susp.hits, emotionHits: emo.hits, emojiCount, charCount: n };
}

/** z-score 标准化器：统计量只来自 train 集 */
export interface Scaler {
  mean: Float64Array;
  std: Float64Array;
}

export function fitScaler(rows: Float64Array[]): Scaler {
  const m = new Float64Array(NUMERIC_DIM);
  const s = new Float64Array(NUMERIC_DIM);
  if (rows.length === 0) return { mean: m, std: s };
  for (const r of rows) for (let j = 0; j < NUMERIC_DIM; j++) m[j] += r[j];
  for (let j = 0; j < NUMERIC_DIM; j++) m[j] /= rows.length;
  for (const r of rows) for (let j = 0; j < NUMERIC_DIM; j++) s[j] += (r[j] - m[j]) ** 2;
  for (let j = 0; j < NUMERIC_DIM; j++) {
    s[j] = Math.sqrt(s[j] / rows.length);
    if (s[j] < 1e-8) s[j] = 1; // 常数特征不缩放
  }
  return { mean: m, std: s };
}

export function applyScaler(scaler: Scaler, row: Float64Array): Float64Array {
  const out = new Float64Array(NUMERIC_DIM);
  for (let j = 0; j < NUMERIC_DIM; j++) out[j] = (row[j] - scaler.mean[j]) / scaler.std[j];
  return out;
}
