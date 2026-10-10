// rewrite.js —— 规则引擎改写：基于 2026 已发表爆款公式（数字盘点/痛点避坑/身份代入/悬念反差/数据实证）。
// 公式来源：公开标题方法论文章（拆解 3000 篇 10w+ 笔记总结的 9 种结构）。
import { SUSPENSE_WORDS, EMOTION_WORDS, VIOLATIONS, HOTWORDS, PERSONA_WORDS, STOPWORDS } from '../data/lexicon.js';

const STRATEGIES = [
  { key: 'number', label: '数字盘点', note: '＋具体数字（奇数更优），利益点前置', build: (topic, r) => `${r(3, 30)}个${topic}技巧，新手第3天就见效` },
  { key: 'pain', label: '痛点避坑', note: '痛点前置＋避坑清单，降低决策顾虑', build: (topic, r) => `${topic}总踩坑？${r(3, 30)}个避雷点先看再决定` },
  { key: 'persona', label: '身份代入', note: '＋人群标签，精准筛选目标读者', build: (topic, r) => `${rnd(r, PERSONA_WORDS)}必看：${topic}这样搞才真的有效` },
  { key: 'suspense', label: '悬念反差', note: '反直觉结论＋留白，勾住好奇心', build: (topic) => `没想到${topic}一直没效果，其实是这一步错了` },
  { key: 'proof', label: '数据实证', note: '实测数据背书，信任感更高', build: (topic, r) => `实测${r(3, 30)}天，${topic}的变化肉眼可见` }
];

const rnd = (r, arr) => arr[Math.floor(r() * arr.length)];

function extractTopic(text, category) {
  const hot = HOTWORDS[category] || HOTWORDS['通用'];
  for (const w of hot) if (text.includes(w)) return w;
  let core = text;
  const all = [...SUSPENSE_WORDS, ...EMOTION_WORDS, ...VIOLATIONS];
  for (const w of all) core = core.replaceAll(w, '');
  core = core.replace(/[\d\s｜|，,。.！!？?：:【】「」…~～-]/g, '');
  for (const ch of STOPWORDS) core = core.replaceAll(ch, '');
  core = core.trim();
  if (core.length >= 2) return core.slice(0, 6);
  return hot[0] || '干货';
}

// scoreFn(text) -> 0..1 概率
export function generateVariants(scoreFn, title, category) {
  const r = (() => { let s = 20261010 >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const topic = extractTopic(title, category);
  const variants = STRATEGIES.map(s => {
    const text = s.build(topic, (a, b) => a + Math.floor(r() * (b - a + 1)));
    const p = scoreFn(text);
    return {
      text, strategy: s.label, strategyKey: s.key, changeNote: s.note,
      predictedScore: Math.round(Math.max(0, Math.min(1, p)) * 100), prob: p
    };
  });
  variants.sort((a, b) => b.predictedScore - a.predictedScore);
  return variants.slice(0, 3);
}
