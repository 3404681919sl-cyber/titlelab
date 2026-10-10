// predict.js —— 推理诊断：评分 + 7 维诊断 + 双子分 + 广告/标题党检测 + 特征归因 + 违禁词 + 规则降级 + 发布建议。
import { SUSPENSE_WORDS, EMOTION_WORDS, HOTWORDS, VIOLATIONS, MARKETING_WORDS, CLICKBAIT_WORDS } from '../data/lexicon.js';
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
  else if (kind === '广告营销感') note = matched.length ? `命中「${matched.slice(0, 3).join('、')}」等营销话术，一眼看穿在卖货。大V有信任背书才驾驭得住，新号会被当广告划走` : '没有硬广味，读起来像真实分享，天然可信';
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
  const marketingHits = findWords(text, MARKETING_WORDS);
  const clickbaitHits = findWords(text, CLICKBAIT_WORDS);

  const dimEmotion = clamp(emotionHits.length * 30 + excl * 8);
  const dimSpecific = clamp((digits > 0 ? 40 : 0) + digits * 12 + (/^\d/.test(text) ? 15 : 0));
  const dimLength = len >= 8 && len <= 20 ? 100 : (len < 8 ? 40 : (len <= 40 ? 60 : 30));
  const dimHotword = clamp(hotHits.length * 35);
  const dimSuspense = clamp(suspenseHits.length * 30 + ques * 10);
  const dimFeel = clamp(30 + Math.min(emoji, 2) * 20 + Math.min(sep, 2) * 10
    + (/[【】「」]/.test(text) ? 10 : 0) + (/[:：]/.test(text) ? 10 : 0) + (/[?？!！…~～]$/.test(text) ? 10 : 0));
  // 广告营销感：营销词越多，这一维得分越低（越差）
  const dimMarketing = clamp(100 - marketingHits.length * 30);

  const dimensions = [
    makeDim('情绪浓度', 'heart-pulse', dimEmotion, emotionHits, '情绪词'),
    makeDim('具体度·数字感', 'hash', dimSpecific, digits ? ['数字'] : [], '数字'),
    makeDim('长度适配', 'ruler-type', dimLength, [], '长度'),
    makeDim('热词命中', 'search-star', dimHotword, hotHits, '赛道热词'),
    makeDim('悬念好奇', 'eye', dimSuspense, suspenseHits, '悬念词'),
    makeDim('平台语感', 'message-circle', dimFeel, [], '语感'),
    makeDim('广告营销感', 'shield-check', dimMarketing, marketingHits, '广告营销感')
  ];

  // 打开吸引力：广告感过重会拉低打开意愿（用户一眼看穿是广告就不点）
  const openScore = clamp(dimEmotion * 0.3 + dimSuspense * 0.3 + dimFeel * 0.2 + dimSpecific * 0.1 - marketingHits.length * 10);
  const searchScore = clamp(dimHotword * 0.4 + dimSpecific * 0.3 + dimLength * 0.3);

  const highlights = [];
  for (const w of emotionHits) highlights.push({ word: w, type: 'emotion' });
  for (const w of suspenseHits) highlights.push({ word: w, type: 'suspense' });
  for (const w of hotHits) highlights.push({ word: w, type: 'hotword' });
  for (const w of violations) highlights.push({ word: w, type: 'violation' });
  for (const w of marketingHits) highlights.push({ word: w, type: 'marketing' });

  const strengths = [];
  for (const d of dimensions) if (d.score >= 70) strengths.push(d);
  strengths.sort((a, b) => b.score - a.score);
  const strengthTexts = strengths.slice(0, 3).map(d => d.note);
  if (strengthTexts.length === 0) strengthTexts.push('还没有明显亮点，试试下方「一键优化改写」补上钩子');

  // 疑似广告投流/软文判定
  const adFlag = marketingHits.length >= 2 || (marketingHits.length >= 1 && clickbaitHits.length >= 1);

  return {
    dimensions, openScore, searchScore, highlights, violations, strengthTexts, len,
    marketingHits, clickbaitHits, adFlag
  };
}

// 基于真实爆款教程归纳的发布建议（封面/构图/文风/时机）
export function buildSuggestions(res) {
  const dims = {};
  for (const d of res.dimensions) dims[d.name] = d.score;
  const s = [];
  if (res.adFlag) {
    s.push({
      icon: 'alert-note', title: '疑似广告投流/软文',
      text: '「巨显白／必买／闭眼入」这类话术会让新号被当广告划走，只有头部博主有信任背书才驾驭得住。换成真实体验口吻（"我用了 3 个月，真实变化如下"）点击率通常更高。'
    });
  } else if (res.clickbait && res.clickbait.length) {
    s.push({
      icon: 'alert-note', title: '标题党风险',
      text: `命中「${res.clickbait.slice(0, 2).join('、')}」等过度承诺词，正文兑现不了会被取关并触发限流，把承诺收敛到可兑现的程度。`
    });
  }
  if (dims['具体度·数字感'] >= 60) {
    s.push({ icon: 'search-star', title: '封面：数字/结果前置放大', text: '标题数字感强，封面把最炸的数字或结果直接放大放前景，做到三米外也能看清。' });
  } else {
    s.push({ icon: 'search-star', title: '封面：结果前置', text: '把最终效果（前后对比/成品图）放封面，字要大、一句话标题上封面，色彩明亮有对比，别灰蒙蒙。' });
  }
  if (dims['情绪浓度'] >= 60) {
    s.push({ icon: 'eye', title: '构图：人物出镜', text: '情绪/共鸣类笔记人物出镜（表情自然）比纯图文点击更高；用居中或三分法构图，主体突出、背景干净。' });
  } else {
    s.push({ icon: 'eye', title: '构图：主体突出', text: '主体放中央或三分线交点，背景干净不杂乱，光线充足；对比强烈、色彩明亮，别灰蒙蒙。' });
  }
  s.push({ icon: 'message-circle', title: '文风：口语化＋黄金三段式', text: '正文用「钩子→干货→互动」三段式，短句口语化，emoji 一篇 2-3 个别连串，别官方生硬。' });
  s.push({ icon: 'clock', title: '发布时间', text: '工作日 12-13 点、19-22 点是流量高峰；发布后 1 小时内多回评论，把初始互动拉起来。' });
  return s;
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
  const d = computeDimensions(text, category);
  const score = Math.round(Math.max(0, Math.min(1, p)) * 100);

  // 双子分校准：规则子分与模型分 50/50 融合，保证与总评同量级
  const mlScore = score;
  const openScore = clamp(d.openScore * 0.5 + mlScore * 0.5);
  const searchScore = clamp(d.searchScore * 0.5 + mlScore * 0.5);

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

  const res = {
    score, grade: gradeOf(score), prob: p,
    openScore, searchScore,
    percentile: percentileOf(model, category, p),
    dimensions: d.dimensions, strengths: d.strengthTexts, violations: d.violations,
    attribution: { pos, neg, terms: terms.slice(0, 5) },
    highlights: d.highlights, len: d.len, degraded: false,
    marketingHits: d.marketingHits, clickbaitHits: d.clickbaitHits, adFlag: d.adFlag
  };
  res.suggestions = buildSuggestions(res);
  return res;
}

// 规则降级：模型不可用时，用诊断均值作为评分（保证不白屏）
export function analyzeRule(rawText, category) {
  const text = String(rawText || '').normalize('NFKC').trim();
  const d = computeDimensions(text, category);
  const avg = d.dimensions.reduce((s, x) => s + x.score, 0) / d.dimensions.length;
  const score = clamp(avg);
  const res = {
    score, grade: gradeOf(score), prob: score / 100,
    openScore: d.openScore, searchScore: d.searchScore, percentile: 50,
    dimensions: d.dimensions, strengths: d.strengthTexts, violations: d.violations,
    attribution: { pos: [], neg: [], terms: [] },
    highlights: d.highlights, len: d.len, degraded: true,
    marketingHits: d.marketingHits, clickbaitHits: d.clickbaitHits, adFlag: d.adFlag
  };
  res.suggestions = buildSuggestions(res);
  return res;
}
