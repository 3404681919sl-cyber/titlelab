// rewrite.js —— 规则引擎改写：5 种爆款策略模板 + 主题提取 + 生成后重新打分。
import { SUSPENSE_WORDS, EMOTION_WORDS, VIOLATIONS, HOTWORDS, PERSONA_WORDS, STOPWORDS } from '../data/lexicon.js';

const STRATEGIES = [
  { key: 'number', label: '数字盘点', note: '＋具体数字，增强信息密度', build: (topic, r) => `${r(3, 30)}个${topic}小技巧，第${r(3, 15)}个超实用` },
  { key: 'suspense', label: '悬念反差', note: '换悬念句式，制造好奇', build: (topic) => `${topic}这样做的人，后来都后悔了` },
  { key: 'persona', label: '身份代入', note: '＋人群代入，精准戳痛点', build: (topic, r) => `${rnd(r, PERSONA_WORDS)}必看：${topic}一次讲透` },
  { key: 'emotion', label: '情绪共鸣', note: '＋情绪钩子，放大共鸣', build: (topic, r) => `${rnd(r, EMOTION_WORDS)}！这个${topic}也太绝了` },
  { key: 'warn', label: '避雷警示', note: '避雷警示，降低决策顾虑', build: (topic, r) => `${topic}别乱买！${r(3, 30)}个避雷点先看` }
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
  const r = (() => { let s = 20261009 >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
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
