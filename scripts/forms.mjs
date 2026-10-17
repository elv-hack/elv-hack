/**
 * 旋转的点阵形体（伪 3D）。
 *
 * 思路：绕竖轴旋转的物体上，每一圈水平环都只是在自己的高度上打转。
 * 一圈环 = “俯视图里匀速转动的平面曲线”，再按倾角竖向压扁、平移到自己的高度。
 * 所以每圈环只需要一个 CSS 旋转动画（整圈点一起转），几百个点也很省，而且转得完全平滑。
 * 远近感：每圈环套一个上淡下浓的遮罩（看的时候略微俯视，环的上半圈在远处）。
 */
import { r1 } from './lib.mjs';

/**
 * rings: [{ y, pts: [[x, z], ...], accent?: Set<index>, dim?: Set<index> }]，y 向上为正。
 * 返回 { defs, body }；整组以 (0, 0) 为中心。
 */
export function spinForm({ uid, rings, tilt = 0.6, dur = 30, dot = 1.8, colors, enter = true }) {
  const squash = Math.sin(tilt);
  const lift = Math.cos(tilt);
  const defs = `<linearGradient id="${uid}-depth" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff"/></linearGradient>
    <mask id="${uid}-m" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#${uid}-depth)"/></mask>`;
  const body = rings
    .map((ring, k) => {
      const lines = (ring.lines ?? [])
        .map(
          (ln) =>
            `<path d="${ln.d}" fill="none" stroke="${ln.lit ? (ln.accent ? colors.accent : colors.ink) : colors.faint}" stroke-width="${ln.lit ? 1.2 : 0.8}"${ln.lit ? '' : ' stroke-dasharray="1.5 3.5"'} vector-effect="non-scaling-stroke" stroke-linecap="round"/>`,
        )
        .join('');
      const dots = (ring.pts ?? [])
        .map(([x, z], i) => {
          const accent = ring.accent?.has(i);
          const dim = ring.dim?.has(i);
          const fill = accent ? colors.accent : dim ? colors.faint : colors.ink;
          return `<circle cx="${r1(x)}" cy="${r1(z)}" r="${accent ? dot * 1.25 : dot}" fill="${fill}"${dim ? ' opacity="0.55"' : ''}/>`;
        })
        .join('');
      // 外面再包一层专门做入场动画，避免 CSS transform 覆盖掉 transform 属性
      return `<g class="${enter ? 'ringIn' : ''}" style="--d:${r1(k * 0.06)}s"><g transform="translate(0 ${r1(-ring.y * lift)})"><g mask="url(#${uid}-m)"><g transform="scale(1 ${r1(squash * 1000) / 1000})">
        <g class="spin" style="animation-duration:${dur}s">${lines}${dots}</g></g></g></g></g>`;
    })
    .join('');
  return { defs, body: `<g>${body}</g>` };
}

export const FORM_CSS = `
  .spin { animation: spin linear infinite; }
  .ringIn { animation: rise 1.6s cubic-bezier(0.2, 0.7, 0.1, 1) var(--d) both; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes rise { from { opacity: 0; transform: translateY(18px); } }`;

/** 环面：R 大半径、r 管半径；accentAt 这一列（u 的下标）用强调色，形成一条跟着转的经线 */
export function torus({ R = 150, r = 60, nu = 40, nv = 18, accentAt = 0 }) {
  const rings = [];
  for (let j = 0; j < nv; j++) {
    const v = (j / nv) * Math.PI * 2;
    const rho = R + r * Math.cos(v);
    const y = r * Math.sin(v);
    const pts = [];
    for (let i = 0; i < nu; i++) {
      const u = (i / nu) * Math.PI * 2 + (j % 2) * (Math.PI / nu);
      pts.push([rho * Math.cos(u), rho * Math.sin(u)]);
    }
    rings.push({ y, pts, accent: new Set([accentAt]) });
  }
  // 由下往上、由后往前大致排序：先画低的环
  rings.sort((a, b) => a.y - b.y);
  return rings;
}

/**
 * 玫瑰曲线叠成的立体花：每一层是一条闭合的 r = A·cos(kθ)，层与层之间扭转。
 * 每层切成 segs 段，所有段按固定的伪随机顺序编号；前 lit 段是实线（已放上的碎片），其余是淡虚线。
 */
export function roseStack({ layers = 10, segs = 6, k = 5 / 2, height = 230, size = 190, twist = 0.32, lit = 0, seed = 1 }) {
  const loops = Number.isInteger(k) ? 1 : 2;
  const N = 240;
  const rings = [];
  const ids = [];
  for (let j = 0; j < layers; j++) {
    const t = j / (layers - 1);
    const A = size * Math.pow(Math.sin(Math.PI * (0.1 + 0.85 * t)), 0.8) * (0.5 + 0.5 * t);
    const y = (t - 0.5) * height;
    const curve = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2 * loops;
      const rr = A * Math.cos(k * th);
      const a = th + j * twist;
      curve.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
    const lines = [];
    for (let s = 0; s < segs; s++) {
      const from = Math.floor((s / segs) * N);
      const to = Math.floor(((s + 1) / segs) * N);
      const d = `M${curve.slice(from, to + 1).map(([x, z]) => `${r1(x)} ${r1(z)}`).join('L')}`;
      lines.push({ d, lit: false });
      ids.push([j, s]);
    }
    rings.push({ y, lines });
  }
  let h = (seed * 2654435761) >>> 0;
  const order = ids.map((p, n) => [p, (h = Math.imul(h ^ (n + 1), 2246822519) >>> 0) / 2 ** 32]).sort((a, b) => a[1] - b[1]).map(([p]) => p);
  order.slice(0, lit).forEach(([j, s], n) => {
    rings[j].lines[s].lit = true;
    rings[j].lines[s].accent = n === lit - 1; // 最新放上的那一段用强调色
  });
  return { rings, total: ids.length };
}

// ---------- 刚体旋转的线框（多面体、环面结、三维李萨如）：逐帧投影，单条 path 变形 ----------

import { morph, rotX, rotY } from './three.mjs';

const PHI = (1 + Math.sqrt(5)) / 2;
export const SOLIDS = {
  tetrahedron: { v: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]] },
  cube: { v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  octahedron: { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] },
  icosahedron: {
    v: [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]],
  },
};
// 边：顶点之间距离等于最短距离的都连起来
for (const s of Object.values(SOLIDS)) {
  const n = s.v.map((p) => Math.hypot(...p));
  s.v = s.v.map((p, i) => p.map((x) => x / n[i]));
  let min = Infinity;
  for (let i = 0; i < s.v.length; i++) for (let j = i + 1; j < s.v.length; j++) min = Math.min(min, Math.hypot(...s.v[i].map((x, k) => x - s.v[j][k])));
  s.e = [];
  for (let i = 0; i < s.v.length; i++) for (let j = i + 1; j < s.v.length; j++) if (Math.hypot(...s.v[i].map((x, k) => x - s.v[j][k])) < min * 1.01) s.e.push([i, j]);
}

const persp = ([x, y, z], size, dist = 4) => {
  const d = z + dist;
  return [(x * size * dist) / d, (-y * size * dist) / d];
};
const fmt = ([x, y]) => `${r1(x)} ${r1(y)}`;

/** 多面体线框：frames 帧转一圈（绕 Y，带固定的 X 倾角），返回各帧的 d */
export function solidFrames(name, { size = 100, frames = 36, tilt = 0.45, phase = 0 } = {}) {
  const s = SOLIDS[name];
  return Array.from({ length: frames }, (_, i) => {
    const a = (i / frames) * Math.PI * 2 + phase;
    const P = s.v.map((v) => persp(rotX(rotY(v, a), tilt), size));
    return s.e.map(([p, q]) => `M${fmt(P[p])}L${fmt(P[q])}`).join('');
  });
}

/** 环面结 (p, q)：绕轴 p 圈、穿过中心孔 q 圈；镜头放远一点、偏俯视，花纹才看得清 */
export function knotFrames(p, q, { size = 100, frames = 36, tilt = 0.95, N = 300 } = {}) {
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    const r = 2 + 0.7 * Math.cos(q * t);
    return [(r * Math.cos(p * t)) / 2.7, (0.7 * Math.sin(q * t)) / 2.7, (r * Math.sin(p * t)) / 2.7];
  });
  return Array.from({ length: frames }, (_, i) => {
    const a = (i / frames) * Math.PI * 2;
    return `M${pts.map((v) => fmt(persp(rotX(rotY(v, a), tilt), size, 8))).join('L')}`;
  });
}

/** 三维李萨如曲线 (a, b, c) */
export function lissajousFrames(a, b, c, { size = 100, frames = 36, tilt = 0.4, N = 260 } = {}) {
  // 李萨如也把镜头放远一点，变形小一些
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    return [Math.sin(a * t + 0.5) * 0.9, Math.sin(b * t) * 0.9, Math.sin(c * t + 1.1) * 0.9];
  });
  return Array.from({ length: frames }, (_, i) => {
    const ang = (i / frames) * Math.PI * 2;
    return `M${pts.map((v) => fmt(persp(rotX(rotY(v, ang), tilt), size, 7))).join('L')}`;
  });
}

export const wire = (frames, dur, stroke, width = 1.2, extra = '') =>
  `<path fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"${extra}>${morph(frames, dur)}</path>`;

/** 球面点阵（纬线圈），配合 spinForm 使用 */
export function sphereRings({ R = 100, lat = 12, per = 36 }) {
  const rings = [];
  for (let j = 1; j < lat; j++) {
    const phi = (j / lat) * Math.PI;
    const rho = R * Math.sin(phi);
    const n = Math.max(6, Math.round(per * Math.sin(phi)));
    rings.push({ y: R * Math.cos(phi), pts: Array.from({ length: n }, (_, i) => [rho * Math.cos((i / n) * Math.PI * 2), rho * Math.sin((i / n) * Math.PI * 2)]) });
  }
  return rings.sort((a, b) => a.y - b.y);
}
