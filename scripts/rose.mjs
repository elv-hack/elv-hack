/**
 * 全息玫瑰：一朵线框玫瑰在投影台上自己走完一生——从光里凝出花苞、盛放、凋萎、花瓣一片片脱落碎成光点，
 * 最后连茎叶一起散掉，再重新凝出下一朵。整个循环 DUR 秒，一直缓慢旋转。
 *
 * 花瓣是真正的 3D 曲面（绕花心卷起的瓣，沿瓣脊外翻），每片花瓣画成一条轮廓 + 一条瓣脊。
 * 每隔 DUR / FRAMES 秒算一帧投影，交给 SMIL 在帧之间插值（README 里不能跑 JS）。
 */
import { r1, rng } from './lib.mjs';
import { project, rotX, rotY } from './three.mjs';

export const DUR = 40;
const FRAMES = 60;
/** 俯视角：略微从上往下看，能看见花心 */
const TILT = 0.3;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 五层花瓣，由内到外：片数、长度、宽度（绕花心包住的半角）、花苞时 / 盛放时 / 凋萎时的张开角、瓣缘外卷。
 * 里面几层盛放时也只微微张开（玫瑰的心是卷着的），外层张成杯形。
 */
const LAYERS = [
  { n: 3, L: 0.56, W: 1.55, r0: 0.015, y0: 0, bud: 0.03, open: 0.05, wilt: 0.4, curl: 0.1 },
  { n: 4, L: 0.63, W: 1.2, r0: 0.03, y0: -0.03, bud: 0.06, open: 0.14, wilt: 0.6, curl: 0.25 },
  { n: 5, L: 0.72, W: 0.98, r0: 0.05, y0: -0.07, bud: 0.1, open: 0.27, wilt: 0.95, curl: 0.5 },
  { n: 6, L: 0.8, W: 0.84, r0: 0.075, y0: -0.12, bud: 0.15, open: 0.43, wilt: 1.35, curl: 0.8 },
  { n: 7, L: 0.86, W: 0.72, r0: 0.1, y0: -0.18, bud: 0.22, open: 0.64, wilt: 1.85, curl: 1.0 },
];
const OUTER = LAYERS.length - 1;

function petals() {
  const rand = rng('rose-petals');
  const list = [];
  LAYERS.forEach((ly, l) => {
    for (let i = 0; i < ly.n; i++) {
      const j = rand();
      const o = OUTER - l; // 0 = 最外层
      list.push({
        ...ly,
        l,
        theta: (i / ly.n) * Math.PI * 2 + l * 0.71 + (rand() - 0.5) * 0.3,
        // 外层先开、先谢、先落；同一层里有一点先后
        openAt: 0.07 + o * 0.022,
        wiltAt: 0.5 + o * 0.025 + j * 0.03,
        fallAt: 0.58 + o * 0.045 + j * 0.035,
        spin: (rand() - 0.5) * 2,
      });
    }
  });
  return list;
}

/** 绕任意单位轴旋转 */
function rotAxis(p, [ax, ay, az], a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dot = p[0] * ax + p[1] * ay + p[2] * az;
  return [
    p[0] * c + (ay * p[2] - az * p[1]) * s + ax * dot * (1 - c),
    p[1] * c + (az * p[0] - ax * p[2]) * s + ay * dot * (1 - c),
    p[2] * c + (ax * p[1] - ay * p[0]) * s + az * dot * (1 - c),
  ];
}

/**
 * 一片花瓣在时刻 τ 的世界坐标：上半截轮廓（左边缘 → 圆圆的瓣顶 → 右边缘）和一条横向的弧（显出瓣面的弯曲），
 * 以及透明度、碎裂程度。
 */
function petalAt(p, tau) {
  const open = smooth(p.openAt, p.openAt + 0.25, tau);
  const wilt = smooth(p.wiltAt, p.wiltAt + 0.14, tau);
  const fall = clamp((tau - p.fallAt) / 0.17);
  const alpha = lerp(p.bud, p.open, open) + (p.wilt - p.open) * wilt;
  // 瓣尖弯曲：花苞时向里收，盛放时向外翻，凋萎时整片往下耷拉
  const kappa = lerp(-0.25, 0.4 * p.curl, open) + 0.8 * wilt;
  const L = p.L * (1 - 0.16 * wilt) * (0.75 + 0.25 * smooth(0, 0.12, tau));
  const W = p.W * (1 - 0.3 * wilt);
  const N = 10;
  const spine = [];
  let r = p.r0;
  let y = p.y0 * smooth(0.05, 0.3, tau);
  for (let k = 0; k <= N + 1; k++) {
    const v = k / N;
    spine.push([r, y]);
    const a = alpha + kappa * v * v;
    r += (Math.sin(a) * L) / N;
    y += (Math.cos(a) * L) / N;
  }
  const spineAt = (v) => {
    const x = clamp(v, 0, 1.1) * N;
    const k = Math.min(N, Math.floor(x));
    const t = x - k;
    return [lerp(spine[k][0], spine[k + 1][0], t), lerp(spine[k][1], spine[k + 1][1], t)];
  };
  // 宽度：从瓣基很窄，到七成处最宽、一直宽到瓣顶（倒卵形）；瓣缘靠上的地方往外卷
  const reflex = 0.22 * p.curl * open * (1 - 0.5 * wilt);
  const at = (v, u) => {
    const [rr, yy] = spineAt(v);
    const half = W * (0.22 + 0.78 * Math.pow(Math.sin((Math.PI / 2) * Math.min(1, v / 0.72)), 0.8));
    const t = p.theta + u * half;
    const rad = rr + reflex * u * u * Math.pow(Math.min(v, 1), 3);
    return [rad * Math.cos(t), yy - reflex * 0.3 * u * u * Math.pow(Math.min(v, 1), 3), rad * Math.sin(t)];
  };
  // 只画花瓣上半截的边（下半截藏在花杯里），再加一条横弧；不然几十条瓣边会从花心放射出去
  const vs = Array.from({ length: 6 }, (_, k) => 0.5 + (0.5 * k) / 5);
  const top = Array.from({ length: 7 }, (_, k) => -1 + (2 * (k + 1)) / 8).map((u) => at(1 + 0.09 * (1 - u * u), u));
  const outline = [...vs.map((v) => at(v, -1)), ...top, ...[...vs].reverse().map((v) => at(v, 1))];
  const arc = [-1, -0.5, 0, 0.5, 1].map((u) => at(0.62, u));
  let pts = [outline, arc];
  if (fall > 0) {
    // 脱落：绕自己的切向轴翻滚，向外飘、往下坠，左右轻轻摆
    const c = at(0.5, 0);
    const axis = [-Math.sin(p.theta), 0, Math.cos(p.theta)];
    const drift = [Math.cos(p.theta) * fall * 0.9, -Math.pow(fall, 1.7) * 2.6, Math.sin(p.theta) * fall * 0.9];
    const sway = Math.sin(fall * 7 + p.theta) * 0.14 * fall;
    pts = pts.map((line) =>
      line.map((q) => {
        const d = rotAxis([q[0] - c[0], q[1] - c[1], q[2] - c[2]], axis, fall * (2.6 + p.spin));
        return [c[0] + d[0] + drift[0] + axis[0] * sway, c[1] + d[1] + drift[1], c[2] + d[2] + drift[2] + axis[2] * sway];
      }),
    );
  }
  const appear = smooth(0, 0.07, tau);
  return { pts, opacity: appear * (1 - smooth(0.35, 1, fall)) * (fall > 0 ? 1 : 1 - 0.25 * wilt), frag: smooth(0.08, 0.55, fall) };
}

/** 茎、两片叶子、五片萼片：凋萎时叶子下垂，最后整株散掉 */
function stemAt(tau) {
  const wilt = smooth(0.55, 0.8, tau);
  const stem = Array.from({ length: 11 }, (_, k) => {
    const t = k / 10;
    return [0.14 * Math.sin(t * 2.2) - 0.05 * t, -0.04 - t * 1.85, 0.06 * Math.sin(t * 3)];
  });
  const leaf = (y, az, size) => {
    const base = [0.14 * Math.sin((y / 1.85) * 2.2), -y, 0];
    const tilt = 0.9 + 0.7 * wilt;
    const dir = [Math.cos(az) * Math.sin(tilt), Math.cos(tilt), Math.sin(az) * Math.sin(tilt)];
    const side = [-Math.sin(az), 0, Math.cos(az)];
    const P = (v, u) => {
      const w = Math.sin(Math.PI * v) * 0.38 * size * (1 - 0.3 * wilt);
      const droop = -0.25 * v * v * (1 + 2 * wilt) * size;
      return [base[0] + dir[0] * v * size + side[0] * u * w, base[1] + dir[1] * v * size + droop, base[2] + dir[2] * v * size + side[2] * u * w];
    };
    const vs = [0, 0.2, 0.4, 0.6, 0.8, 1];
    const outline = [...vs.map((v) => P(v, -1)), ...vs.slice(0, -1).reverse().map((v) => P(v, 1))];
    const mid = vs.map((v) => P(v, 0));
    const veins = [0.3, 0.55, 0.78].flatMap((v) => [P(v, 0), P(v + 0.12, -0.8), P(v, 0), P(v + 0.12, 0.8)]);
    return [outline, mid, veins];
  };
  const sepals = Array.from({ length: 5 }, (_, i) => {
    const az = (i / 5) * Math.PI * 2 + 0.3;
    const a = lerp(0.35, 2.0, smooth(0.08, 0.3, tau)) + 0.3 * wilt;
    const len = 0.26 * (1 - 0.2 * wilt);
    const tip = [Math.cos(az) * Math.sin(a) * len, -0.02 + Math.cos(a) * len, Math.sin(az) * Math.sin(a) * len];
    const s = 0.05;
    return [[Math.cos(az - 0.35) * s, 0, Math.sin(az - 0.35) * s], tip, [Math.cos(az + 0.35) * s, 0, Math.sin(az + 0.35) * s]];
  });
  const appear = smooth(0, 0.07, tau);
  return { lines: [[stem], leaf(0.8, 0.4, 0.55), leaf(1.25, 3.6, 0.45), sepals], opacity: appear * (1 - smooth(0.86, 0.96, tau)) };
}

/**
 * 整朵玫瑰的 SVG（以花心为原点的世界坐标，投影到 (cx, cy)）。返回 { defs, body, css }。
 */
export function hologramRose({ cx, cy, scale = 140, stroke, glow }) {
  const list = petals();
  const view = { cx, cy, f: scale * 6.5, dist: 6.5 };
  const toScreen = (q, tau) => {
    const yaw = tau * Math.PI + 0.4;
    const v = rotX(rotY(q, yaw), -TILT);
    const s = project(v, view);
    return s ? [Math.round(s[0]), Math.round(s[1])] : [cx, cy];
  };
  const taus = Array.from({ length: FRAMES + 1 }, (_, i) => i / FRAMES);
  // 每条线：M 起点，后面全用相对坐标（l dx dy …），数字短很多；各帧的命令结构一样，SMIL 才能插值
  const pathOf = (lines, tau) =>
    lines
      .map((line) => {
        const pts = line.map((q) => toScreen(q, tau));
        return `M${pts[0][0]} ${pts[0][1]}l${pts.slice(1).map(([x, y], i) => `${x - pts[i][0]} ${y - pts[i][1]}`).join(' ')}`;
      })
      .join('');
  const anim = (attr, vals) => `<animate attributeName="${attr}" values="${vals.join(';')}" dur="${DUR}s" repeatCount="indefinite" calcMode="linear"/>`;

  const shapes = [];
  list.forEach((p, i) => {
    const frames = taus.map((t) => petalAt(p, t));
    const d = frames.map((f, k) => pathOf(f.pts, taus[k]));
    shapes.push(`<path id="pt${i}" d="${d[0]}">${anim('d', d)}${anim('opacity', frames.map((f) => r1(f.opacity)))}${anim(
      'stroke-dasharray',
      frames.map((f) => `${r1(lerp(600, 2.5, f.frag))} ${r1(lerp(0, 8, f.frag))}`),
    )}</path>`);
  });
  const sf = taus.map((t) => stemAt(t));
  const stemD = taus.map((t, k) => sf[k].lines.map((group) => pathOf(group, t)).join(''));
  shapes.push(`<path id="stem" d="${stemD[0]}" fill="none">${anim('d', stemD)}${anim('opacity', sf.map((f) => r1(f.opacity)))}</path>`);

  // 花心那一圈卷着的螺旋：玫瑰最好认的地方。花苞时卷得紧，盛放时松一点，跟最里层花瓣一起落
  const inner = list.filter((p) => p.l === 0);
  const heart = taus.map((t) => {
    const open = smooth(0.1, 0.35, t);
    const fall = clamp((t - Math.min(...inner.map((p) => p.fallAt))) / 0.12);
    const pts = Array.from({ length: 26 }, (_, k) => {
      const u = k / 25;
      const r = (0.015 + 0.13 * u) * (0.7 + 0.4 * open);
      const a = u * Math.PI * 4.2;
      return [r * Math.cos(a), 0.5 - 0.07 * u - fall * 0.6, r * Math.sin(a)];
    });
    return { d: pathOf([pts], t), opacity: r1(smooth(0, 0.07, t) * (1 - fall)) };
  });
  shapes.push(`<path id="heart" d="${heart[0].d}" fill="none">${anim('d', heart.map((h) => h.d))}${anim('opacity', heart.map((h) => h.opacity))}</path>`);

  // 落下的光点：每片花瓣脱落时撒出几粒，往下飘、慢慢熄灭
  const rand = rng('rose-dust');
  const dust = [];
  list.forEach((p) => {
    for (let k = 0; k < 3; k++) {
      const start = p.fallAt + rand() * 0.08;
      const az = p.theta + (rand() - 0.5) * 0.8;
      const r = 0.5 + rand() * 0.5;
      const pts = taus.map((t) => {
        const f = clamp((t - start) / 0.22);
        return [Math.cos(az) * (r + f * 0.6), 0.45 - Math.pow(f, 1.5) * 2.6 + Math.sin(f * 9 + az) * 0.05, Math.sin(az) * (r + f * 0.6)];
      });
      const xy = taus.map((t, i) => toScreen(pts[i], t).join(','));
      const op = taus.map((t) => {
        const f = (t - start) / 0.22;
        return f <= 0 || f >= 1 ? 0 : r1(Math.sin(Math.PI * f) * 0.9);
      });
      dust.push(`<circle r="${r1(0.8 + rand())}" opacity="0"><animateTransform attributeName="transform" type="translate" values="${xy.join(';')}" dur="${DUR}s" repeatCount="indefinite"/>${anim('opacity', op)}</circle>`);
    }
  });

  const defs = `<g id="rose-shapes">${shapes.join('')}</g>`;
  const body = `
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <use href="#rose-shapes" stroke="${glow}" stroke-width="4" opacity="0.13"/>
      <use href="#rose-shapes" stroke="${stroke}" stroke-width="1.1" fill="${stroke}" fill-opacity="0.04"/>
    </g>
    <g fill="${glow}">${dust.join('')}</g>`;
  const base = project(rotX([0, -1.92, 0], -TILT), view);
  return { defs, body, baseY: Math.round(base[1]) };
}
