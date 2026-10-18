/**
 * 声呐：一片由数据起伏成的地形，一排排山脊线向远处退进黑暗里（越远越密、越暗）。
 * 数据是真的：每一排是一周的提交，最近的一周在脚下，越往深处越久远；中间七个位置是这一周的七天，
 * 那天提交越多，那里的峰越高。没有提交的地方只剩很低的海床纹理。
 * 一道声呐脉冲从脚下出发往深处推进，扫过的那一排亮起来又慢慢暗下去；提交最多的几天是“目标”，被扫到时闪一下。
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
 * weeks: 每周七天的提交数，最近的一周在前。返回 { body, css }，画在 (0, 0)-(W, H) 里。
 * colors: { bg, near, far, pulse, target }
 */
export function sonarField({ uid, W, H, weeks, horizon = 150, cols = 220, period = 8, sweep = 5, colors }) {
  const rows = weeks.length;
  const n1 = noise2(`${uid}-a`);
  const n2 = noise2(`${uid}-b`);
  const zNear = 2.6;
  const zFar = 30;
  const eye = 1.6;
  const f = 360;
  const cx = W / 2;
  const xMax = 14;
  // 海床：很低的起伏和细碎的噪声，中间略高、两边渐平
  const floor = (x, z) => {
    const env = Math.exp(-((x / 3.4) ** 2)) * 0.8 + 0.2;
    const coarse = n1(x * 0.55 + 7, z * 0.5);
    const ridge = Math.pow(Math.max(0, coarse - 0.3) / 0.7, 2);
    const spike = Math.pow(n2(x * 2.4 + 3, z * 0.8), 5);
    return env * (ridge * 0.16 + spike * 0.12) + n2(x * 5, z * 2.2) * 0.04;
  };
  // 提交：第 d 天在 x = (d − 3)·DAY 处起一个尖峰，高度按对数（一天几十次和几次都看得出来）
  const DAY = 0.4;
  const max = Math.max(1, ...weeks.flat());
  const peak = (n) => (n > 0 ? 0.14 + 0.6 * (Math.log1p(n) / Math.log1p(max)) : 0);
  const height = (x, z, week) =>
    floor(x, z) + week.reduce((h, n, d) => h + peak(n) * Math.exp(-(((x - (d - 3) * DAY) / 0.13) ** 2)), 0);
  // 目标：提交最多的几天
  const busiest = weeks
    .flatMap((w, k) => w.map((n, d) => ({ k, d, n })))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
  const proj = (x, y, z) => [cx + (f * x) / z, horizon + (f * (eye - y)) / z];
  const zs = Array.from({ length: rows }, (_, k) => zNear * Math.pow(zFar / zNear, k / (rows - 1)));
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
      pts.push(proj(x, height(x, z, weeks[k]), z));
    }
    const d = `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}`;
    const fog = r1(Math.max(0.06, 0.8 - depth * 0.8));
    const stroke = depth < 0.5 ? colors.near : colors.far;
    // 脉冲往深处走，越远越慢（远处的排在屏幕上挤在一起）
    const delay = r1(Math.pow(k / (rows - 1), 1.35) * sweep);
    out.push(`<path d="${d}" fill="${colors.bg}" stroke="${stroke}" stroke-width="${depth < 0.3 ? 1.1 : 0.8}" stroke-opacity="${fog}"${depth > 0.75 ? ' stroke-dasharray="1 2"' : ''}/>`);
    out.push(`<path class="${uid}-p" style="--d:${delay}s" d="${d}" fill="none" stroke="${colors.pulse}" stroke-width="${depth < 0.3 ? 1.4 : 1}" stroke-opacity="${r1(Math.max(0.25, 1 - depth * 0.8))}"/>`);
    for (const t of busiest.filter((t) => t.k === k)) {
      const x = (t.d - 3) * DAY;
      const [sx, sy] = proj(x, height(x, z, weeks[k]), z);
      const s = r1(Math.max(2.2, 8 - depth * 6));
      targets.push({ k, el: `<g class="${uid}-t" style="--d:${delay}s" transform="translate(${r1(sx)} ${r1(sy - s * 2.4)})"><path d="M0 ${-s}L${s} 0L0 ${s}L${-s} 0Z" fill="none" stroke="${colors.target}" stroke-width="1"/><path d="M0 ${s}V${r1(s * 2.4)}" stroke="${colors.target}" stroke-width="0.8" stroke-dasharray="1 2"/></g>` });
    }
    // 目标跟着它那一排画，才会被更近的山脊挡住
    for (const t of targets.filter((t) => t.k === k)) out.push(t.el);
  }
  return { body: out.join(''), css: css.join('\n') };
}
