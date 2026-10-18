/**
 * 主页上的各个画面（scripts/build.mjs 生成静态 SVG）。统一的视觉语言：
 * 深色“数据深渊”底、细点阵纹理、细线、大量留白，没有文字；颜色在几个低饱和色相之间缓慢流转。
 * 所有画面都只靠 CSS / SMIL 动画自己播放，不需要交互。
 */
import { ABYSS as C, dotGrid, flowGradient } from './abyss.mjs';
import { faceLayer } from './face.mjs';
import { hologramRose } from './rose.mjs';
import { singularity } from './singularity.mjs';
import { sonarField } from './sonar.mjs';
import { FORM_CSS, spinForm } from './forms.mjs';
import { r1, rng } from './lib.mjs';

/** 所有画面共用的外框：圆角、点阵纹理、暗角 */
function panel({ W, H, uid, body, css = '', defs = '', fonts = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${fonts}${FORM_CSS}${css}
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

// ---------- 全息玫瑰 ----------

/** 投影台上一朵自己开、自己谢的线框玫瑰 */
export function rosePanel() {
  const W = 1200;
  const H = 560;
  const cx = 600;
  const cy = 200;
  const rose = hologramRose({ cx, cy, scale: 140, stroke: 'url(#rose-ink)', glow: C.magenta });
  const by = rose.baseY;
  const rx = 112;
  const ry = r1(rx * 0.41);
  const ring = (r, extra = '') => `<ellipse cx="${cx}" cy="${by}" rx="${r1(r)}" ry="${r1(r * 0.41)}" fill="none" ${extra}/>`;
  const cone = `M${cx - 92} ${by}L${cx - 190} 70L${cx + 190} 70L${cx + 92} ${by}Z`;
  const defs = `${rose.defs}
    ${flowGradient('rose-ink', { x1: 420, y1: 60, x2: 780, y2: by, units: 'userSpaceOnUse', dur: 16, hues: ['#ff86b0', '#ff6f9c', '#e070e0', '#ffa08a'] })}
    <linearGradient id="rose-cone" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.teal}" stop-opacity="0.13"/><stop offset="0.55" stop-color="${C.indigo}" stop-opacity="0.04"/><stop offset="1" stop-color="${C.indigo}" stop-opacity="0"/></linearGradient>
    <radialGradient id="rose-pool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.teal}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/></radialGradient>
    <pattern id="rose-scan" width="8" height="4" patternUnits="userSpaceOnUse"><rect width="8" height="1" fill="${C.ink}" opacity="0.07"/><animateTransform attributeName="patternTransform" type="translate" values="0 0;0 -4" dur="0.9s" repeatCount="indefinite"/></pattern>
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
  return panel({ W, H, uid: 'rose', body, defs, css });
}

// ---------- 声呐 ----------

/** 一片数据地形退进黑暗，声呐脉冲一遍遍往深处扫 */
export function sonarPanel() {
  const W = 1200;
  const H = 520;
  const horizon = 150;
  const field = sonarField({ uid: 'sn', W, H, horizon, colors: { bg: C.bg, near: C.teal, far: C.indigo, pulse: '#c8fbf5', target: C.amber } });
  const defs = `<linearGradient id="sn-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.indigo}" stop-opacity="0"/><stop offset="0.7" stop-color="${C.indigo}" stop-opacity="0.05"/><stop offset="1" stop-color="${C.indigo}" stop-opacity="0.12"/></linearGradient>
    <radialGradient id="sn-src" cx="0.5" cy="1" r="0.5"><stop offset="0" stop-color="${C.teal}" stop-opacity="0.3"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/></radialGradient>`;
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
  return panel({ W, H, uid: 'sonar', body, defs, css });
}

// ---------- 奇点 ----------

/** 一个由数据粒子组成吸积盘的黑洞，几乎侧着看 */
export function singularityPanel() {
  const W = 1200;
  const H = 560;
  const bh = singularity({
    uid: 'bh',
    cx: 600,
    cy: 280,
    Rs: 64,
    colors: { bg: C.bg, hot: '#ffe7c2', warm: '#f0b35a', heat: ['#fff3dc', '#ffd08a', '#f0b35a', '#ff7a6a', '#d65bd6', '#8a6cff', '#5b6cff'] },
  });
  const rand = rng('bh-stars');
  const stars = Array.from({ length: 140 }, () => `<circle cx="${r1(rand() * W)}" cy="${r1(rand() * H)}" r="${r1(0.3 + rand() * 0.8)}" opacity="${r1(0.15 + rand() * 0.45)}"/>`).join('');
  const body = `
  <g fill="${C.ink}">${stars}</g>
  ${bh.body}`;
  return panel({ W, H, uid: 'sing', body, defs: bh.defs, css: bh.css });
}

// ---------- 一年的提交（12 个月叠成的圆柱，一起旋转） ----------

export function yearPanel({ days }) {
  const W = 1200;
  const H = 520;
  const max = Math.max(1, ...days.map((d) => d.count));
  const months = new Map();
  for (const d of days) {
    const m = d.date.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m).push(d);
  }
  const list = [...months.entries()].slice(-12);
  const R = 150;
  const rings = list.map(([, ds], j) => {
    const n = ds.length;
    const pts = [];
    const accent = new Set();
    const dim = new Set();
    ds.forEach((d, i) => {
      const a = (i / n) * Math.PI * 2 + j * 0.26;
      pts.push([R * Math.cos(a), R * Math.sin(a)]);
      if (d.count === 0) dim.add(i);
      else if (d.count >= max * 0.5) accent.add(i);
    });
    return { y: (j - (list.length - 1) / 2) * -26, pts, accent, dim };
  });
  rings.sort((a, b) => a.y - b.y);
  const form = spinForm({ uid: 'year', rings, tilt: 0.42, dur: 60, dot: 3, colors: { ink: C.teal, faint: '#3a4660', accent: C.amber } });
  const guides = rings.map((ring) => `<ellipse cx="0" cy="${r1(-ring.y * Math.cos(0.42))}" rx="${R}" ry="${r1(R * Math.sin(0.42))}" fill="none" stroke="${C.line}"/>`).join('');
  const body = `
  <g transform="translate(600 262)">${guides}${form.body}</g>
  <path d="M600 40V480" stroke="${C.line}"/>`;
  return panel({ W, H, uid: 'year', body, defs: form.defs });
}

// ---------- 片头 ----------

/** 片头：三张 ASCII 肖像轮流从暗处浮现又消散，周围只有暗处 */
export function headerPanel({ faces, fonts }) {
  const W = 1200;
  const H = 620;
  const face = faceLayer({ faces, size: 5.8, cx: 600, cy: 310 });
  const body = `
  <radialGradient id="hd-glow" cx="0.5" cy="0.5" r="0.45"><stop offset="0" stop-color="${C.indigo}" stop-opacity="0.1"/><stop offset="1" stop-color="${C.indigo}" stop-opacity="0"/></radialGradient>
  <rect width="${W}" height="${H}" fill="url(#hd-glow)"/>
  ${face.body}`;
  return panel({ W, H, uid: 'head', body, defs: face.defs, css: face.css, fonts });
}
