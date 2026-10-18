/**
 * 奇点：一个黑洞，吸积盘由几千个数据粒子和几圈“比特环”组成，差不多侧着看。
 * - 越靠里转得越快（开普勒：周期 ∝ r^1.5），越靠里越热（白、琥珀 → 洋红 → 靛蓝）。
 * - 盘的远半边被黑洞挡住，近半边压在黑洞前面；远半边的光被引力弯过来，在黑洞上下各绕成一道光环。
 *   盘只画一份：黑洞的阴影拆成上下两半，下半在盘后面、上半盖在盘前面（远半边在屏幕上正好是上半）。
 * - 迎着我们转过来的那一侧更亮（多普勒增亮）：右半边盖一层半透明的暗色，不用遮罩。
 * - 有零星的粒子沿螺线落进去，熄灭在视界上。
 *
 * 转动用的是“压扁的旋转圆”：每圈环在俯视图里匀速旋转（CSS），外面再竖向压扁成倾斜的盘。
 */
import { r1, rng } from './lib.mjs';

/** 返回 { defs, body, css }，以 (cx, cy) 为中心，Rs 是黑洞阴影的半径 */
export function singularity({ uid, cx, cy, Rs = 52, tilt = 0.17, colors }) {
  const rand = rng(`${uid}-disk`);
  const q = r1(tilt * 1000) / 1000;
  const heat = (t) => {
    // t = 0 最里 → 1 最外
    const stops = colors.heat;
    const x = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    return x - i < 0.5 ? stops[i] : stops[i + 1];
  };
  const period = (r) => r1(9 * Math.pow(r / (1.6 * Rs), 1.5));

  // 盘：一圈圈粒子环，夹几圈十六进制字
  const rings = [];
  const inner = 1.6 * Rs;
  const outer = 4.9 * Rs;
  const N = 30;
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1);
    const r = inner + (outer - inner) * Math.pow(t, 1.25);
    const color = heat(t);
    const dir = 1;
    let content;
    if (k % 7 === 3) {
      // 数据环：一圈虚线，长短按随机的比特排（像条码绕成了环）。沿路径排字太贵（每帧都要重画字形），所以不用字
      const dash = [];
      let total = 0;
      while (total < 2 * Math.PI * r) {
        const on = rand() < 0.5 ? 1.2 : 3.6;
        const off = 1.4 + Math.floor(rand() * 3) * 1.6;
        dash.push(on, r1(off));
        total += on + off;
      }
      content = `<circle r="${r1(r)}" fill="none" stroke="${color}" stroke-width="2.4" stroke-dasharray="${dash.join(' ')}" opacity="${r1(0.75 - t * 0.35)}"/>`;
    } else {
      const count = Math.floor((2 * Math.PI * r) / (3 + t * 5));
      const dots = [];
      for (let i = 0; i < count; i++) {
        if (rand() < 0.18) continue;
        const a = (i / count) * Math.PI * 2 + rand() * 0.05;
        const rr = r + (rand() - 0.5) * 4;
        // 拉长一点（沿切向），压扁以后像一道道光痕
        const len = r1(1.2 + rand() * 3 * (1 - t));
        const x = r1(rr * Math.cos(a));
        const y = r1(rr * Math.sin(a));
        const tx = r1(-Math.sin(a) * len);
        const ty = r1(Math.cos(a) * len);
        dots.push(`M${x} ${y}l${tx} ${ty}`);
      }
      content = `<path d="${dots.join('')}" stroke="${color}" stroke-width="${r1(2.2 - t * 1.1)}" stroke-linecap="round" opacity="${r1(1 - t * 0.5)}"/>`;
    }
    rings.push(`<g class="${uid}-spin" style="animation-duration:${period(r)}s;animation-direction:${dir > 0 ? 'normal' : 'reverse'}">${content}</g>`);
  }

  // 落进去的粒子：沿对数螺线从盘外缘旋进视界
  const falls = [];
  for (let i = 0; i < 14; i++) {
    const a0 = rand() * Math.PI * 2;
    const turns = 1.4 + rand() * 0.8;
    const pts = [];
    for (let k = 0; k <= 48; k++) {
      const u = k / 48;
      const r = outer * 0.95 * Math.pow(Rs * 1.02 / (outer * 0.95), u);
      const a = a0 + u * turns * Math.PI * 2;
      pts.push(`${r1(r * Math.cos(a))} ${r1(r * Math.sin(a))}`);
    }
    const dur = r1(7 + rand() * 6);
    falls.push(`<circle r="1.6" fill="${colors.hot}" opacity="0"><animateMotion dur="${dur}s" begin="${r1(-rand() * dur)}s" repeatCount="indefinite" path="M${pts.join('L')}" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.5 0 0.9 0.6"/><animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.85;1" dur="${dur}s" begin="${r1(-rand() * dur)}s" repeatCount="indefinite"/></circle>`);
  }

  const glowRings = Array.from({ length: 7 }, (_, k) => {
    const t = k / 6;
    const r = inner + (outer - inner) * Math.pow(t, 1.3);
    return `<circle r="${r1(r)}" fill="none" stroke="${heat(t)}" stroke-width="${r1(26 - t * 12)}" opacity="${r1(0.11 - t * 0.07)}"/>`;
  }).join('');
  const disk = `<g transform="translate(${cx} ${cy}) scale(1 ${q})">${glowRings}${rings.join('')}${falls.join('')}</g>`;
  // 引力透镜：远半边的盘被弯成绕着黑洞的光环（几乎不压扁）
  const halo = [];
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const r = Rs * (1.1 + t * 0.85);
    const count = Math.floor((2 * Math.PI * r) / 4);
    const dots = [];
    for (let i = 0; i < count; i++) {
      if (rand() < 0.2) continue;
      const a = (i / count) * Math.PI * 2;
      const len = 1.5 + rand() * 3;
      dots.push(`M${r1(r * Math.cos(a))} ${r1(r * Math.sin(a))}l${r1(-Math.sin(a) * len)} ${r1(Math.cos(a) * len)}`);
    }
    halo.push(`<g class="${uid}-spin" style="animation-duration:${r1(period(r * 1.6))}s"><path d="${dots.join('')}" stroke="${heat(t * 0.5)}" stroke-width="${r1(1.6 - t * 0.9)}" stroke-linecap="round" opacity="${r1(1 - t * 0.8)}"/></g>`);
  }
  halo.push(`<circle r="${r1(Rs * 1.35)}" fill="none" stroke="${colors.hot}" stroke-width="${r1(Rs * 0.5)}" opacity="0.07"/>`);

  const half = (top) => {
    const R = r1(Rs * 1.18);
    return `<path d="M${-R} 0A${R} ${R} 0 0 ${top ? 1 : 0} ${R} 0Z" fill="url(#${uid}-shadow)"/>`;
  };
  const defs = `
    <radialGradient id="${uid}-shadow" cx="0" cy="0" r="${r1(Rs * 1.18)}" gradientUnits="userSpaceOnUse"><stop offset="0.82" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="${uid}-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${colors.warm}" stop-opacity="0.16"/><stop offset="0.45" stop-color="${colors.warm}" stop-opacity="0.05"/><stop offset="1" stop-color="${colors.warm}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${uid}-dim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.bg}" stop-opacity="0"/><stop offset="0.5" stop-color="${colors.bg}" stop-opacity="0.15"/><stop offset="1" stop-color="${colors.bg}" stop-opacity="0.6"/></linearGradient>`;
  const body = `
    <ellipse cx="${cx}" cy="${cy}" rx="${r1(outer * 1.05)}" ry="${r1(outer * 0.42)}" fill="url(#${uid}-glow)"/>
    <g transform="translate(${cx} ${cy})">${half(false)}
      <path d="M${r1(-Rs * 1.03)} 0A${r1(Rs * 1.03)} ${r1(Rs * 1.03)} 0 0 0 ${r1(Rs * 1.03)} 0" fill="none" stroke="${colors.hot}" stroke-width="1.2" opacity="0.7"/>
      ${halo.join('')}</g>
    ${disk}
    <g transform="translate(${cx} ${cy})">
      ${half(true)}
      <path d="M${r1(-Rs * 1.03)} 0A${r1(Rs * 1.03)} ${r1(Rs * 1.03)} 0 0 1 ${r1(Rs * 1.03)} 0" fill="none" stroke="${colors.hot}" stroke-width="1.2" opacity="0.9"/>
      <path d="M${r1(-Rs * 1.07)} 0A${r1(Rs * 1.07)} ${r1(Rs * 1.07)} 0 0 1 ${r1(Rs * 1.07)} 0" fill="none" stroke="${colors.hot}" stroke-width="4" opacity="0.12"/>
    </g>
    <rect x="${cx - outer - 20}" y="${r1(cy - outer * 0.45)}" width="${2 * outer + 40}" height="${r1(outer * 0.9)}" fill="url(#${uid}-dim)"/>`;
  const css = `.${uid}-spin { animation: ${uid}-spin linear infinite; } @keyframes ${uid}-spin { to { transform: rotate(-360deg); } }`;
  return { defs, body, css };
}
