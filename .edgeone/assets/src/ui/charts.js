// charts.js —— 手写 SVG 折线图（训练 loss 收敛曲线）。
export function lossChart(lrHist, mlpHist, { width = 560, height = 160 } = {}) {
  const pad = { l: 34, r: 12, t: 12, b: 22 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;

  const toPath = (arr, color) => {
    if (!arr || arr.length < 2) return '';
    const max = Math.max(...arr), min = Math.min(...arr);
    const span = max - min || 1;
    const pts = arr.map((v, i) => {
      const x = pad.l + (i / (arr.length - 1)) * w;
      const y = pad.t + ((v - min) / span) * h;
      return [x, y];
    });
    const d = pts.map((p, i) => (i === 0 ? `M${p[0].toFixed(1)},${p[1].toFixed(1)}` : `L${p[0].toFixed(1)},${p[1].toFixed(1)}`)).join(' ');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`;
  };

  const maxY = Math.max(...(lrHist || [0]), ...(mlpHist || [0])) * 1.1;
  const yLabels = [0, 0.5, 1].map(f => {
    const y = pad.t + (1 - f) * h;
    return `<line x1="${pad.l}" y1="${y}" x2="${pad.l + w}" y2="${y}" stroke="var(--border-soft)" stroke-width="1"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="训练损失收敛曲线" style="width:100%;height:auto">
    ${yLabels}
    ${toPath(lrHist, 'var(--info)')}
    ${toPath(mlpHist, 'var(--accent)')}
  </svg>`;
}
