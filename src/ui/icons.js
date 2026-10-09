// icons.js —— 内联手写 SVG 图标集（24 viewBox / stroke 1.75 / round caps，全站唯一图标系统）。
// 统一经 renderIcons 或 iconMarkup 使用，禁止散写 SVG，禁止 emoji 作图标。
const ICONS = {
  'flask-lab': ['<path d="M10 2v6L4.6 19a2 2 0 0 0 1.8 3h11.2a2 2 0 0 0 1.8-3L14 8V2"/>', '<path d="M8.5 2h7"/>', '<path d="M7 16h10"/>'],
  'history': ['<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/>', '<path d="M3 3v5h5"/>', '<path d="M12 7v5l3 2"/>'],
  'scan-search': ['<path d="M3 7V5a2 2 0 0 1 2-2h2"/>', '<path d="M17 3h2a2 2 0 0 1 2 2v2"/>', '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/>', '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/>', '<circle cx="11" cy="11" r="4"/>', '<path d="M14 14l3 3"/>'],
  'dice-sample': ['<rect x="3" y="3" width="18" height="18" rx="3"/>', '<circle cx="8.5" cy="8.5" r="1.3"/>', '<circle cx="15.5" cy="15.5" r="1.3"/>', '<circle cx="15.5" cy="8.5" r="1.3"/>', '<circle cx="8.5" cy="15.5" r="1.3"/>'],
  'lock-local': ['<rect x="5" y="11" width="14" height="9" rx="2"/>', '<path d="M8 11V7a4 4 0 0 1 8 0v4"/>', '<path d="M12 15v2"/>'],
  'eye': ['<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>', '<circle cx="12" cy="12" r="3"/>'],
  'search-star': ['<circle cx="11" cy="11" r="6"/>', '<path d="M21 21l-3.5-3.5"/>', '<path d="M11 7.5l.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3z"/>'],
  'refresh': ['<path d="M21 12a9 9 0 1 1-2.6-6.3"/>', '<path d="M21 3v6h-6"/>'],
  'sparkles': ['<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>', '<path d="M19 15l.7 1.8L21.5 18l-1.8.7L19 20.5l-.7-1.8-1.8-.7 1.8-.7z"/>'],
  'swords-compare': ['<path d="M8 4L4 8l4 4"/>', '<path d="M4 8h13a3 3 0 0 1 3 3"/>', '<path d="M16 20l4-4-4-4"/>', '<path d="M20 16H7a3 3 0 0 1-3-3"/>'],
  'brain': ['<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-5 0v-3.5"/>', '<path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 5 0v-3.5"/>', '<path d="M7 7.5a2.5 2.5 0 1 0 0 5"/>', '<path d="M17 7.5a2.5 2.5 0 1 1 0 5"/>'],
  'chevron-down': ['<path d="M6 9l6 6 6-6"/>'],
  'github': ['<path d="M15 22v-4a4 4 0 0 0-1-2.8c3-.3 6-1.5 6-6.3a4.9 4.9 0 0 0-1.4-3.4 4.6 4.6 0 0 0-.1-3.4s-1.1-.3-3.5 1.3a12 12 0 0 0-6 0C6.5 2.1 5.4 2.4 5.4 2.4a4.6 4.6 0 0 0-.1 3.4A4.9 4.9 0 0 0 4 9.2c0 4.8 3 6 6 6.3a4 4 0 0 0-1 2.8v4"/>', '<path d="M9 19c-3 .5-3-2-5-2"/>'],
  'x-close': ['<path d="M18 6L6 18"/>', '<path d="M6 6l12 12"/>'],
  'trash': ['<path d="M3 6h18"/>', '<path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>', '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>', '<path d="M10 11v6"/><path d="M14 11v6"/>'],
  'heart-pulse': ['<path d="M22 12h-4l-3 8-4-16-3 8H2"/>'],
  'hash': ['<path d="M4 9h16"/>', '<path d="M4 15h16"/>', '<path d="M10 3L8 21"/>', '<path d="M16 3l-2 18"/>'],
  'ruler-type': ['<path d="M21 7l-14 14"/>', '<path d="M3 21l3-3"/>', '<path d="M7.5 16.5l2-2"/>', '<path d="M11 13l2-2"/>', '<path d="M14.5 9.5l2-2"/>'],
  'message-circle': ['<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-8.5-8.5A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z"/>', '<path d="M8 10h8"/>', '<path d="M8 14h5"/>'],
  'check': ['<path d="M20 6L9 17l-5-5"/>'],
  'copy': ['<rect x="9" y="9" width="11" height="11" rx="2"/>', '<path d="M5 15V5a2 2 0 0 1 2-2h10"/>'],
  'check-circle': ['<circle cx="12" cy="12" r="9"/>', '<path d="M8 12l3 3 5-6"/>'],
  'alert-note': ['<path d="M12 3l10 18H2z"/>', '<path d="M12 10v4"/>', '<path d="M12 17v.01"/>'],
  'trending-up': ['<path d="M3 17l6-6 4 4 8-8"/>', '<path d="M15 7h6v6"/>'],
  'clock': ['<circle cx="12" cy="12" r="9"/>', '<path d="M12 7v5l3 2"/>']
};

export function iconMarkup(name) {
  const paths = ICONS[name] || ICONS['check'];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.join('')}</svg>`;
}

export function renderIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = iconMarkup(el.dataset.icon);
    el.removeAttribute('data-icon');
  });
}
