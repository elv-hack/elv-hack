/**
 * 原创的 ASCII 人脸：在代码里用有向距离场（SDF）搭一个 3D 头像（短发、义体质感），
 * 光线步进算出每个字符格的明暗，再按亮度映射成字符。头像缓慢左右转动，逐帧预先算好。
 * 不是任何现有角色。
 */

const RAMP = " .'`,:;-~=+*o%#&@";

const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

// 椭球的近似距离
const ellipsoid = (p, c, r) => {
  const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];
  const k0 = Math.hypot(...q);
  const k1 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]);
  return k1 ? (k0 * (k0 - 1)) / k1 : -1;
};
const smin = (a, b, k) => {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
};
const smax = (a, b, k) => -smin(-a, -b, k);

/** 场景：返回 [距离, 材质]；材质 0 皮肤，1 头发，2 眼睛，3 接缝 */
function scene(p) {
  const x = Math.abs(p[0]);
  const sym = [x, p[1], p[2]];
  // 头和下巴
  let skin = ellipsoid(p, [0, 0.12, 0], [0.6, 0.8, 0.66]);
  skin = smin(skin, ellipsoid(p, [0, -0.42, 0.06], [0.38, 0.4, 0.44]), 0.18);
  // 颧骨、鼻子、嘴唇
  skin = smin(skin, ellipsoid(sym, [0.3, -0.1, 0.38], [0.18, 0.12, 0.16]), 0.12);
  skin = smin(skin, ellipsoid(p, [0, -0.06, 0.6], [0.06, 0.2, 0.1]), 0.06);
  skin = smin(skin, ellipsoid(p, [0, -0.4, 0.56], [0.15, 0.05, 0.08]), 0.04);
  skin = smax(skin, -ellipsoid(p, [0, -0.415, 0.64], [0.13, 0.008, 0.05]), 0.01); // 唇缝
  // 眼窝
  skin = smax(skin, -ellipsoid(sym, [0.23, 0.13, 0.6], [0.13, 0.07, 0.1]), 0.05);
  // 脖子
  const neck = Math.max(Math.hypot(p[0], p[2] - 0.02) - 0.24, p[1] + 0.55, -(p[1] + 1.4));
  skin = smin(skin, neck, 0.1);
  // 眼球
  const eye = Math.hypot(sym[0] - 0.23, sym[1] - 0.12, sym[2] - 0.5) - 0.085;
  // 头发：齐耳短发 = 略大的头 − 脸部开口，前面留一排刘海
  let hair = ellipsoid(p, [0, 0.2, -0.06], [0.68, 0.84, 0.72]);
  const faceCut = Math.max(-(p[2] - 0.18), p[1] - 0.36 + 0.12 * Math.cos(p[0] * 9) * 0.3, x - 0.52);
  hair = smax(hair, -faceCut, 0.04);
  hair = Math.max(hair, -(p[1] + 0.34 + 0.06 * x)); // 发尾齐在下颌附近
  // 侧面的义体接缝：一条细凹槽
  const seam = Math.abs(ellipsoid(sym, [0.36, -0.12, 0.36], [0.2, 0.26, 0.3])) - 0.004;
  let best = [skin, 0];
  if (hair < best[0]) best = [hair, 1];
  if (eye < best[0]) best = [eye, 2];
  if (seam < 0.003 && skin < 0.01 && best[1] === 0) best = [skin, 3];
  return best;
}

const dist = (p) => scene(p)[0];
function normal(p) {
  const e = 0.003;
  return v3.norm([
    dist([p[0] + e, p[1], p[2]]) - dist([p[0] - e, p[1], p[2]]),
    dist([p[0], p[1] + e, p[2]]) - dist([p[0], p[1] - e, p[2]]),
    dist([p[0], p[1], p[2] + e]) - dist([p[0], p[1], p[2] - e]),
  ]);
}

/**
 * 渲染一帧：cols × rows 个字符，yaw 是头转动的角度（弧度）。
 * 返回 rows 行字符串，以及每个字符的材质（用来上不同的颜色）。
 */
export function faceFrame({ cols = 72, rows = 40, yaw = 0, pitch = 0.04 }) {
  const lines = [];
  const mats = [];
  const light = v3.norm([-0.55, 0.6, 0.75]);
  const rim = v3.norm([0.8, 0.2, -0.4]);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // 把世界坐标转到头的局部坐标（头在转）
  const toLocal = (p) => {
    let [x, y, z] = p;
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    return [x * cy - z * sy, y, x * sy + z * cy];
  };
  const aspect = 0.55; // 字符宽高比
  for (let r = 0; r < rows; r++) {
    let line = '';
    const mrow = [];
    for (let c = 0; c < cols; c++) {
      const u = ((c + 0.5) / cols - 0.5) * 2.2;
      const v = -((r + 0.5) / rows - 0.5) * 2.2 * (rows / cols / aspect);
      const ro = [u, v + 0.05, 3];
      const rd = [0, 0, -1];
      let t = 1.2;
      let hit = -1;
      let mat = 0;
      for (let i = 0; i < 70; i++) {
        const p = toLocal(v3.add(ro, v3.mul(rd, t)));
        const [d, m] = scene(p);
        if (d < 0.002) {
          hit = t;
          mat = m;
          break;
        }
        t += d * 0.9;
        if (t > 5) break;
      }
      if (hit < 0) {
        line += ' ';
        mrow.push(-1);
        continue;
      }
      const pl = toLocal(v3.add(ro, v3.mul(rd, hit)));
      const nl = normal(pl);
      // 法线转回世界坐标
      const n = [nl[0] * cy + nl[2] * sy, nl[1], -nl[0] * sy + nl[2] * cy];
      let lum = 0.12 + 0.75 * Math.max(0, v3.dot(n, light)) + 0.35 * Math.pow(Math.max(0, v3.dot(n, rim)), 2);
      if (mat === 1) lum *= 0.75;
      if (mat === 2) lum = 0.95;
      if (mat === 3) lum = 0.6;
      lum = Math.max(0, Math.min(0.999, lum));
      line += RAMP[1 + Math.floor(lum * (RAMP.length - 1))] ?? '@';
      mrow.push(mat);
    }
    lines.push(line);
    mats.push(mrow);
  }
  return { lines, mats };
}

const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rr = (n) => Math.round(n * 10) / 10;

/**
 * 整张会转头的脸：frames 帧从左转到右再转回来（往返），每帧一组 <text>。
 * fill 是脸的颜色（可以是渐变），eye 是眼睛的颜色。返回 { body, css }，以 (cx, cy) 为中心。
 */
export function faceLayer({ cols = 92, rows = 52, size = 10, cx, cy, frames = 12, step = 0.32, swing = 0.36, fill, eye }) {
  const charW = size * 0.6;
  const lineH = size * 1.02;
  const yaws = Array.from({ length: frames }, (_, i) => -swing + (2 * swing * i) / (frames - 1));
  const seq = [...Array(frames).keys(), ...Array.from({ length: frames - 2 }, (_, i) => frames - 2 - i)];
  const cycle = seq.length * step;
  const pct = (t) => rr((t / cycle) * 100);
  const css = [];
  const groups = yaws.map((yaw, i) => {
    const fr = faceFrame({ cols, rows, yaw });
    const times = seq.map((s, k) => (s === i ? k : -1)).filter((k) => k >= 0);
    const kf = ['0% { opacity: 0; }'];
    for (const k of times) kf.push(`${pct(k * step)}% { opacity: 1; }`, `${pct((k + 1) * step)}% { opacity: 0; }`);
    css.push(`.fr${i} { opacity: 0; animation: fr${i} ${rr(cycle)}s steps(1, end) infinite; } @keyframes fr${i} { ${kf.join(' ')} }`);
    const text = fr.lines.map((ln, r) => `<text y="${rr(r * lineH)}" xml:space="preserve">${escText(ln.replace(/\s+$/, ''))}</text>`).join('');
    const eyes = [];
    fr.mats.forEach((m, r) => {
      let run = '';
      let start = -1;
      for (let k = 0; k <= m.length; k++) {
        if (m[k] === 2) {
          if (start < 0) start = k;
          run += fr.lines[r][k];
        } else if (start >= 0) {
          eyes.push(`<text x="${rr(start * charW)}" y="${rr(r * lineH)}">${escText(run)}</text>`);
          run = '';
          start = -1;
        }
      }
    });
    return `<g class="fr${i}"><g fill="${fill}">${text}</g><g fill="${eye}">${eyes.join('')}</g></g>`;
  });
  const x = cx - (cols * charW) / 2;
  const y = cy - (rows * lineH) / 2;
  const body = `<defs><radialGradient id="faceMaskG" cx="0.5" cy="0.45" r="0.55"><stop offset="0.55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="faceMask" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#faceMaskG)"/></mask></defs>
    <g class="breathe" mask="url(#faceMask)"><g class="mono" font-size="${size}" transform="translate(${rr(x)} ${rr(y)})">${groups.join('')}</g></g>`;
  return {
    body,
    css: `${css.join('\n')}\n  .breathe { animation: breathe 8s ease-in-out infinite alternate; } @keyframes breathe { to { opacity: 0.72; } }`,
  };
}
