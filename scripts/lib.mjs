/**
 * 生成脚本（scripts/build.mjs）和 Worker（worker/src/index.js）共用的配色、字体和小工具，
 * 保证仓库里的静态 SVG 和 Worker 实时生成的 SVG 长得一样。
 */

/** 暗色是黄昏，亮色是盛夏。ink 是赛璐璐的描线色 */
export const THEMES = {
  dark: {
    bg: '#1a1233',
    panel: '#241a45',
    fg: '#fff3e0',
    muted: '#c9b8e8',
    faint: '#8a7bb0',
    line: 'rgba(255,243,224,0.14)',
    strong: 'rgba(255,243,224,0.32)',
    ink: '#120b24',
    pink: '#ff5c8a',
    orange: '#ffb347',
    teal: '#5fe1d0',
    gold: '#ffd23f',
    box: 'rgba(18,11,36,0.84)',
    boxText: '#fff6e6',
    onPink: '#1a1233',
    sky: 'dusk',
  },
  light: {
    bg: '#fff4e2',
    panel: '#ffffff',
    fg: '#2a1b3d',
    muted: '#6b5a80',
    faint: '#a497b5',
    line: 'rgba(42,27,61,0.14)',
    strong: 'rgba(42,27,61,0.35)',
    ink: '#2a1b3d',
    pink: '#ff4f84',
    orange: '#ff9442',
    teal: '#24a9bf',
    gold: '#f2b500',
    box: 'rgba(255,255,255,0.92)',
    boxText: '#2a1b3d',
    onPink: '#ffffff',
    sky: 'day',
  },
};

/** 天色：赛璐璐的天空是一条条分色的色带，不是渐变 */
export const SKIES = {
  dusk: {
    bands: ['#1a1233', '#2e1d5c', '#5a2f86', '#a0428f', '#ff5c8a', '#ff9a3c'],
    sun: ['#ffe26a', '#ff5c8a'],
    sea: '#1d1f52',
    glint: '#ffb36b',
    clouds: [['#ff9ec4', '#ffd1e3'], ['#b062b8', '#e39ad8']],
    city: '#130c2b',
    windows: '#ffd23f',
    silhouette: '#120b24',
    rim: '#ffcf7a',
  },
  day: {
    bands: ['#2f97e0', '#46a9ea', '#62bbf2', '#86ccf6', '#acdcf9', '#d6eefc'],
    sun: ['#fffef0', '#ffe680'],
    sea: '#1f9fc0',
    glint: '#ffffff',
    clouds: [['#ffffff', '#ffffff'], ['#e6f2fc', '#ffffff']],
    city: '#3b4f7a',
    windows: '#e8f6ff',
    silhouette: '#2a1b3d',
    rim: '#ffffff',
  },
  morning: {
    bands: ['#7fb6ef', '#a3c8f2', '#c9d6f2', '#f1dbe8', '#ffd9c7', '#ffe9c2'],
    sun: ['#fffbe6', '#ffd38a'],
    sea: '#5f8fd0',
    glint: '#fff3d6',
    clouds: [['#ffe3ec', '#ffffff'], ['#f6d3e6', '#ffeef5']],
    city: '#4f5f92',
    windows: '#fff3d6',
    silhouette: '#33284f',
    rim: '#ffe7b0',
  },
  night: {
    bands: ['#05061a', '#0a0e2c', '#111843', '#19215a', '#222b70', '#2c3684'],
    sun: ['#fff7d6', '#e9e3ff'],
    sea: '#0b0f2e',
    glint: '#c9c3ff',
    clouds: [['#2a2f6e', '#3b4290'], ['#1f2458', '#2f3578']],
    city: '#05061a',
    windows: '#ffd23f',
    silhouette: '#05061a',
    rim: '#a99cff',
  },
};

/** 日本时间 → 天色 */
export const skyForHour = (h) => (h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night');

const LATIN = 'Space Grotesk';
export const FONT = {
  logo: `'LOGO', 'SG', 'Hiragino Kaku Gothic StdN', 'Noto Sans CJK JP', sans-serif`,
  serif: `'SERIF', 'Hiragino Mincho ProN', 'Noto Serif CJK JP', serif`,
  ui: `'UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif`,
  mono: `'JBM', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  display: `'SG', '${LATIN}', system-ui, sans-serif`,
};
export const SANS = FONT.ui;

/** 嵌入用到的字体（都是子集），并给出公用 class。只传这张图用得到的字体，图会小一点 */
export const baseStyle = (fonts) => {
  const face = (family, data, weight) =>
    data ? `@font-face { font-family: '${family}'; src: url(data:font/woff2;base64,${data}) format('woff2'); font-weight: ${weight}; }` : '';
  return `
  ${face('SG', fonts.grotesk, '300 700')}
  ${face('JBM', fonts.mono, '100 800')}
  ${face('LOGO', fonts.logo, '900')}
  ${face('SERIF', fonts.serif, '900')}
  ${face('UI', fonts.ui, '500')}
  .mono { font-family: ${FONT.mono}; }
  .display { font-family: ${FONT.display}; font-weight: 700; }
  .logo { font-family: ${FONT.logo}; font-weight: 900; }
  .serif { font-family: ${FONT.serif}; font-weight: 900; }
  .ui { font-family: ${FONT.ui}; font-weight: 500; }
  .sans { font-family: ${FONT.ui}; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;
};

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
