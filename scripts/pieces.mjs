/**
 * 主页上的各个画面（scripts/build.mjs 生成静态 SVG）。统一的视觉语言：
 * “数据深渊”底、细点阵纹理、细线、大量留白，没有文字；颜色在几个低饱和色相之间流转。
 * 所有画面都只靠 CSS / SMIL 动画自己播放，不需要交互。
 * 每个画面都有深色（默认）和浅色（theme: 'light'，GitHub 浅色主题用）两版，构图一样，只换配色。
 */
import { dotGrid, flowGradient, palette } from './abyss.mjs';
import { faceLayer } from './face.mjs';
import { r1, rng } from './lib.mjs';
import { hologramRose } from './rose.mjs';
import { singularity } from './singularity.mjs';
import { sonarField } from './sonar.mjs';

/** 所有画面共用的外框：圆角、点阵纹理、暗角 */
function panel({ W, H, uid, body, C, css = '', defs = '', fonts = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${fonts}${css}
  .spin { animation: spin linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
  .fade { animation: fade 1.4s 0.2s ease both; }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<defs>
  ${dotGrid(`${uid}-dots`, C.mid, 16, 0.7, 0.22)}
  <radialGradient id="${uid}-vig" cx="0.5" cy="0.5" r="0.8"><stop offset="0.5" stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0.85"/></radialGradient>
  <clipPath id="${uid}-frame"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  ${defs}
</defs>
<g clip-path="url(#${uid}-frame)">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#${uid}-dots)"/>
  ${body}
  <rect width="${W}" height="${H}" fill="url(#${uid}-vig)" pointer-events="none"/>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="13.5" fill="none" stroke="${C.line}"/>
</svg>
`;
}

// ---------- 片头 ----------

/** 片头：三张 ASCII 肖像轮流从暗处浮现又消散，周围只有暗处 */
export function headerPanel({ faces, fonts, theme = 'dark' }) {
  const C = palette(theme);
  const W = 1200;
  const H = 620;
  const face = faceLayer({ faces, size: 5.8, cx: 600, cy: 310, theme });
  const body = `
  <radialGradient id="hd-glow" cx="0.5" cy="0.5" r="0.45"><stop offset="0" stop-color="${C.indigo}" stop-opacity="${theme === 'light' ? 0.06 : 0.1}"/><stop offset="1" stop-color="${C.indigo}" stop-opacity="0"/></radialGradient>
  <rect width="${W}" height="${H}" fill="url(#hd-glow)"/>
  ${face.body}`;
  return panel({ W, H, uid: 'head', C, body, defs: face.defs, css: face.css, fonts });
}

// ---------- 全息玫瑰 ----------

/** 投影台上一朵自己开、自己谢的线框玫瑰 */
export function rosePanel({ theme = 'dark' } = {}) {
  const C = palette(theme);
  const light = theme === 'light';
  const W = 1200;
  const H = 560;
  const cx = 600;
  const cy = 200;
  const rose = hologramRose({ cx, cy, scale: 140, stroke: 'url(#rose-ink)', glow: C.magenta, glowOpacity: light ? 0.08 : 0.13 });
  const by = rose.baseY;
  const rx = 112;
  const ry = r1(rx * 0.41);
  const ring = (r, extra = '') => `<ellipse cx="${cx}" cy="${by}" rx="${r1(r)}" ry="${r1(r * 0.41)}" fill="none" ${extra}/>`;
  const cone = `M${cx - 92} ${by}L${cx - 190} 70L${cx + 190} 70L${cx + 92} ${by}Z`;
  const ink = light ? ['#d0306a', '#b8205a', '#9a34b0', '#d4553e'] : ['#ff86b0', '#ff6f9c', '#e070e0', '#ffa08a'];
  const defs = `${rose.defs}
    ${flowGradient('rose-ink', { x1: 420, y1: 60, x2: 780, y2: by, units: 'userSpaceOnUse', dur: 16, hues: ink })}
    <linearGradient id="rose-cone" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.teal}" stop-opacity="${light ? 0.1 : 0.13}"/><stop offset="0.55" stop-color="${C.indigo}" stop-opacity="0.04"/><stop offset="1" stop-color="${C.indigo}" stop-opacity="0"/></linearGradient>
    <radialGradient id="rose-pool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.teal}" stop-opacity="${light ? 0.14 : 0.22}"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/></radialGradient>
    <pattern id="rose-scan" width="8" height="4" patternUnits="userSpaceOnUse"><rect width="8" height="1" fill="${C.ink}" opacity="${light ? 0.05 : 0.07}"/><animateTransform attributeName="patternTransform" type="translate" values="0 0;0 -4" dur="0.9s" repeatCount="indefinite"/></pattern>
    <clipPath id="rose-cone-clip"><path d="${cone}"/></clipPath>`;
  const body = `
  <g class="fade">
    <path d="${cone}" fill="url(#rose-cone)"/>
    <g clip-path="url(#rose-cone-clip)"><rect x="${cx - 200}" y="60" width="400" height="${by - 50}" fill="url(#rose-scan)"/></g>
    <ellipse cx="${cx}" cy="${by}" rx="${rx * 1.5}" ry="${r1(ry * 1.5)}" fill="url(#rose-pool)"/>
    <g stroke="${C.teal}" stroke-width="1">${ring(rx, 'opacity="0.5"')}${ring(rx * 0.72, 'opacity="0.3"')}${ring(rx * 1.32, 'opacity="0.16" stroke-dasharray="1 5"')}</g>
    <g transform="translate(${cx} ${by}) scale(1 0.41)"><g class="spin" style="animation-duration:22s"><circle r="${rx * 0.86}" fill="none" stroke="${C.teal}" stroke-width="2" stroke-dasharray="2 14" opacity="0.6"/><circle r="${rx * 1.12}" fill="none" stroke="${C.indigo}" stroke-width="1" stroke-dasharray="30 60" opacity="0.5"/></g></g>
  </g>
  <g class="flicker">${rose.body}</g>`;
  const css = `
  .flicker { animation: flicker 9s steps(1, end) infinite; }
  @keyframes flicker { 0%, 100% { opacity: 1; } 93% { opacity: 0.72; } 94% { opacity: 1; } 96.5% { opacity: 0.86; } 97.5% { opacity: 1; } }`;
  return panel({ W, H, uid: 'rose', C, body, defs, css });
}

// ---------- 声呐 ----------

/** 一年的提交堆成的地形退进黑暗，声呐脉冲一遍遍往深处扫。weeks: 每周七天的提交数，最近的一周在前 */
export function sonarPanel({ weeks, theme = 'dark' }) {
  const C = palette(theme);
  const light = theme === 'light';
  const W = 1200;
  const H = 380;
  const horizon = 104;
  const field = sonarField({ uid: 'sn', W, H, weeks, horizon, colors: { bg: C.bg, near: C.teal, far: C.indigo, pulse: light ? '#063f3c' : '#c8fbf5', target: C.amber } });
  const defs = `<linearGradient id="sn-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.indigo}" stop-opacity="0"/><stop offset="0.7" stop-color="${C.indigo}" stop-opacity="${light ? 0.03 : 0.05}"/><stop offset="1" stop-color="${C.indigo}" stop-opacity="${light ? 0.08 : 0.12}"/></linearGradient>
    <radialGradient id="sn-src" cx="0.5" cy="1" r="0.5"><stop offset="0" stop-color="${C.teal}" stop-opacity="${light ? 0.18 : 0.3}"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/></radialGradient>`;
  // 脚下的声源：几道弧一圈圈往外扩
  const arcs = [0, 1, 2].map((i) => `<ellipse class="sn-src" style="animation-delay:${-i * 0.6}s" cx="600" cy="${H + 6}" rx="180" ry="60" fill="none" stroke="${C.teal}" stroke-width="1"/>`).join('');
  const body = `
  <rect y="0" width="${W}" height="${horizon + 2}" fill="url(#sn-sky)"/>
  ${field.body}
  <ellipse cx="600" cy="${H}" rx="320" ry="90" fill="url(#sn-src)"/>
  <g>${arcs}</g>`;
  const css = `${field.css}
  .sn-src { transform-origin: 600px ${H + 6}px; animation: sn-src 1.8s cubic-bezier(0.2, 0.6, 0.3, 1) infinite; opacity: 0; }
  @keyframes sn-src { from { transform: scale(0.2); opacity: 0.7; } to { transform: scale(1.4); opacity: 0; } }`;
  return panel({ W, H, uid: 'sonar', C, body, defs, css });
}

// ---------- 奇点 ----------

/** 一个由数据粒子组成吸积盘的黑洞，几乎侧着看 */
export function singularityPanel({ theme = 'dark' } = {}) {
  const C = palette(theme);
  const light = theme === 'light';
  const W = 1200;
  const H = 560;
  const bh = singularity({
    uid: 'bh',
    cx: 600,
    cy: 280,
    Rs: 64,
    colors: light
      ? { bg: C.bg, hot: '#8a4a0c', warm: '#b8730f', heat: ['#5a2a00', '#8a4a0c', '#b8730f', '#c4442f', '#a8329f', '#5a45c8', '#3f4bd1'] }
      : { bg: C.bg, hot: '#ffe7c2', warm: '#f0b35a', heat: ['#fff3dc', '#ffd08a', '#f0b35a', '#ff7a6a', '#d65bd6', '#8a6cff', '#5b6cff'] },
  });
  const rand = rng('bh-stars');
  const stars = Array.from({ length: 140 }, () => `<circle cx="${r1(rand() * W)}" cy="${r1(rand() * H)}" r="${r1(0.3 + rand() * 0.8)}" opacity="${r1((0.15 + rand() * 0.45) * (light ? 0.6 : 1))}"/>`).join('');
  const body = `
  <g fill="${C.ink}">${stars}</g>
  ${bh.body}`;
  return panel({ W, H, uid: 'sing', C, body, defs: bh.defs, css: bh.css });
}
