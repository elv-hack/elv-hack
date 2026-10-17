/**
 * 生成脚本（scripts/build.mjs）和 Worker（worker/src/index.js）共用的配色、字体和小工具，
 * 保证仓库里的静态 SVG 和 Worker 实时生成的 SVG 长得一样。
 */

/** 暗色：荧光绿 + 洋红错位；亮色：暖白纸 + 国际橙，套印蓝做错版 */
export const THEMES = {
  dark: {
    bg: '#060708',
    panel: '#0d0f12',
    fg: '#ecebe6',
    muted: '#9b9b95',
    faint: '#55575b',
    line: 'rgba(236,235,230,0.10)',
    strong: 'rgba(236,235,230,0.24)',
    accent: '#c6ff3d',
    alt: '#ff2e88',
    onAccent: '#060708',
    stripBg: '#c6ff3d',
    stripFg: '#060708',
    blend: 'screen',
  },
  light: {
    bg: '#f3efe6',
    panel: '#fbf9f4',
    fg: '#111110',
    muted: '#5c5750',
    faint: '#a29b90',
    line: 'rgba(17,17,16,0.12)',
    strong: 'rgba(17,17,16,0.3)',
    accent: '#ff5a1f',
    alt: '#2a5d8f',
    onAccent: '#111110',
    stripBg: '#111110',
    stripFg: '#f3efe6',
    blend: 'multiply',
  },
};

export const SANS = `'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', system-ui, sans-serif`;

/** 嵌入字体（只含 ASCII 的子集）+ 公用 class */
export const baseStyle = ({ mono, grotesk }) => `
  @font-face { font-family: 'SG'; src: url(data:font/woff2;base64,${grotesk}) format('woff2'); font-weight: 300 700; }
  @font-face { font-family: 'JBM'; src: url(data:font/woff2;base64,${mono}) format('woff2'); font-weight: 100 800; }
  .mono { font-family: 'JBM', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .display { font-family: 'SG', 'JBM', system-ui, sans-serif; font-weight: 700; }
  .sans { font-family: ${SANS}; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const r1 = (n) => Math.round(n * 10) / 10;

export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** 确定性的伪随机数序列 */
export function rng(seed) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由字符串决定的一段条形码 */
export function barcode(seed, x, y, width, height, color) {
  const rand = rng(seed);
  const bars = [];
  let cx = x;
  while (cx < x + width) {
    const w = 1 + Math.floor(rand() * 3);
    if (rand() > 0.38) bars.push(`<rect x="${r1(cx)}" y="${y}" width="${w}" height="${height}"/>`);
    cx += w + 1 + Math.floor(rand() * 2);
  }
  return `<g fill="${color}">${bars.join('')}</g>`;
}

/** 印刷对位标：圆 + 十字 */
export const regMark = (x, y, r, color) =>
  `<g fill="none" stroke="${color}" stroke-width="1"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x - r * 1.7} ${y}H${x + r * 1.7}M${x} ${y - r * 1.7}V${y + r * 1.7}"/></g>`;

/** 粗略估算文字宽度：中日韩字符按 1em，其余按 0.56em */
export const textWidth = (s, size) => [...s].reduce((w, ch) => w + (ch.codePointAt(0) > 0x2e80 ? size : size * 0.56), 0);

/** 等宽字（JetBrains Mono 每个字符 0.6em） */
export const monoWidth = (s, size) => s.length * size * 0.6;

/** 按宽度折行，最多 lines 行，超出加省略号 */
export function wrap(text, size, width, lines) {
  const tokens = text.match(/[⺀-￿]|[^\s⺀-￿]+|\s+/g) ?? [];
  const out = [''];
  for (const token of tokens) {
    const line = out[out.length - 1];
    if (textWidth(line + token, size) <= width) out[out.length - 1] = line + token;
    else if (/^\s+$/.test(token)) out.push('');
    else out.push(token);
  }
  const result = out.map((l) => l.trim()).filter(Boolean);
  if (result.length > lines) {
    let last = result[lines - 1];
    while (textWidth(`${last}…`, size) > width) last = [...last].slice(0, -1).join('');
    result.length = lines;
    result[lines - 1] = `${last.trimEnd()}…`;
  }
  return result;
}
