// history.js —— localStorage 历史记录（50 条上限，数据不出浏览器）。
const KEY = 'titlelab:history';
const MAX = 50;

function isBrowser() { return typeof localStorage !== 'undefined'; }

export function loadHistory() {
  if (!isBrowser()) return { items: [] };
  try { return JSON.parse(localStorage.getItem(KEY)) || { items: [] }; }
  catch { return { items: [] }; }
}

function persist(h) {
  if (!isBrowser()) return;
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* 静默降级 */ }
}

export function addHistory(item) {
  const h = loadHistory();
  h.items = h.items.filter(i => i.text !== item.text); // 去重
  h.items.unshift(item);
  if (h.items.length > MAX) h.items.length = MAX;
  persist(h);
  return h;
}

export function removeHistory(ts) {
  const h = loadHistory();
  h.items = h.items.filter(i => i.ts !== ts);
  persist(h);
  return h;
}

export function clearHistory() {
  persist({ items: [] });
  return { items: [] };
}
