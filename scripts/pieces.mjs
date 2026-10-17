/**
 * 主页上的各个画面（生成脚本和 Worker 共用）。统一的视觉语言：
 * 深色“数据深渊”底、细点阵纹理、细线、等宽小字说明、大量留白；颜色在几个低饱和色相之间缓慢流转。
 */
import { ABYSS as C, dataTunnel, dotGrid, flowGradient } from './abyss.mjs';
import { DIRS, MAP, cell, minimap, view } from './dive.mjs';
import { FORM_CSS, knotFrames, lissajousFrames, roseStack, solidFrames, sphereRings, spinForm, torus, wire } from './forms.mjs';
import { esc, r1, rng } from './lib.mjs';

const FONT_SIZE = { caption: 11, small: 10 };

/** 所有画面共用的外框：圆角、点阵纹理、暗角 */
function panel({ W, H, uid, body, css = '', defs = '', fonts }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${fonts}${FORM_CSS}${css}
  .fade { animation: fade 1.4s 0.2s ease both; }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<defs>
  ${dotGrid(`${uid}-dots`, C.mid, 16, 0.7, 0.22)}
  <radialGradient id="${uid}-vig" cx="0.5" cy="0.5" r="0.8"><stop offset="0.5" stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0.85"/></radialGradient>
  ${flowGradient(`${uid}-flow`, { dur: 20 })}
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

/** 右侧说明栏：标题 + 若干 “键 — 值” 行 */
function sidebar(x, y, title, rows, uid) {
  const lines = rows
    .map(([k, v, hi], i) => `<text class="mono" x="${x}" y="${y + 52 + i * 22}" font-size="${FONT_SIZE.caption}" letter-spacing="1"><tspan fill="${C.mid}">${esc(k.padEnd(10, ' '))}</tspan><tspan fill="${hi ? C.amber : C.ink}" xml:space="preserve"> ${esc(v)}</tspan></text>`)
    .join('');
  return `<g class="fade"><text class="display" x="${x}" y="${y}" font-size="26" font-weight="500" fill="${C.ink}" letter-spacing="-0.5">${esc(title)}</text>
    <rect x="${x}" y="${y + 16}" width="24" height="2" fill="url(#${uid}-flow)"/>${lines}</g>`;
}

const ago = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

// ---------- 玫瑰曲线碎片 ----------

export const ROSE_KS = [5 / 2, 7 / 3, 4, 3 / 2, 7 / 4, 5, 8 / 3, 6 / 5];
const kLabel = (k) => {
  for (let d = 1; d <= 6; d++) if (Math.abs(k * d - Math.round(k * d)) < 1e-6) return d === 1 ? `${Math.round(k)}` : `${Math.round(k * d)}/${d}`;
  return k.toFixed(2);
};

export function rosePanel({ placed = 0, last, now = Date.now(), fonts }) {
  const W = 1200;
  const H = 560;
  const probe = roseStack({ lit: 0 });
  const per = probe.total;
  const cycle = Math.floor(placed / per);
  const lit = placed % per;
  const k = ROSE_KS[cycle % ROSE_KS.length];
  const rs = roseStack({ lit, seed: cycle + 1, k });
  const form = spinForm({ uid: 'rose', rings: rs.rings, tilt: 0.5, dur: 52, colors: { ink: 'url(#rose-flow)', faint: C.faint, accent: C.amber } });
  const ticks = Array.from({ length: per }, (_, i) => `<rect x="${786 + (i % 30) * 12}" y="${336 + Math.floor(i / 30) * 14}" width="8" height="8" fill="${i < lit ? 'url(#rose-flow)' : 'none'}" stroke="${i < lit ? 'none' : C.faint}"/>`).join('');
  const body = `
  <g opacity="0.5">
    <ellipse cx="400" cy="290" rx="250" ry="${r1(250 * Math.sin(0.5))}" fill="none" stroke="${C.line}" stroke-dasharray="2 6"/>
    <path d="M400 70V510M150 290H650" stroke="${C.line}"/>
  </g>
  <g transform="translate(400 290)">${form.body}</g>
  <text class="mono fade" x="64" y="${H - 48}" font-size="${FONT_SIZE.small}" fill="${C.mid}" letter-spacing="1.2">fig. 2 — r = cos(${kLabel(k)}θ), ${rs.rings.length} layers, twisted</text>
  ${sidebar(786, 108, 'rose', [
    ['a drawing', 'made by everyone who passes'],
    ['fragments', `${String(lit).padStart(2, '0')} / ${per}`, true],
    ['cycle', `${String(cycle + 1).padStart(2, '0')}  ·  k = ${kLabel(k)}`],
    ['completed', `${cycle} rose${cycle === 1 ? '' : 's'}`],
    ['last', last ? `${last.country} · ${ago(now - last.ts)}` : '—'],
  ], 'rose')}
  <g class="fade">${ticks}</g>
  <text class="mono fade" x="786" y="${H - 72}" font-size="${FONT_SIZE.caption}" fill="${C.ink}" letter-spacing="1">place one fragment below — the next rose</text>
  <text class="mono fade" x="786" y="${H - 52}" font-size="${FONT_SIZE.caption}" fill="${C.mid}" letter-spacing="1">grows when this one is whole.</text>`;
  return panel({ W, H, uid: 'rose', body, defs: form.defs, fonts });
}

// ---------- 迷宫 ----------

export const NODES = {
  C: { name: 'core', note: 'the end of the maze' },
  E: { name: 'elvhack', note: 'source of elvhack.com' },
  Q: { name: 'quantcore', note: 'quant engine' },
  Z: { name: 'Z3r0', note: 'red-team workbench (fork)' },
  N: { name: 'nexus', note: 'open-source intelligence graph' },
  B: { name: 'notes', note: 'elvhack.com/posts' },
};

const SOLID_NODE = solidFrames('octahedron', { size: 10, frames: 24 });
const SOLID_CORE = solidFrames('icosahedron', { size: 14, frames: 24 });
const DEPTH_HUES = ['#2ad1c9', '#4aa6e8', '#5b6cff', '#8a62e8', '#d65bd6', '#d65bd6', '#d65bd6'];

/** 前方是什么：墙、通道几格、节点 */
function lookAhead({ x, y, dir }) {
  const [dx, dy] = DIRS[dir];
  for (let d = 1; d <= 10; d++) {
    const c = cell(x + dx * d, y + dy * d);
    if (c === '#') return d === 1 ? 'a wall' : `corridor, ${d - 1} cell${d > 2 ? 's' : ''}`;
    if (NODES[c]) return `${NODES[c].name}, ${d} cell${d > 1 ? 's' : ''}`;
  }
  return 'corridor';
}

export function divePanel({ state, last, steps = 0, breaches = 0, now = Date.now(), fonts }) {
  const W = 1200;
  const H = 560;
  const vw = 700;
  const vh = 480;
  const here = cell(state.x, state.y);
  const colors = {
    wall: C.bg,
    edge: (z) => DEPTH_HUES[Math.min(DEPTH_HUES.length - 1, Math.max(0, Math.floor(z - 0.2)))],
    drawNode: (c, s) => {
      const core = c === 'C';
      return `<g transform="scale(${r1(Math.max(0.5, s))})">${wire(core ? SOLID_CORE : SOLID_NODE, core ? 6 : 9, core ? C.amber : C.ink, r1(1.2 / Math.max(0.5, s)))}</g>
        <text class="mono" y="${r1(Math.max(0.5, s) * 26)}" font-size="${r1(Math.max(9, Math.min(13, s * 9)))}" fill="${core ? C.amber : C.mid}" text-anchor="middle" letter-spacing="1">${esc(NODES[c].name)}</text>`;
    },
  };
  // 进场动画：前进 = 往前推近；转向 = 从侧面滑进来；掉头 = 淡入
  const move = last?.item;
  const enter = move === 'forward' ? 'enterFwd' : move === 'left' ? 'enterL' : move === 'right' ? 'enterR' : 'enterFade';
  const atNode = NODES[here] && here !== 'C';
  const banner =
    here === 'C'
      ? `<g class="fade"><rect x="40" y="${40 + vh - 86}" width="${vw}" height="86" fill="${C.bg}" opacity="0.88"/>
          <text class="display" x="64" y="${40 + vh - 44}" font-size="24" font-weight="500" fill="${C.amber}">core reached.</text>
          <text class="mono" x="64" y="${40 + vh - 20}" font-size="${FONT_SIZE.caption}" fill="${C.mid}" letter-spacing="1">breach no. ${breaches} — any move returns to the entrance.</text></g>`
      : atNode
        ? `<g class="fade"><rect x="40" y="${40 + vh - 70}" width="${vw}" height="70" fill="${C.bg}" opacity="0.88"/>
            <text class="mono" x="64" y="${40 + vh - 38}" font-size="13" fill="${C.ink}" letter-spacing="1">node — ${esc(NODES[here].name)}</text>
            <text class="mono" x="64" y="${40 + vh - 18}" font-size="${FONT_SIZE.caption}" fill="${C.mid}" letter-spacing="1">${esc(NODES[here].note)}</text></g>`
        : '';
  const body = `
  <defs><clipPath id="dive-vp"><rect x="40" y="40" width="${vw}" height="${vh}"/></clipPath></defs>
  <g clip-path="url(#dive-vp)"><rect x="40" y="40" width="${vw}" height="${vh}" fill="${C.bg}"/>
    <g transform="translate(40 40)"><g class="${enter}">${view(state, { vw, vh, nodes: NODES, colors, uid: 'dv' })}</g></g>
  </g>
  <rect x="40" y="40" width="${vw}" height="${vh}" fill="none" stroke="${C.line}"/>
  ${banner}
  ${sidebar(786, 108, 'dive', [
    ['position', `${String(state.x).padStart(2, '0')} / ${String(state.y).padStart(2, '0')}  ·  facing ${'NESW'[state.dir]}`],
    ['ahead', lookAhead(state), true],
    ['steps', String(steps)],
    ['breaches', String(breaches)],
    ['last move', last ? `${last.item}, ${last.country} · ${ago(now - last.ts)}` : '—'],
  ], 'dive')}
  <g transform="translate(786 ${H - 196})" class="fade">${minimap(state, { size: 12, colors: { wall: C.faint, floor: C.bg, node: C.mid, core: C.amber, player: C.teal, ink: C.bg }, nodes: NODES })}</g>
  <text class="mono fade" x="${786 + 11 * 12 + 24}" y="${H - 180}" font-size="${FONT_SIZE.small}" fill="${C.mid}" letter-spacing="1">map</text>
  <text class="mono fade" x="${786 + 11 * 12 + 24}" y="${H - 160}" font-size="${FONT_SIZE.small}" fill="${C.mid}" letter-spacing="1">shared by every</text>
  <text class="mono fade" x="${786 + 11 * 12 + 24}" y="${H - 144}" font-size="${FONT_SIZE.small}" fill="${C.mid}" letter-spacing="1">visitor.</text>`;
  const css = `
  .enterFwd { transform-origin: ${vw / 2}px ${vh / 2}px; animation: enterFwd 1.1s cubic-bezier(0.2, 0.7, 0.1, 1) both; }
  .enterL { animation: enterL 1s cubic-bezier(0.2, 0.7, 0.1, 1) both; }
  .enterR { animation: enterR 1s cubic-bezier(0.2, 0.7, 0.1, 1) both; }
  .enterFade { animation: fade 1.2s ease both; }
  @keyframes enterFwd { from { transform: scale(0.8); opacity: 0.25; } }
  @keyframes enterL { from { transform: translateX(-${vw * 0.35}px); opacity: 0.2; } }
  @keyframes enterR { from { transform: translateX(${vw * 0.35}px); opacity: 0.2; } }`;
  return panel({ W, H, uid: 'dive', body, css, fonts });
}

// ---------- 抽一件生成艺术 ----------

export const RATES = { SSR: 0.04, SR: 0.22, R: 0.74 };

/** 由编号决定的标本：稀有度决定形体的复杂程度 */
export function specimen(no, rarity) {
  const rand = rng(`specimen-${no}`);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  if (rarity === 'R') {
    const kind = pick(['tetrahedron', 'cube', 'octahedron', 'icosahedron', 'sphere']);
    return { rarity, kind, name: kind === 'sphere' ? 'point sphere' : kind, seed: no };
  }
  if (rarity === 'SR') {
    const kind = pick(['knot', 'lissajous', 'rose']);
    if (kind === 'knot') {
      const [p, q] = pick([[2, 3], [2, 5], [3, 4], [3, 5], [2, 7], [3, 7]]);
      return { rarity, kind, p, q, name: `torus knot (${p}, ${q})` };
    }
    if (kind === 'lissajous') {
      const [a, b, c] = pick([[1, 2, 3], [2, 3, 4], [3, 4, 5], [1, 3, 5], [2, 5, 3]]);
      return { rarity, kind, a, b, c, name: `lissajous ${a}:${b}:${c}` };
    }
    const k = pick(ROSE_KS);
    return { rarity, kind, k, name: `rose, k = ${kLabel(k)}` };
  }
  const [a, b] = pick([['icosahedron', 'cube'], ['octahedron', 'cube'], ['icosahedron', 'tetrahedron']]);
  return { rarity, kind: 'compound', a, b, name: `compound — ${a} / ${b}` };
}

/** 画一件标本，以 (0,0) 为中心，大约占 2·size 见方 */
export function drawSpecimen(sp, { uid, size = 150, stroke, still = false }) {
  const s = stroke ?? `url(#${uid}-flow)`;
  // 缩略图只画第一帧，不动，省体积
  const w = (frames, dur, color, width, extra = '') =>
    still ? `<path d="${frames[0]}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"${extra}/>` : wire(frames, dur, color, width, extra);
  switch (sp.kind) {
    case 'sphere': {
      const f = spinForm({ uid: `${uid}-sp`, rings: sphereRings({ R: size, lat: 14, per: 40 }), tilt: 0.45, dur: 30, dot: 1.6, colors: { ink: C.ink, faint: C.faint, accent: C.amber }, enter: false });
      return `<defs>${f.defs}</defs>${f.body}`;
    }
    case 'knot':
      return w(knotFrames(sp.p, sp.q, { size, frames: still ? 1 : 36 }), 26, s, 1.4);
    case 'lissajous':
      return w(lissajousFrames(sp.a, sp.b, sp.c, { size, frames: still ? 1 : 36 }), 30, s, 1.3);
    case 'rose': {
      const rs = roseStack({ lit: 999, k: sp.k, size: size * 0.95, height: size * 1.15, layers: 9 });
      const f = spinForm({ uid: `${uid}-ro`, rings: rs.rings, tilt: 0.5, dur: 40, colors: { ink: s, faint: C.faint, accent: s }, enter: false });
      return `<defs>${f.defs}</defs>${f.body}`;
    }
    case 'compound':
      return `${w(solidFrames(sp.a, { size, frames: still ? 1 : 36 }), 24, s, 1.5)}${w(solidFrames(sp.b, { size: size * 0.62, frames: still ? 1 : 36, phase: 0.6 }).reverse(), 18, C.amber, 1.2)}
        <ellipse rx="${r1(size * 1.35)}" ry="${r1(size * 0.36)}" fill="none" stroke="${C.line}" stroke-dasharray="2 5"/>`;
    default:
      return w(solidFrames(sp.kind, { size, frames: still ? 1 : 36 }), 22, s, 1.5);
  }
}

export function drawPanel({ total = 0, latest, history = [], counts = {}, now = Date.now(), fonts }) {
  const W = 1200;
  const H = 560;
  const sp = latest ? specimen(latest.no, latest.rarity) : null;
  const hist = history
    .slice(0, 8)
    .map((h, i) => {
      const s = specimen(h.no, h.rarity);
      return `<g transform="translate(${806 + i * 44} 392)" opacity="${r1(1 - i * 0.09)}">${drawSpecimen(s, { uid: `h${i}`, size: 15, still: true, stroke: h.rarity === 'SSR' ? C.amber : h.rarity === 'SR' ? C.teal : C.ink })}</g>`;
    })
    .join('');
  const body = `
  <g opacity="0.5"><circle cx="400" cy="285" r="220" fill="none" stroke="${C.line}" stroke-dasharray="2 6"/><path d="M400 50V520M160 285H640" stroke="${C.line}"/></g>
  ${sp ? `<g transform="translate(400 285)" class="arrive">${drawSpecimen(sp, { uid: 'draw', size: 150 })}</g>` : `<g transform="translate(400 285)" opacity="0.5">${wire(solidFrames('cube', { size: 120, frames: 40 }), 30, C.faint, 1, ' stroke-dasharray="3 5"')}</g>`}
  <text class="mono fade" x="64" y="${H - 48}" font-size="${FONT_SIZE.small}" fill="${C.mid}" letter-spacing="1.2">${sp ? `fig. 4 — ${esc(sp.name)}` : 'fig. 4 — nothing drawn yet'}</text>
  ${sidebar(786, 108, 'draw', [
    ['specimen', sp ? `No. ${String(latest.no).padStart(4, '0')}` : '—'],
    ['rarity', sp ? sp.rarity : '—', true],
    ['form', sp ? sp.name : 'draw the first one'],
    ['drawn by', latest ? `${latest.country} · ${ago(now - latest.ts)}` : '—'],
    ['so far', `${total} drawn · ${counts.SSR ?? 0} SSR · ${counts.SR ?? 0} SR`],
    ['odds', 'SSR 4% · SR 22% · R 74%'],
  ], 'draw')}
  ${hist ? `<text class="mono fade" x="786" y="356" font-size="${FONT_SIZE.small}" fill="${C.mid}" letter-spacing="1">recent</text><g class="fade">${hist}</g>` : ''}`;
  const css = `
  .arrive { animation: arrive 1.6s cubic-bezier(0.2, 0.7, 0.1, 1) both; }
  @keyframes arrive { from { opacity: 0; transform: translate(400px, 285px) scale(0.6); } to { transform: translate(400px, 285px) scale(1); } }`;
  return panel({ W, H, uid: 'draw', body, css, fonts });
}

// ---------- 一年的提交（12 个月叠成的圆柱，一起旋转） ----------

export function yearPanel({ days, total, fonts }) {
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
  const peak = days.reduce((a, b) => (b.count > a.count ? b : a), days[0] ?? { count: 0, date: '—' });
  const body = `
  <g transform="translate(400 262)">${guides}${form.body}</g>
  <path d="M400 40V480" stroke="${C.line}"/>
  <text class="mono fade" x="64" y="${H - 44}" font-size="${FONT_SIZE.small}" fill="${C.mid}" letter-spacing="1.2">fig. 5 — twelve months stacked, one dot a day</text>
  ${sidebar(786, 108, 'a year', [
    ['commits', String(total), true],
    ['active days', String(days.filter((d) => d.count > 0).length)],
    ['busiest', `${peak.date} · ${peak.count}`],
    ['legend', 'teal = a day with commits'],
    ['', 'amber = one of the busiest'],
  ], 'year')}`;
  return panel({ W, H, uid: 'year', body, defs: form.defs, fonts });
}

// ---------- 片头 ----------

export function headerPanel({ faceGroups, faceCss, fonts }) {
  const W = 1200;
  const H = 620;
  const tunnel = dataTunnel({ uid: 'tn', W, H, cx: 850, cy: 300, layers: 10, dur: 34 });
  const body = `
  ${tunnel.body}
  <radialGradient id="hd-glow" cx="0.7" cy="0.48" r="0.4"><stop offset="0" stop-color="${C.indigo}" stop-opacity="0.12"/><stop offset="1" stop-color="${C.indigo}" stop-opacity="0"/></radialGradient>
  <rect width="${W}" height="${H}" fill="url(#hd-glow)"/>
  ${faceGroups}
  <g class="fade">
    <text class="display" x="72" y="104" font-size="28" font-weight="500" fill="${C.ink}" letter-spacing="-0.5">elvhack</text>
    <text class="mono" x="${W - 72}" y="100" font-size="${FONT_SIZE.small}" fill="${C.mid}" text-anchor="end" letter-spacing="1.2">N° 01</text>
    <text class="mono" x="72" y="${H - 132}" font-size="${FONT_SIZE.caption}" fill="${C.ink}" letter-spacing="1.2">quant / security / development / intelligence</text>
    <text class="mono" x="72" y="${H - 110}" font-size="${FONT_SIZE.caption}" fill="${C.mid}" letter-spacing="1.2">depth — unbounded</text>
    <text class="mono" x="72" y="${H - 92}" font-size="${FONT_SIZE.caption}" fill="${C.mid}" letter-spacing="1.2">elvhack.com</text>
    <rect x="72" y="${H - 74}" width="24" height="2" fill="url(#head-flow)"/>
    <text class="mono" x="${W - 72}" y="${H - 64}" font-size="${FONT_SIZE.small}" fill="${C.mid}" text-anchor="end" letter-spacing="1.2">fig. 1 — a face made of glyphs, surfacing from the data</text>
  </g>`;
  return panel({ W, H, uid: 'head', body, css: `${tunnel.css}${faceCss}`, fonts });
}

// ---------- 按钮 ----------

const GLYPHS = {
  place: 'M0 -8V8M-8 0H8',
  forward: 'M0 9V-9M-6 -3L0 -9L6 -3',
  left: 'M9 0H-9M-3 -6L-9 0L-3 6',
  right: 'M-9 0H9M3 -6L9 0L3 6',
  back: 'M6 -6A8 8 0 1 0 8 2M8 -7V-1H2',
  draw: 'M0 -9L8 0L0 9L-8 0Z',
};

export function buttonPanel({ glyph, label, sub, count, fonts, w = 280 }) {
  const H = 72;
  const body = `
  <g transform="translate(36 36)"><path d="${GLYPHS[glyph]}" fill="none" stroke="url(#btn-flow)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>
  <text class="mono" x="66" y="33" font-size="13" fill="${C.ink}" letter-spacing="1">${esc(label)}</text>
  <text class="mono" x="66" y="52" font-size="${FONT_SIZE.small}" fill="${C.mid}" letter-spacing="1">${esc(sub)}</text>
  ${count != null ? `<text class="mono" x="${w - 22}" y="33" font-size="${FONT_SIZE.small}" fill="${C.mid}" text-anchor="end" letter-spacing="1">${String(count).padStart(4, '0')}</text>` : ''}
  <rect class="sweep" x="0" y="${H - 2}" width="60" height="2" fill="url(#btn-flow)"/>`;
  const css = `.sweep { animation: sweep 4s cubic-bezier(0.6, 0, 0.4, 1) infinite; } @keyframes sweep { from { transform: translateX(-60px); } to { transform: translateX(${w}px); } }`;
  return panel({ W: w, H, uid: 'btn', body, css, fonts }).replace('<rect width="' + w + '" height="' + H + '" fill="url(#btn-vig)" pointer-events="none"/>', '');
}
