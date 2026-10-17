/**
 * “数据深渊”的公共素材：配色、背景纹理（点阵、十六进制数据层层退向深处的隧道）。
 * 所有动画都是匀速或缓动的循环，没有跳帧闪烁。
 */
import { r1, rng } from './lib.mjs';

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

/** 一个在几个色相之间缓慢循环的渐变（SMIL 动画，颜色是连续过渡的） */
export function flowGradient(id, { x1 = 0, y1 = 0, x2 = 1, y2 = 1, dur = 18, hues = ABYSS.hues, units } = {}) {
  const cycle = (offset) => [...hues.slice(offset), ...hues.slice(0, offset), hues[offset]].join(';');
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${units ? ` gradientUnits="${units}"` : ''}>
    <stop offset="0" stop-color="${hues[0]}"><animate attributeName="stop-color" values="${cycle(0)}" dur="${dur}s" repeatCount="indefinite"/></stop>
    <stop offset="0.5" stop-color="${hues[1]}"><animate attributeName="stop-color" values="${cycle(1)}" dur="${dur}s" repeatCount="indefinite"/></stop>
    <stop offset="1" stop-color="${hues[2]}"><animate attributeName="stop-color" values="${cycle(2)}" dur="${dur}s" repeatCount="indefinite"/></stop>
  </linearGradient>`;
}

/** 细点阵背景 */
export const dotGrid = (id, color, step = 14, r = 0.7, opacity = 0.35) =>
  `<pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" fill="${color}" opacity="${opacity}"/></pattern>`;

/**
 * 数据隧道：layers 层十六进制文字平面，从消失点 (cx, cy) 一层层放大逼近镜头再消失。
 * 每层的动画相同、起点错开，所以是无缝的循环。返回 { body, css }。
 */
export function dataTunnel({ uid, W, H, cx, cy, layers = 9, dur = 26, hues = ABYSS.hues, density = 0.5 }) {
  const rand = rng(`${uid}-tunnel`);
  const cols = 34;
  const rows = 22;
  const cw = 34;
  const ch = 26;
  const planes = [];
  for (let l = 0; l < layers; l++) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        // 中间留空，像一条通道
        const dx = (c - cols / 2) / (cols / 2);
        const dy = (r - rows / 2) / (rows / 2);
        const keep = Math.hypot(dx, dy * 1.2) > 0.38 && rand() < density;
        line += keep ? Math.floor(rand() * 256).toString(16).toUpperCase().padStart(2, '0') + ' ' : '   ';
      }
      cells.push(`<text x="${-(cols * cw) / 2}" y="${r1(-(rows * ch) / 2 + r * ch)}" xml:space="preserve">${line}</text>`);
    }
    const hue = hues[l % hues.length];
    planes.push(`<g class="${uid}-plane" style="animation-delay:-${r1((l / layers) * dur)}s"><g class="mono" font-size="11" fill="${hue}">${cells.join('')}</g></g>`);
  }
  // 由远到近：scale 从很小到很大（近似 1/z 的加速），远处淡入、近处淡出
  const css = `
  .${uid}-plane { transform-origin: 0 0; animation: ${uid}-dive ${dur}s linear infinite; opacity: 0; }
  @keyframes ${uid}-dive {
    0% { transform: scale(0.05); opacity: 0; }
    35% { transform: scale(0.12); opacity: 0.16; }
    65% { transform: scale(0.36); opacity: 0.18; }
    82% { transform: scale(0.9); opacity: 0.08; }
    100% { transform: scale(3); opacity: 0; }
  }`;
  return { body: `<g transform="translate(${cx} ${cy})">${planes.join('')}</g>`, css };
}
