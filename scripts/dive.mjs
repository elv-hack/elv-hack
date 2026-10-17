/**
 * 电脑空间潜入：第一人称的网格迷宫（经典地牢探索的透视画法）。
 * 镜头站在格子中心，看向前方 5 格；墙由远到近一格一格画，带霓虹网格线和雾。
 * 数据节点是旋转的线框八面体（预先算好每一帧），核心是更大的双层八面体。
 */
import { esc, r1 } from './lib.mjs';
import { morph, pathOf, rotX, rotY } from './three.mjs';

/** S 起点，C 核心，其他字母是数据节点 */
export const MAP = [
  '###########',
  '#S....#...#',
  '#.###.#.#.#',
  '#.#E#...#Q#',
  '#.#.#####.#',
  '#...#C..#.#',
  '###.#.#.#.#',
  '#B..#.#...#',
  '#.###.###.#',
  '#....N#Z..#',
  '###########',
];
export const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export const DIR_NAMES = ['N', 'E', 'S', 'W'];

export const cell = (x, y) => MAP[y]?.[x] ?? '#';
export const isWall = (x, y) => cell(x, y) === '#';
export function start() {
  for (let y = 0; y < MAP.length; y++) {
    const x = MAP[y].indexOf('S');
    if (x >= 0) return { x, y, dir: 1 };
  }
  return { x: 1, y: 1, dir: 1 };
}

/** 走一步：left / right / back 只转向，forward 撞墙就不动 */
export function step(state, action) {
  const s = { ...state };
  if (action === 'left') s.dir = (s.dir + 3) % 4;
  else if (action === 'right') s.dir = (s.dir + 1) % 4;
  else if (action === 'back') s.dir = (s.dir + 2) % 4;
  else if (action === 'forward') {
    const [dx, dy] = DIRS[s.dir];
    if (isWall(s.x + dx, s.y + dy)) return { ...s, blocked: true };
    s.x += dx;
    s.y += dy;
  }
  return s;
}

// ---------- 渲染 ----------

const NEAR = 0.08;
const DEPTH = 6;
/** 镜头站在格子靠后的位置，最近的墙不会贴脸、两侧的走廊看得见 */
const BACK = 0.45;

function clip(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ina = a[2] >= NEAR;
    const inb = b[2] >= NEAR;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}

/** 线段对近平面裁剪，整段在镜头后面时返回 null */
function clipSegment(p, q) {
  if (p[2] < NEAR && q[2] < NEAR) return null;
  if (p[2] >= NEAR && q[2] >= NEAR) return [p, q];
  const t = (NEAR - p[2]) / (q[2] - p[2]);
  const m = p.map((v, i) => v + (q[i] - v) * t);
  return p[2] < NEAR ? [m, q] : [p, m];
}

/** 单位八面体绕 Y 轴转一圈的各帧（局部坐标，半径 1） */
function octaFrames(frames, stretch = 1.4) {
  const V = [
    [0, stretch, 0],
    [0, -stretch, 0],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const E = [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 4], [4, 3], [3, 5], [5, 2],
  ];
  return Array.from({ length: frames }, (_, i) => {
    const a = (i / frames) * Math.PI * 2;
    const P = V.map((v) => rotX(rotY(v, a), 0.35));
    return E.map(([p, q]) => `M${r1(P[p][0] * 10)} ${r1(-P[p][1] * 10)}L${r1(P[q][0] * 10)} ${r1(-P[q][1] * 10)}`).join('');
  });
}
const OCTA = octaFrames(16);
const OCTA_IN = octaFrames(16, 1).map((d) => d);

/**
 * 画第一人称视图。返回 { svg }，坐标在 (0,0)-(vw,vh) 的视口里。
 * nodes: { 字母: { name } }，colors: { wall, edge, floor, node, core, fog }
 */
export function view({ x, y, dir }, { vw, vh, nodes, colors, uid }) {
  const cx = vw / 2;
  const cy = vh / 2;
  // 视野放宽一点：贴着墙的时候两侧的走廊也看得见
  const f = vw * 0.46;
  const [fx, fy] = DIRS[dir];
  const [rx, ry] = DIRS[(dir + 1) % 4];
  const toWorld = (d, l) => [x + fx * d + rx * l, y + fy * d + ry * l];
  const proj = ([px, py, pz]) => [cx + (f * px) / pz, cy - (f * py) / pz];
  const poly = (pts) => {
    const c = clip(pts);
    return c.length >= 3 ? pathOf(c.map(proj), true) : '';
  };
  const fog = (z) => Math.max(0.06, Math.min(1, 1.15 - z / DEPTH));
  // 线条颜色可以按深度变化（近处一种颜色，越远越换色、越暗）
  const edgeAt = typeof colors.edge === 'function' ? colors.edge : () => colors.edge;
  const out = [];

  // 地板和天花板的网格
  const grid = [];
  for (let l = -4; l <= 4; l++) {
    const xL = l + 0.5;
    for (const yy of [-0.5, 0.5]) {
      const a = proj([xL, yy, NEAR + 0.3]);
      const b = proj([xL, yy, DEPTH + 0.5 + BACK]);
      grid.push(`<path d="M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}" stroke="${edgeAt(2)}" opacity="${yy < 0 ? 0.35 : 0.15}"/>`);
    }
  }
  for (let d = 0; d <= DEPTH; d++) {
    const z = d + 0.5 + BACK;
    for (const yy of [-0.5, 0.5]) {
      const a = proj([-4.5, yy, z]);
      const b = proj([4.5, yy, z]);
      grid.push(`<path d="M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}" stroke="${edgeAt(z)}" opacity="${r1(fog(z) * (yy < 0 ? 0.4 : 0.18))}"/>`);
    }
  }
  out.push(`<g stroke-width="1">${grid.join('')}</g>`);

  // 墙和节点：由远到近
  for (let d = DEPTH; d >= 0; d--) {
    const lats = [];
    for (let l = -4; l <= 4; l++) lats.push(l);
    lats.sort((a, b) => Math.abs(b) - Math.abs(a));
    for (const l of lats) {
      const [wx, wy] = toWorld(d, l);
      const c = cell(wx, wy);
      if (c === '#') {
        const z0 = d - 0.5 + BACK;
        const z1 = d + 0.5 + BACK;
        const faces = [];
        if (d > 0 || l !== 0) faces.push([[l - 0.5, -0.5, z0], [l - 0.5, 0.5, z0], [l + 0.5, 0.5, z0], [l + 0.5, -0.5, z0]]);
        if (l < 0) faces.push([[l + 0.5, -0.5, z0], [l + 0.5, 0.5, z0], [l + 0.5, 0.5, z1], [l + 0.5, -0.5, z1]]);
        if (l > 0) faces.push([[l - 0.5, -0.5, z0], [l - 0.5, 0.5, z0], [l - 0.5, 0.5, z1], [l - 0.5, -0.5, z1]]);
        for (const face of faces) {
          const dpath = poly(face);
          if (!dpath) continue;
          const zMid = Math.max(NEAR, (face[0][2] + face[2][2]) / 2);
          // 墙面上的网格线（三等分）：face 的四个角依次是 近下、近上、远上、远下（或 左下、左上、右上、右下）
          const lerp = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
          const lines = [];
          for (const t of [1 / 3, 2 / 3]) {
            for (const [p, q] of [
              [lerp(face[0], face[1], t), lerp(face[3], face[2], t)],
              [lerp(face[0], face[3], t), lerp(face[1], face[2], t)],
            ]) {
              const seg = clipSegment(p, q);
              if (seg) lines.push(pathOf(seg.map(proj)));
            }
          }
          // 墙面不透明（挡住后面的东西），只有线条随距离变淡
          out.push(`<path d="${dpath}" fill="${colors.wall}"/><g opacity="${r1(fog(zMid))}"><path d="${dpath}" fill="none" stroke="${edgeAt(zMid)}" stroke-width="1.3"/><path d="${lines.join('')}" stroke="${edgeAt(zMid)}" stroke-width="0.7" opacity="0.35"/></g>`);
        }
      } else if (nodes[c] && d > 0) {
        const p = proj([l, 0, d + BACK]);
        const s = (f / (d + BACK)) * 0.017;
        out.push(`<g transform="translate(${r1(p[0])} ${r1(p[1])})" opacity="${r1(fog(d))}">${colors.drawNode(c, s, d)}</g>`);
      }
    }
  }
  return out.join('');
}

/** 小地图：整张地图、节点、当前位置和朝向 */
export function minimap({ x, y, dir }, { size = 12, colors, nodes, visited = new Set() }) {
  const out = [];
  MAP.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c === '#') out.push(`<rect x="${i * size}" y="${j * size}" width="${size - 1}" height="${size - 1}" fill="${colors.wall}" opacity="0.9"/>`);
      else {
        out.push(`<rect x="${i * size}" y="${j * size}" width="${size - 1}" height="${size - 1}" fill="${colors.floor}" opacity="${visited.has(`${i},${j}`) ? 0.5 : 0.18}"/>`);
        if (nodes[c]) out.push(`<circle cx="${i * size + size / 2 - 0.5}" cy="${j * size + size / 2 - 0.5}" r="${c === 'C' ? size * 0.38 : size * 0.26}" fill="${c === 'C' ? colors.core : colors.node}"/>`);
      }
    }),
  );
  const px = x * size + size / 2 - 0.5;
  const py = y * size + size / 2 - 0.5;
  const rot = dir * 90;
  out.push(`<g transform="translate(${px} ${py}) rotate(${rot})"><path class="blip" d="M0 ${-size * 0.45}L${size * 0.38} ${size * 0.38}L0 ${size * 0.18}L${-size * 0.38} ${size * 0.38}Z" fill="${colors.player}" stroke="${colors.ink}" stroke-width="1"/></g>`);
  return out.join('');
}

/** 迷宫是否连通（构建时自检用） */
export function reachable() {
  const s = start();
  const seen = new Set([`${s.x},${s.y}`]);
  const queue = [[s.x, s.y]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of DIRS) {
      const k = `${cx + dx},${cy + dy}`;
      if (!isWall(cx + dx, cy + dy) && !seen.has(k)) {
        seen.add(k);
        queue.push([cx + dx, cy + dy]);
      }
    }
  }
  const missing = [];
  MAP.forEach((row, j) => [...row].forEach((c, i) => c !== '#' && c !== '.' && !seen.has(`${i},${j}`) && missing.push(c)));
  return missing;
}
