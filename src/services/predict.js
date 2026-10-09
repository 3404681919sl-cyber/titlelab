// predict.js —— 推理诊断：评分 + 6 维诊断 + 双子分 + 特征归因 + 违禁词 + 规则降级。
import { SUSPENSE_WORDS, EMOTION_WORDS, HOTWORDS, VIOLATIONS } from '../data/lexicon.js';
import { displayLength, countEmoji } from '../core/preprocess.js';
import { FEATURE_NAMES } from '../core/numeric-features.js';

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

function findWords(text, words) {
  const hits = [];
  for (const w of words) if (text.includes(w)) hits.push(w);
  return hits;
}

export function gradeOf(score) {
  if (score >= 80) return { key: 'viral', label: '爆款潜质' };
  if (score >= 60) return { key: 'good', label: '良好' };
  if (score >= 40) return { key: 'mid', label: '普通' };
  return { key: 'low', label: '待优化' };
}

function dimStatus(score) {
  if (score >= 70) return '达标';
  if (score >= 40) return '可优化';
  return '偏弱';
}

function makeDim(name, icon, score, matched, kind) {
  let note;
  if (kind === '情绪词') note = matched.length ? `命中情绪词「${matched[0]}」等，共鸣感不错` : '缺少情绪词，读者难被戳中，可加「治愈／破防／太值了」类表达';
  else if (kind === '数字') note = matched.length ? '用了具体数字，信息更可信' : '缺少具体数字，可加数量／价格／时长增强可信度';
  else if (kind === '长度') note = score >= 70 ? '长度在 8-20 字甜区，首屏完整展示' : (score >= 40 ? '偏长，首屏双行可能被截断' : '偏短，信息量不足以支撑点击');
  else if (kind === '赛道热词') note = matched.length ? `命中赛道热词「${matched.slice(0, 2).join('、')}」，利于被搜索` : '未命中赛道热词，可补一个利于被搜索的关键词';
  else if (kind === '悬念词') note = matched.length ? `命中悬念词「${matched[0]}」等，勾起了好奇心` : '缺少悬念／反差，可加「竟然／后悔／千万别」制造钩子';
  else note = score >= 70 ? 'emoji／分隔符／标点用得自然，平台语感在线' : '偏「文件标题」感，可加 emoji 或分隔符更贴近小红书语感';
  return { name, icon, score, status: dimStatus(score), note, matched };
}

function computeDimensions(text, category) {
  const len = displayLength(text);
  const emoji = countEmoji(text);
  const digits = (text.match(/\d/g) || []).length;
  const excl = (text.match(/[!！]/g) || []).length;
  const ques = (text.match(/[?？]/g) || []).length;
  const sep = (text.match(/[｜|，,\s]/g) || []).length;

  const emotionHits = findWords(text, EMOTION_WORDS);
  const suspenseHits = findWords(text, SUSPENSE_WORDS);
  const hotHits = findWords(text, HOTWORDS[category] || HOTWORDS['通用']);
  const violations = findWords(text, VIOLATIONS);

  const dimEmotion = clamp(emotionHits.length * 30 + excl * 8);
  const dimSpecific = clamp((digits > 0 ? 40 : 0) + digits * 12 + (/^\d/.test(text) ? 15 : 0));
  const dimLength = len >= 8 && len <= 20 ? 100 : (len < 8 ? 40 : (len <= 40 ? 60 : 30));
  const dimHotword = clamp(hotHits.length * 35);
  const dimSuspense = clamp(suspenseHits.length * 30 + ques * 10);
  const dimFeel = clamp(30 + Math.min(emoji, 2) * 20 + Math.min(sep, 2) * 10
    + (/[【】「」]/.test(text) ? 10 : 0) + (/[:：]/.test(text) ? 10 : 0) + (/[?？!！…~～]$/.test(text) ? 10 : 0));

  const dimensions = [
    makeDim('情绪浓度', 'heart-pulse', dimEmotion, emotionHits, '情绪词'),
    makeDim('具体度·数字感', 'hash', dimSpecific, digits ? ['数字'] : [], '数字'),
    makeDim('长度适配', 'ruler-type', dimLength, [], '长度'),
    makeDim('热词命中', 'search-star', dimHotword, hotHits, '赛道热词'),
    makeDim('悬念好奇', 'eye', dimSuspense, suspenseHits, '悬念词'),
    makeDim('平台语感', 'message-circle', dimFeel, [], '语感')
  ];

  const openScore = clamp(dimEmotion * 0.35 + dimSuspense * 0.35 + dimFeel * 0.2 + dimSpecific * 0.1);
  const searchScore = clamp(dimHotword * 0.4 + dimSpecific * 0.3 + dimLength * 0.3);

  const highlights = [];
  for (const w of emotionHits) highlights.push({ word: w, type: 'emotion' });
  for (const w of suspenseHits) highlights.push({ word: w, type: 'suspense' });
  for (const w of hotHits) highlights.push({ word: w, type: 'hotword' });
  for (const w of violations) highlights.push({ word: w, type: 'violation' });

  const strengths = [];
  for (const d of dimensions) if (d.score >= 70) strengths.push(d);
  strengths.sort((a, b) => b.score - a.score);
  const strengthTexts = strengths.slice(0, 3).map(d => d.note);
  if (strengthTexts.length === 0) strengthTexts.push('还没有明显亮点，试试下方「一键优化改写」补上钩子');

  return { dimensions, openScore, searchScore, highlights, violations, strengthTexts, len };
}

function percentileOf(model, category, p) {
  const arr = model.catScores[category];
  const dist = (arr && arr.length >= 20) ? arr : model.allScores;
  let below = 0;
  for (const s of dist) if (s < p) below++;
  return Math.round((below / dist.length) * 100);
}

export function analyze(model, rawText, category) {
  const input = model.prepareInput(rawText);
  const text = input.text;
  const { p } = model.scoreProb(input);
  const score = clamp(p, 0, 1) * 100;
  const d = computeDimensions(text, category);

  // 特征归因（LR 可解释）
  const z = input.dense;
  const numericContrib = [];
  for (let j = 0; j < 14; j++) numericContrib.push({ name: FEATURE_NAMES[j], value: model.lr.wDense[j] * z[j] });
  const pos = numericContrib.filter(c => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);
  const neg = numericContrib.filter(c => c.value < 0).sort((a, b) => a.value - b.value).slice(0, 3);

  const seen = new Set();
  const terms = [];
  for (const g of input.grams) {
    const id = model.vocab.termToId.get(g);
    if (id !== undefined && !seen.has(id)) { seen.add(id); terms.push({ term: g, w: model.lr.wSparse[id] }); }
  }
  terms.sort((a, b) => Math.abs(b.w) - Math.abs(a.w));

  return {
    score, grade: gradeOf(score), prob: p,
    openScore: d.openScore, searchScore: d.searchScore,
    percentile: percentileOf(model, category, p),
    dimensions: d.dimensions, strengths: d.strengthTexts, violations: d.violations,
    attribution: { pos, neg, terms: terms.slice(0, 5) },
    highlights: d.highlights, len: d.len, degraded: false
  };
}

// 规则降级：模型不可用时，用 6 维诊断的均值作为评分（保证不白屏）
export function analyzeRule(rawText, category) {
  const text = String(rawText || '').normalize('NFKC').trim();
  const d = computeDimensions(text, category);
  const avg = d.dimensions.reduce((s, x) => s + x.score, 0) / d.dimensions.length;
  const score = clamp(avg);
  return {
    score, grade: gradeOf(score), prob: score / 100,
    openScore: d.openScore, searchScore: d.searchScore, percentile: 50,
    dimensions: d.dimensions, strengths: d.strengthTexts, violations: d.violations,
    attribution: { pos: [], neg: [], terms: [] },
    highlights: d.highlights, len: d.len, degraded: true
  };
}
