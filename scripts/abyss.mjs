/**
 * “数据深渊”的公共素材：配色、流转的渐变、点阵背景纹理。
 * 所有动画都是匀速或缓动的循环，没有跳帧闪烁。
 */
/** 深色为主；颜色在几个低饱和的色相之间缓慢流转 */
export const ABYSS = {
  bg: '#06080d',
  bg2: '#0a0e17',
  ink: '#dfe6f2',
  mid: '#7d8aa3',
  faint: '#2c3548',
  line: 'rgba(160,180,220,0.12)',
  hues: ['#5b6cff', '#2ad1c9', '#d65bd6', '#f0b35a'],
  indigo: '#5b6cff',
  teal: '#2ad1c9',
  magenta: '#d65bd6',
  amber: '#f0b35a',
};

/**
 * 浅色版（GitHub 浅色主题用）：纸一样的浅底，墨色的线；色相和深色版一一对应，只是更深、更稳，
 * 在白底上才压得住。
 */
export const PAPER = {
  bg: '#f7f8fb',
  bg2: '#eef1f6',
  ink: '#1c2333',
  mid: '#8a93a6',
  faint: '#c9cfda',
  line: 'rgba(40,52,80,0.14)',
  hues: ['#3f4bd1', '#0f8f8a', '#a8329f', '#b8730f'],
  indigo: '#3f4bd1',
  teal: '#0f8f8a',
  magenta: '#a8329f',
  amber: '#b8730f',
};

export const palette = (theme) => (theme === 'light' ? PAPER : ABYSS);

/** 一个在几个色相之间缓慢循环的渐变（SMIL 动画，颜色是连续过渡的）；still 时不动，只是几个色相铺开 */
export function flowGradient(id, { x1 = 0, y1 = 0, x2 = 1, y2 = 1, dur = 18, hues = ABYSS.hues, units, still = false } = {}) {
  const cycle = (offset) => [...hues.slice(offset), ...hues.slice(0, offset), hues[offset]].join(';');
  const stop = (offset, k) => `<stop offset="${offset}" stop-color="${hues[k]}">${still ? '' : `<animate attributeName="stop-color" values="${cycle(k)}" dur="${dur}s" repeatCount="indefinite"/>`}</stop>`;
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${units ? ` gradientUnits="${units}"` : ''}>
    ${stop(0, 0)}${stop(0.5, 1)}${stop(1, 2)}
  </linearGradient>`;
}

/** 细点阵背景 */
export const dotGrid = (id, color, step = 14, r = 0.7, opacity = 0.35) =>
  `<pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" fill="${color}" opacity="${opacity}"/></pattern>`;
