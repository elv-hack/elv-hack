/**
 * 声呐：一片由数据起伏成的地形，一排排山脊线向远处退进黑暗里（越远越密、越暗）。
 * 一道声呐脉冲从脚下出发往深处推进，扫过的那一排亮起来又慢慢暗下去；地形里藏着几个目标，被扫到时闪一下。
 *
 * 每一排山脊是一条折线，填成背景色（挡住后面的排），再叠一份只描边的亮线做脉冲；亮线和目标的闪烁都是 CSS 动画，
 * 按这一排的深度错开开始时间。
 */
import { r1, rng } from './lib.mjs';

/** 平滑的值噪声（确定性） */
function noise2(seed) {
  const rand = rng(seed);
  const G = 64;
  const grid = Array.from({ length: G * G }, () => rand());
  const at = (i, j) => grid[(((j % G) + G) % G) * G + (((i % G) + G) % G)];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const u = fade(x - i);
    const v = fade(y - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * u;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
    return a + (b - a) * v;
  };
}

/**
 * 返回 { body, css }，画在 (0, 0)-(W, H) 里。colors: { bg, near, far, pulse, target }
 */
export function sonarField({ uid, W, H, horizon = 150, rows = 58, cols = 200, period = 8, sweep = 5, colors }) {
  const n1 = noise2(`${uid}-a`);
  const n2 = noise2(`${uid}-b`);
  const zNear = 1.6;
  const zFar = 30;
  const eye = 1.35;
  const f = 360;
  const cx = W / 2;
  const xMax = 14;
  // 地形高度：中间一条起伏强、两边渐平（像一张把信号叠起来的图），再加细碎的噪声
  const height = (x, z) => {
    const env = Math.exp(-((x / 3.2) ** 2)) * 0.85 + 0.15;
    const coarse = n1(x * 0.55 + 7, z * 0.5);
    const ridge = Math.pow(Math.max(0, coarse - 0.3) / 0.7, 2);
    // 尖峰：像一串信号脉冲
    const spike = Math.pow(n2(x * 2.4 + 3, z * 0.8), 5) * 1.6;
    const fine = n2(x * 5, z * 2.2) * 0.05;
    return env * (ridge * 0.42 + spike * 0.55) + fine;
  };
  const proj = (x, y, z) => [cx + (f * x) / z, horizon + (f * (eye - y)) / z];
  const zs = Array.from({ length: rows }, (_, k) => zNear * Math.pow(zFar / zNear, k / (rows - 1)));
  const rand = rng(`${uid}-targets`);
  const out = [];
  const css = [`.${uid}-p { opacity: 0; animation: ${uid}-ping ${period}s linear var(--d) infinite; }
  @keyframes ${uid}-ping { 0% { opacity: 0; } 1.2% { opacity: 1; } 9% { opacity: 0.18; } 26%, 100% { opacity: 0; } }
  .${uid}-t { opacity: 0.25; animation: ${uid}-hit ${period}s ease-out var(--d) infinite; }
  @keyframes ${uid}-hit { 0% { opacity: 0.25; } 2% { opacity: 1; } 50%, 100% { opacity: 0.25; } }`];
  const targets = [];
  // 由远到近：近的排盖住远的排
  for (let k = rows - 1; k >= 0; k--) {
    const z = zs[k];
    const depth = k / (rows - 1); // 0 近 1 远
    const pts = [];
    // 每一排只在看得见的宽度里取点，近处的排也一样细
    const half = Math.min(xMax, ((W / 2) * z * 1.08) / f);
    for (let i = 0; i <= cols; i++) {
      const x = -half + (2 * half * i) / cols;
      pts.push(proj(x, height(x, z), z));
    }
    const d = `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}`;
    const fog = r1(Math.max(0.06, 0.8 - depth * 0.8));
    const stroke = depth < 0.5 ? colors.near : colors.far;
    // 脉冲往深处走，越远越慢（远处的排在屏幕上挤在一起）
    const delay = r1(Math.pow(k / (rows - 1), 1.35) * sweep);
    out.push(`<path d="${d}" fill="${colors.bg}" stroke="${stroke}" stroke-width="${depth < 0.3 ? 1.1 : 0.8}" stroke-opacity="${fog}"${depth > 0.75 ? ' stroke-dasharray="1 2"' : ''}/>`);
    out.push(`<path class="${uid}-p" style="--d:${delay}s" d="${d}" fill="none" stroke="${colors.pulse}" stroke-width="${depth < 0.3 ? 1.4 : 1}" stroke-opacity="${r1(Math.max(0.25, 1 - depth * 0.8))}"/>`);
    // 偶尔在高处埋一个目标
    if (k > 3 && k < rows - 6 && rand() < 0.22) {
      const x = (rand() - 0.5) * 7;
      const y = height(x, z);
      const [sx, sy] = proj(x, y, z);
      const s = r1(Math.max(2.2, 9 - depth * 7));
      targets.push({ k, el: `<g class="${uid}-t" style="--d:${delay}s" transform="translate(${r1(sx)} ${r1(sy - s * 2.2)})"><path d="M0 ${-s}L${s} 0L0 ${s}L${-s} 0Z" fill="none" stroke="${colors.target}" stroke-width="1"/><path d="M0 ${s}V${r1(s * 2.2)}" stroke="${colors.target}" stroke-width="0.8" stroke-dasharray="1 2"/></g>` });
    }
    // 目标跟着它那一排画，才会被更近的山脊挡住
    for (const t of targets.filter((t) => t.k === k)) out.push(t.el);
  }
  return { body: out.join(''), css: css.join('\n') };
}
