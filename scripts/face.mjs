/**
 * 片头的 ASCII 肖像：三张图的字符画由 scripts/faces-from-images.py 预先转换好（scripts/faces.json）。
 *
 * 三张图轮流从暗处浮现、停一会儿、再消散回暗处，不移动。
 * - 浮现：每个字符按亮度分进 BANDS 层，最亮的（高光、发光的眼睛）先亮起来，暗部最后才补齐；
 *   消散反过来，暗部先褪掉，高光最后熄灭，一边褪一边微微上飘。
 * - 分层带一点随机，明暗交界处像颗粒一样散开，不是一条硬线。
 * - 全是 CSS 动画。这张图是 GitHub 用 <img> 显示的，只要有一处在动，整张图每一帧都要重画（上万个字符），
 *   所以除了浮现和消散，别的都不动（颜色渐变是静止的）；不在画面上的图用 visibility 藏起来
 *   （opacity 为 0 的元素照样要画，visibility: hidden 的才会跳过）。
 */
import { flowGradient } from './abyss.mjs';
import { rng } from './lib.mjs';

/** 三张图：主色（铺在渐变里的几个色相）、强调色（高光）；light 是浅色主题用的一套（白底上要深一些） */
export const FACES = [
  { id: 'ghost', hues: ['#b9a8ff', '#8a96ff', '#dcb3ff', '#9fe6f0'], accent: '#ff5468', light: { hues: ['#4a3fc8', '#2f45c2', '#7440c9', '#1d6f8c'], accent: '#d91f3c' } },
  { id: 'crimson', hues: ['#ff7d93', '#e98ae9', '#ffa47f', '#ff6f8a'], accent: '#ffd6dc', light: { hues: ['#b8183e', '#952d9a', '#c24a22', '#a51a48'], accent: '#e2436a' } },
  { id: 'phantom', hues: ['#c6d4e4', '#9aa8ff', '#7fe3dc', '#e6ecf5'], accent: '#ff8a4a', light: { hues: ['#2c3c54', '#3442b8', '#0f6f77', '#3d4a60'], accent: '#d65410' } },
];

const RAMP = " .'`,:;-~=+*o%#&@";
const BANDS = 6;
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rr = (n) => Math.round(n * 100) / 100;
const pc = (t, C) => `${rr((t / C) * 100)}%`;

/**
 * 一张图拆成 BANDS 层 <text>：第 0 层是最亮的字符和强调色，越往后越暗。
 * 每一行里同一层的字符隔得远（中间 6 个以上空格）就拆成两段，省掉大段空格。
 */
function bandsOf(p, size) {
  const charW = size * 0.6;
  const lineH = size * 1.02;
  const rand = rng(`face-${p.id}`);
  const accent = new Set(p.acc.flatMap(([r, a, b]) => Array.from({ length: b - a }, (_, i) => `${r},${a + i}`)));
  const segments = (s, r) =>
    [...s.matchAll(/\S(?:.*?\S)?(?= {6,}|\s*$)/g)].map((m) => `<text x="${rr(m.index * charW)}" y="${rr(r * lineH)}" xml:space="preserve">${escText(m[0])}</text>`);
  const rows = Array.from({ length: BANDS }, () => []);
  const accRows = [];
  p.lines.forEach((line, r) => {
    const per = Array.from({ length: BANDS }, () => [...' '.repeat(line.length)]);
    const acc = [...' '.repeat(line.length)];
    [...line].forEach((ch, c) => {
      if (ch === ' ') return;
      if (accent.has(`${r},${c}`)) {
        acc[c] = ch;
        return;
      }
      const lvl = RAMP.indexOf(ch) / (RAMP.length - 1);
      const band = Math.max(0, Math.min(BANDS - 1, Math.floor((1 - lvl) * BANDS + (rand() - 0.5) * 1.6)));
      per[band][c] = ch;
    });
    per.forEach((chars, k) => rows[k].push(...segments(chars.join(''), r)));
    accRows.push(...segments(acc.join(''), r));
  });
  return { bands: rows.map((r) => r.join('')), accent: accRows.join(''), w: p.cols * charW, h: p.rows * lineH };
}

/**
 * 整个肖像层。faces 是 faces.json 里的 portraits（顺序和 FACES 一致），以 (cx, cy) 为中心。
 * slot 是相邻两张图开始浮现的间隔；最后一层熄灭时下一张已经开始亮起，中间没有空档。
 * 返回 { defs, body, css }。
 */
export function faceLayer({ faces, size = 5.8, cx, cy, theme = 'dark', slot = 10.5, stagger = 0.55, fade = 2, hold = 6.5 }) {
  const n = faces.length;
  const C = n * slot;
  const css = [];
  // 第 k 层：浮现从 k·stagger 开始；消散倒过来，暗的层先走
  for (let k = 0; k < BANDS; k++) {
    const tIn = k * stagger;
    const tOut = hold + (BANDS - 1 - k) * stagger;
    css.push(`.b${k} { opacity: 0; animation: em${k} ${rr(C)}s var(--d) infinite; }
  @keyframes em${k} { 0%, ${pc(tIn, C)} { opacity: 0; transform: none; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } ${pc(tIn + fade, C)}, ${pc(tOut, C)} { opacity: 1; transform: none; animation-timing-function: cubic-bezier(0.5, 0, 0.7, 1); } ${pc(tOut + fade, C)}, 100% { opacity: 0; transform: translateY(-6px); } }`);
  }
  const last = hold + (BANDS - 1) * stagger + fade;
  css.push(`.pv { visibility: hidden; animation: pv ${rr(C)}s var(--d) infinite; } @keyframes pv { 0% { visibility: visible; } ${pc(last + 0.1, C)}, 100% { visibility: hidden; } }`);
  // 不要动画的时候只显示第一张
  css.push(`@media (prefers-reduced-motion: reduce) { .pv0, .pv0 [class^="b"] { visibility: visible; opacity: 1; } }`);

  const defs = [];
  const layers = faces.map((p, j) => {
    const base = FACES.find((f) => f.id === p.id);
    const meta = theme === 'light' ? { ...base, ...base.light } : base;
    const b = bandsOf(p, size);
    defs.push(flowGradient(`pf-${p.id}`, { x1: 0, y1: 0, x2: rr(b.w), y2: rr(b.h), hues: meta.hues, units: 'userSpaceOnUse', still: true }));
    const groups = b.bands.map((t, k) => `<g class="b${k}">${k === 0 ? `<g fill="${meta.accent}">${b.accent}</g>` : ''}${t}</g>`).join('');
    return `<g class="pv pv${j}" style="--d:${rr(j * slot)}s"><g transform="translate(${rr(cx - b.w / 2)} ${rr(cy - b.h / 2)})" fill="url(#pf-${p.id})">${groups}</g></g>`;
  });
  return { defs: defs.join(''), body: `<g class="mono" font-size="${size}" font-weight="600">${layers.join('')}</g>`, css: css.join('\n  ') };
}
