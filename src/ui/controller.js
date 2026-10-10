// controller.js —— 应用入口：状态机 + 事件绑定 + 渲染。
import { train, trainFromSamples } from '../core/trainer.js';
import { displayLength } from '../core/preprocess.js';
import { FEATURE_NAMES } from '../core/numeric-features.js';
import { analyze, analyzeRule } from '../services/predict.js';
import { generateVariants } from '../services/rewrite.js';
import { addHistory, loadHistory, removeHistory, clearHistory } from '../services/history.js';
import { DATASET_DISCLAIMER } from '../data/dataset.js';
import { iconMarkup, renderIcons } from './icons.js';
import { lossChart } from './charts.js';

const $ = (id) => document.getElementById(id);
const ic = (n, cls = '') => `<span class="ic ${cls}">${iconMarkup(n)}</span>`;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EXAMPLES = [
  '5个让你越睡越累的坏习惯，第3个你肯定中招',
  '黄黑皮天菜！这只橘棕色口红真的巨显白',
  '租房千万别踩这8个坑，都是血泪教训',
  '打工人下班做这3件事，半年后拉开差距',
  '谁懂啊！这招让家里多出了10平米，房东看了都沉默'
];

const SCORE_COLORS = { viral: 'var(--score-viral)', good: 'var(--score-good)', mid: 'var(--score-mid)', low: 'var(--score-low)' };

const state = { model: null, degraded: false, category: '通用', lastInput: '', lastResult: null, compareVariant: null, generating: false };

function analyzeFn(text) {
  return state.model ? analyze(state.model, text, state.category) : analyzeRule(text, state.category);
}
function scoreFn(text) {
  if (state.model) return state.model.scoreProb(state.model.prepareInput(text)).p;
  return analyzeRule(text, state.category).prob;
}

/* ---------- 训练 ---------- */
async function startTraining() {
  const bar = $('train-bar');
  bar.hidden = false;
  const t0 = performance.now();
  try {
    state.model = await train((p) => {
      $('train-text').textContent = p.text;
      $('train-pct').textContent = Math.round(p.pct * 100) + '%';
      $('train-fill').style.width = (p.pct * 100) + '%';
    });
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    setBadge('ready', `模型已就绪 · ${secs}s`);
    renderTransparency(secs);
    setTimeout(() => { bar.hidden = true; }, 400);
  } catch (err) {
    console.error('[TitleLab] 训练失败，降级为规则评分：', err);
    state.degraded = true;
    setBadge('degraded', '规则降级模式');
    $('train-text').textContent = '模型训练失败，已切换规则评分';
    setTimeout(() => { bar.hidden = true; }, 1500);
    $('dataset-disclaimer').textContent = '模型不可用，当前为规则降级评分。' + DATASET_DISCLAIMER;
  }
  updateAnalyzeState();
}

/* ---------- 真实数据导入重训 ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}

async function importCSV(file) {
  const status = $('import-status');
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('CSV 为空');
    const start = /标题|title/i.test(rows[0].join(',')) ? 1 : 0; // 首行含"标题"视为表头
    const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
    const items = [];
    const seen = new Set();
    for (let i = start; i < rows.length; i++) {
      const title = (rows[i][0] || '').trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      const like = num(rows[i][1]), fav = num(rows[i][2]), com = num(rows[i][3]);
      items.push({ text: title, e: like + 2 * fav + 3 * com });
    }
    if (items.length < 40) { status.textContent = `有效样本 ${items.length} 条，不足 40 条，请先导出更多数据`; return; }
    const es = items.map(x => x.e).sort((a, b) => a - b);
    const median = es[Math.floor(es.length / 2)];
    if (median <= 0) throw new Error('互动数据全为 0，无法按互动分档，请检查点赞/收藏/评论列');
    const raw = items.map(x => ({ text: x.text, label: x.e >= median ? 1 : 0, category: state.category }));
    const posCount = raw.filter(x => x.label === 1).length;
    status.textContent = `已加载 ${raw.length} 条真实样本，正在本机重训…`;
    $('train-bar').hidden = false;
    const t0 = performance.now();
    state.model = await trainFromSamples(raw, (p) => {
      $('train-text').textContent = p.text;
      $('train-pct').textContent = Math.round(p.pct * 100) + '%';
      $('train-fill').style.width = (p.pct * 100) + '%';
    });
    state.degraded = false;
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    setBadge('ready', `已用真实数据重训 · ${raw.length}条`);
    renderTransparency(secs);
    $('dataset-disclaimer').textContent =
      `当前模型由你导入的 ${raw.length} 条真实互动数据训练（爆款档 ${posCount} 条）。互动口径：点赞 + 2×收藏 + 3×评论，按中位数分档；数据只在本机处理。评分仅为概率参考，不构成爆款保证。`;
    $('train-bar').hidden = true;
    status.textContent = `重训完成：${raw.length} 条真实样本（爆款档 ${posCount} 条），耗时 ${secs}s`;
    toast('真实数据重训完成');
  } catch (err) {
    console.error('[TitleLab] CSV 导入失败：', err);
    status.textContent = '导入失败：' + err.message;
  }
}

function setBadge(stateName, text) {
  const b = $('model-badge');
  b.dataset.state = stateName;
  $('model-badge-text').textContent = text;
}

/* ---------- 渲染 ---------- */
function renderTransparency(secs) {
  const r = state.model.report;
  $('metrics').innerHTML = [
    ['准确率', (r.acc * 100).toFixed(1) + '%'],
    ['AUC', r.auc.toFixed(3)],
    ['F1', r.f1.toFixed(3)],
    ['训练耗时', secs + 's'],
    ['样本量', r.sampleCount + ' 条']
  ].map(([k, v]) => `<div class="metric"><b>${v}</b><span>${k}</span></div>`).join('');

  const lrW = state.model.lr.wDense;
  const rows = FEATURE_NAMES.map((n, i) => ({ n, v: lrW[i] }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 10);
  const max = Math.max(...rows.map(x => Math.abs(x.v))) || 1;
  $('weight-list').innerHTML = rows.map(x => {
    const w = Math.abs(x.v) / max * 100;
    const cls = x.v >= 0 ? 'pos' : 'neg';
    return `<div class="weight-row"><span class="weight-name" title="${esc(x.n)}">${esc(x.n)}</span>
      <div class="weight-track"><div class="weight-fill ${cls}" style="width:${w}%"></div></div>
      <span class="dim-val">${x.v >= 0 ? '+' : ''}${x.v.toFixed(3)}</span></div>`;
  }).join('');

  const chart = $('metrics').parentElement;
  chart.insertAdjacentHTML('beforeend',
    `<h3 class="panel-h">训练损失收敛</h3>` + lossChart(state.model.lr.lossHist, state.model.mlp.trainLossHist));
  $('dataset-disclaimer').textContent = DATASET_DISCLAIMER;
}

function show(el) {
  el.hidden = false;
  el.classList.remove('in');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
}

function renderResult(res) {
  const numEl = $('score-num');
  animateNumber(numEl, res.score, 500);
  numEl.style.color = SCORE_COLORS[res.grade.key];
  const gradeEl = $('grade');
  gradeEl.textContent = res.grade.label;
  gradeEl.className = 'grade ' + res.grade.key;
  $('percentile').textContent = `同赛道分位 ${res.percentile}%`;
  $('open-score').textContent = res.openScore;
  $('search-score').textContent = res.searchScore;
  $('strengths').innerHTML = res.strengths.map(s => `<div class="strength">${ic('check-circle')}${esc(s)}</div>`).join('');
  $('result-note').textContent = res.degraded
    ? '当前为规则降级评分（模型未就绪）'
    : (res.adFlag
      ? `疑似广告投流/软文：命中 ${res.marketingHits.length} 个营销话术，新号易被当广告划走`
      : (res.violations.length ? `命中 ${res.violations.length} 个违禁词，基础检测供参考，发布前建议专业工具复核` : '基于本地模型预测，概率参考'));
  show($('result'));
}

function renderSuggestions(res) {
  const list = res.suggestions || [];
  $('suggestions-list').innerHTML = list.map(s => `
    <div class="suggestion ${s.icon === 'alert-note' ? 'warn' : ''}">
      <div class="suggestion-title">${ic(s.icon)}${esc(s.title)}</div>
      <p class="suggestion-text">${esc(s.text)}</p>
    </div>`).join('');
  show($('suggestions'));
}

function renderDimensions(res) {
  $('title-replay').innerHTML = highlightHTML(res.highlights) || '（未输入内容）';
  $('dims').innerHTML = res.dimensions.map(d => `
    <div class="dim">
      <div class="dim-head">
        <span class="dim-name">${ic(d.icon)}${esc(d.name)}</span>
        <span class="dim-val">${d.score} · ${d.status}</span>
      </div>
      <div class="dim-bar"><div class="dim-fill" data-w="${d.score}"></div></div>
      <p class="dim-note">${esc(d.note)}</p>
    </div>`).join('');
  show($('dimensions'));
  requestAnimationFrame(() => {
    document.querySelectorAll('.dim-fill').forEach(f => { f.style.width = f.dataset.w + '%'; });
  });
}

function highlightHTML(highlights) {
  const src = state.lastInput;
  if (!src) return '（未输入内容）';
  const ranges = [];
  for (const h of highlights || []) {
    let idx = src.indexOf(h.word);
    while (idx !== -1) { ranges.push({ s: idx, e: idx + h.word.length, type: h.type }); idx = src.indexOf(h.word, idx + 1); }
  }
  ranges.sort((a, b) => a.s - b.s || b.e - a.e);
  const merged = [];
  for (const r of ranges) { const last = merged[merged.length - 1]; if (last && r.s < last.e) continue; merged.push(r); }
  let out = '', pos = 0;
  for (const r of merged) {
    out += esc(src.slice(pos, r.s));
    if (r.type === 'violation') out += `<mark class="vio">${esc(src.slice(r.s, r.e))}</mark>`;
    else if (r.type === 'marketing') out += `<mark class="mkt">${esc(src.slice(r.s, r.e))}</mark>`;
    else out += `<mark>${esc(src.slice(r.s, r.e))}</mark>`;
    pos = r.e;
  }
  out += esc(src.slice(pos));
  return out;
}

function renderVariants(variants, originalScore) {
  $('variants-list').innerHTML = variants.map(v => {
    const delta = v.predictedScore - originalScore;
    const deltaTxt = delta >= 0 ? `+${delta}` : `${delta}`;
    return `<div class="variant">
      <span class="variant-strategy">${ic('sparkles')}${esc(v.strategy)}</span>
      <div class="variant-text">${esc(v.text)}</div>
      <div class="variant-change">${esc(v.changeNote)}</div>
      <div class="variant-score">预估 ${v.predictedScore} 分 <span class="delta">（${deltaTxt}）</span></div>
      <div class="variant-actions">
        <button class="btn btn-outline btn-sm" data-copy="${esc(v.text)}" type="button">${ic('copy')}复制</button>
        <button class="btn btn-ghost btn-sm" data-compare="${esc(v.text)}" type="button">${ic('swords-compare')}对比</button>
      </div>
    </div>`;
  }).join('');
  show($('variants'));
  $('variants-list').querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copyText(b.dataset.copy)));
  $('variants-list').querySelectorAll('[data-compare]').forEach(b => b.addEventListener('click', () => startCompare(b.dataset.compare)));
}

function renderAB(original, variantText) {
  const vRes = analyzeFn(variantText);
  const diff = Math.abs(vRes.score - original.score);
  const originalWin = original.score > vRes.score;
  const tie = diff < 2;
  const mkCol = (res, label, win) => `
    <div class="ab-col ${win ? 'winner' : ''}">
      <div class="ab-label">${esc(label)}${win && !tie ? '<span class="ab-win-badge">领先</span>' : ''}</div>
      <div class="ab-text">${esc(label === '原题' ? state.lastInput : variantText)}</div>
      <div class="ab-score" style="color:${SCORE_COLORS[res.grade.key]}">${res.score}<span class="price-unit" style="font-size:14px"> /100</span></div>
      <div class="ab-dims">${res.dimensions.map(d => `
        <div class="ab-dim">
          <div class="ab-dim-label"><span>${esc(d.name)}</span><span>${d.score}</span></div>
          <div class="ab-dim-track"><div class="ab-dim-fill" style="width:${d.score}%"></div></div>
        </div>`).join('')}
      </div>
    </div>`;
  $('ab-wrap').innerHTML = tie
    ? mkCol(original, '原题', false) + mkCol(vRes, '变体', false) + `<div class="ab-tie">分差仅 ${diff}，势均力敌，看封面定胜负</div>`
    : (originalWin
      ? mkCol(original, '原题', true) + mkCol(vRes, '变体', false)
      : mkCol(original, '原题', false) + mkCol(vRes, '变体', true));
  show($('ab'));
  $('ab').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- 动作 ---------- */
function runAnalyze() {
  const text = $('title-input').value.trim();
  if (!text) return;
  state.lastInput = text;
  const res = analyzeFn(text);
  state.lastResult = res;
  renderResult(res);
  renderDimensions(res);
  renderSuggestions(res);
  state.compareVariant = null;
  $('ab').hidden = true;
  $('variants').hidden = true;
  addHistory({ text, score: res.score, grade: res.grade.label, ts: Date.now() });
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function runOptimize() {
  if (state.generating) return;
  const text = state.lastInput || $('title-input').value.trim();
  if (!text) return;
  state.generating = true;
  const btn = $('optimize-btn');
  btn.disabled = true;
  $('variants').hidden = false;
  $('variants-list').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  await new Promise(r => setTimeout(r, 350));
  try {
    const variants = generateVariants(scoreFn, text, state.category);
    const originalScore = state.lastResult ? state.lastResult.score : Math.round(scoreFn(text) * 100);
    renderVariants(variants, originalScore);
  } finally {
    state.generating = false;
    btn.disabled = false;
    $('variants').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function startCompare(variantText) {
  if (!state.lastResult) { runAnalyze(); }
  renderAB(state.lastResult, variantText);
}

function copyText(text) {
  const done = () => toast('已复制');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch { toast('复制失败，请手动复制'); }
  document.body.removeChild(ta);
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 200); }, 1200);
}

function animateNumber(el, target, dur) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = target; return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(eased * target);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- 历史 ---------- */
function renderHistory() {
  const list = $('history-list');
  const h = loadHistory();
  if (!h.items.length) {
    list.innerHTML = '<div class="history-empty">还没有检测记录——你的第一条爆款标题从上面开始</div>';
    return;
  }
  list.innerHTML = h.items.map(it => `
    <div class="history-item" data-ts="${it.ts}">
      <button class="history-del" data-del="${it.ts}" type="button" aria-label="删除">${ic('x-close', '')}</button>
      <div class="history-item-top"><span class="history-score">${it.score}分</span><span class="history-time">${fmtTime(it.ts)}</span></div>
      <div class="history-text">${esc(it.text)}</div>
    </div>`).join('');
  list.querySelectorAll('.history-item').forEach(el => el.addEventListener('click', () => {
    const it = h.items.find(x => x.ts === Number(el.dataset.ts));
    if (it) { $('title-input').value = it.text; onInput(); runAnalyze(); closeDrawer(); }
  }));
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); removeHistory(Number(b.dataset.del)); renderHistory();
  }));
}
function fmtTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function openDrawer() { renderHistory(); $('history-drawer').classList.add('open'); $('drawer-backdrop').hidden = false; requestAnimationFrame(() => $('drawer-backdrop').classList.add('show')); }
function closeDrawer() { $('history-drawer').classList.remove('open'); $('drawer-backdrop').classList.remove('show'); setTimeout(() => { $('drawer-backdrop').hidden = true; }, 200); }

/* ---------- 输入 ---------- */
function onInput() {
  const text = $('title-input').value;
  const len = displayLength(text);
  const c = $('char-count');
  c.textContent = `${len}/20`;
  c.classList.toggle('warn', len > 20);
  updateAnalyzeState();
}
function updateAnalyzeState() {
  const hasText = $('title-input').value.trim().length > 0;
  $('analyze-btn').disabled = !hasText;
}

/* ---------- 事件绑定 ---------- */
function bind() {
  $('title-input').addEventListener('input', onInput);
  $('analyze-btn').addEventListener('click', runAnalyze);
  $('retest-btn').addEventListener('click', runAnalyze);
  $('optimize-btn').addEventListener('click', runOptimize);
  $('sample-btn').addEventListener('click', () => {
    $('title-input').value = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    onInput(); runAnalyze();
  });
  $('history-toggle').addEventListener('click', openDrawer);
  $('history-close').addEventListener('click', closeDrawer);
  $('drawer-backdrop').addEventListener('click', closeDrawer);
  $('history-clear').addEventListener('click', () => { clearHistory(); renderHistory(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  $('free-cta').addEventListener('click', () => $('input').scrollIntoView({ behavior: 'smooth' }));
  $('pro-cta').addEventListener('click', () => toast('Pro 为商业化规划，Demo 全功能免费体验'));
  $('import-csv').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importCSV(f); e.target.value = ''; });

  document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.category = chip.dataset.cat;
    if (state.lastInput) runAnalyze();
  }));
}

function init() {
  renderIcons(document);
  bind();
  onInput();
  startTraining();
}

init();
