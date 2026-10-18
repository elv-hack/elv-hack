/**
 * 片头的 ASCII 肖像：三张图的字符帧由 scripts/faces-from-images.py 预先转换好（scripts/faces.json），
 * 由调用方读进来传给 faceLayer（Worker 直接 import，Node 脚本用 readFileSync）。
 *
 * - 每张图自己往返转头：frames 帧从左转到右再转回来，每帧一组 <text>（CSS 逐帧切换 visibility）。
 * - 三张图轮流浮现：交接时一道扫描线从上往下扫过，线以上是新的图、线以下还是旧的（SMIL 遮罩）；
 *   不在画面上的图 display: none。这张图是 GitHub 用 <img> 显示的，每一帧都要整张重画，画得越少越流畅。
 * - order 决定先后：Worker 把访客选中的那张排在最前面，页面一打开就是它从数据里解码出来。
 */
import { flowGradient } from './abyss.mjs';
import { rng } from './lib.mjs';

/** 三张图：编号（罗马数字，和下面各个画面的 fig. 编号区分开）、主色（渐变里流转的几个色相）、强调色（高光）、图注 */
export const FACES = [
  { id: 'ghost', numeral: 'I', name: 'ghost', hues: ['#b9a8ff', '#8a96ff', '#dcb3ff', '#9fe6f0'], accent: '#ff5468', note: 'line and violet, surfacing from the data' },
  { id: 'crimson', numeral: 'II', name: 'crimson', hues: ['#ff7d93', '#e98ae9', '#ffa47f', '#ff6f8a'], accent: '#ffd6dc', note: 'a red signal, half in shadow' },
  { id: 'phantom', numeral: 'III', name: 'phantom', hues: ['#c6d4e4', '#9aa8ff', '#7fe3dc', '#e6ecf5'], accent: '#ff8a4a', note: 'after key art © Konami Digital Entertainment' },
];

const RAMP = " .'`,:;-~=+*o%#&@";
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rr = (n) => Math.round(n * 10) / 10;
const kt = (n) => Math.round(n * 10000) / 10000;

/** 一张图所有帧的 <text>（只跟图和字号有关，算一次就缓存，Worker 里每个请求不用重算） */
const cache = new Map();
function portraitFrames(p, size) {
  const key = `${p.id}@${size}`;
  if (cache.has(key)) return cache.get(key);
  const charW = size * 0.6;
  const lineH = size * 1.02;
  const groups = p.frames.map((fr, i) => {
    // 行首的空格换成 x 偏移，行尾的空格去掉：图小一点
    const text = fr.lines
      .map((ln, r) => {
        const t = ln.trimEnd();
        const body = t.trimStart();
        return body ? `<text x="${rr((t.length - body.length) * charW)}" y="${rr(r * lineH)}" xml:space="preserve">${escText(body)}</text>` : '';
      })
      .join('');
    const acc = fr.acc.map(([r, a, b]) => `<text x="${rr(a * charW)}" y="${rr(r * lineH)}">${escText(fr.lines[r].slice(a, b))}</text>`).join('');
    return `<g class="fr${i}">${text}<g fill="${FACES.find((f) => f.id === p.id).accent}">${acc}</g></g>`;
  });
  const out = { body: groups.join(''), w: p.cols * charW, h: p.rows * lineH };
  cache.set(key, out);
  return out;
}

/**
 * 每张图在轮播里的出现时间：第 j 个出场，从 j·hold 秒开始，擦入 wipe 秒，停留到下一张擦入时被擦掉。
 * 返回 SMIL 动画需要的 begin / dur / keyTimes，hidden / shown 两个值之间切换。
 */
export function slotTiming(j, n, hold, wipe) {
  const C = n * hold;
  return {
    begin: `${rr(j * hold)}s`,
    dur: `${rr(C)}s`,
    keyTimes: `0;${kt(wipe / C)};${kt(hold / C)};${kt((hold + wipe) / C)};1`,
    splines: '0.65 0 0.35 1;0 0 1 1;0.65 0 0.35 1;0 0 1 1',
  };
}

/**
 * 在轮播里跟着第 j 张图出现的属性动画（图注、编号、指示条用）。
 * 文字不能叠在一起，所以旧的在擦除的前半段淡出，新的在后半段淡入。
 */
export function slotFade(j, n, hold, wipe, attr = 'opacity') {
  const C = n * hold;
  const half = wipe / 2;
  return `<animate attributeName="${attr}" values="0;0;1;1;0;0" keyTimes="0;${kt(half / C)};${kt(wipe / C)};${kt(hold / C)};${kt((hold + half) / C)};1" begin="${rr(j * hold)}s" dur="${rr(C)}s" repeatCount="indefinite"/>`;
}

/**
 * 整个肖像层。faces 是 faces.json 里的 portraits，order 是出场顺序（FACES 里的下标）。
 * 返回 { body, css }，所有图以 (cx, cy) 为中心、高度相同。
 */
export function faceLayer({ faces, order = [0, 1, 2], size = 7.2, cx, cy, step = 0.32, hold = 13, wipe = 2.4 }) {
  const n = order.length;
  const frames = faces[0].frames.length;
  const lineH = size * 1.02;
  const A = faces[0].rows * lineH;
  const y0 = cy - A / 2;
  const e = 36; // 扫描线的软边
  const maxW = Math.max(...faces.map((p) => p.cols * size * 0.6));

  // 转头：和以前一样，每帧在往返序列里出现的时刻显示，其余时间隐藏。
  // 用 visibility 而不是 opacity：opacity 为 0 的帧浏览器每一帧照样要画，visibility: hidden 的才会跳过
  const seq = [...Array(frames).keys(), ...Array.from({ length: frames - 2 }, (_, i) => frames - 2 - i)];
  const cycle = seq.length * step;
  const pct = (t) => rr((t / cycle) * 100);
  const css = [];
  for (let i = 0; i < frames; i++) {
    const kf = ['0% { visibility: hidden; }'];
    seq.forEach((s, k) => s === i && kf.push(`${pct(k * step)}% { visibility: visible; }`, `${pct((k + 1) * step)}% { visibility: hidden; }`));
    css.push(`.fr${i} { visibility: hidden; animation: fr${i} ${rr(cycle)}s steps(1, end) infinite; } @keyframes fr${i} { ${kf.join(' ')} }`);
  }
  // 不要动画的时候停在正脸那一帧
  css.push(`@media (prefers-reduced-motion: reduce) { .fr${Math.floor(frames / 2)} { visibility: visible; } }`);

  // 擦除遮罩：一条比图高 2e 的白带，上下两端是软边。藏在图上方 → 下移盖住整张图 → 再下移到图下方
  const yA = y0 - A - 2 * e;
  const yH = y0 - e;
  const yB = y0 + A;
  const defs = [
    `<linearGradient id="wipeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${kt(e / (A + 2 * e))}" stop-color="#fff"/><stop offset="${kt(1 - e / (A + 2 * e))}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="bandG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dfe6f2" stop-opacity="0"/><stop offset="0.5" stop-color="#dfe6f2"/><stop offset="1" stop-color="#dfe6f2" stop-opacity="0"/></linearGradient>`,
    `<radialGradient id="beamG" cx="0.5" cy="1" r="0.5"><stop offset="0" stop-color="#dfe6f2" stop-opacity="0.12"/><stop offset="1" stop-color="#dfe6f2" stop-opacity="0"/></radialGradient>`,
  ];
  const layers = order.map((fi, j) => {
    const meta = FACES[fi];
    const p = faces.find((f) => f.id === meta.id);
    const pf = portraitFrames(p, size);
    const t = slotTiming(j, n, hold, wipe);
    const C = n * hold;
    defs.push(
      flowGradient(`pf-${p.id}`, { x1: 0, y1: 0, x2: rr(pf.w), y2: rr(pf.h), dur: 24, hues: meta.hues, units: 'userSpaceOnUse' }),
      `<mask id="wipe${j}" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="${rr(cy * 2 + 40)}"><rect x="0" y="${rr(yA)}" width="1200" height="${rr(A + 2 * e)}" fill="url(#wipeG)"><animate attributeName="y" values="${rr(yA)};${rr(yH)};${rr(yH)};${rr(yB)};${rr(yB)}" keyTimes="${t.keyTimes}" calcMode="spline" keySplines="${t.splines}" begin="${t.begin}" dur="${t.dur}" repeatCount="indefinite"/></rect></mask>`,
    );
    // 不在画面上的图整组 display: none，浏览器就不用每一帧都画它
    return `<g mask="url(#wipe${j})" display="none"><animate attributeName="display" values="inline;none" keyTimes="0;${kt((hold + wipe) / C)}" calcMode="discrete" begin="${t.begin}" dur="${t.dur}" repeatCount="indefinite"/><g transform="translate(${rr(cx - pf.w / 2)} ${rr(y0)})" fill="url(#pf-${p.id})">${pf.body}</g></g>`;
  });

  // 扫描线：跟着擦除的分界线走，线上方有两行一闪一闪的乱码，像正在改写的数据
  const rand = rng('scan');
  const noise = (k) =>
    [0, 1]
      .map((r) => {
        const cols = Math.floor(maxW / (size * 0.6));
        let s = '';
        for (let c = 0; c < cols; c++) s += rand() < 0.55 ? RAMP[1 + Math.floor(rand() * (RAMP.length - 1))] : ' ';
        return `<text x="${rr(cx - maxW / 2)}" y="${rr(-4 - r * lineH)}" xml:space="preserve" opacity="${r ? 0.45 : 0.9}">${escText(s)}</text>`;
      })
      .join('') + `<animate attributeName="opacity" values="${k === 0 ? '1;0;0;1' : k === 1 ? '0;1;0;0' : '0;0;1;0'}" keyTimes="0;0.333;0.667;1" calcMode="discrete" dur="0.36s" repeatCount="indefinite"/>`;
  const dS = kt(wipe / hold);
  const band = `<g opacity="0">
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;${kt(dS * 0.06)};${kt(dS * 0.85)};${dS};1" dur="${rr(hold)}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 ${rr(y0 - e / 2)};0 ${rr(y0 + A + e / 2)};0 ${rr(y0 + A + e / 2)}" keyTimes="0;${dS};1" calcMode="spline" keySplines="0.65 0 0.35 1;0 0 1 1" dur="${rr(hold)}s" repeatCount="indefinite"/>
      <rect x="${rr(cx - maxW / 2)}" y="-56" width="${rr(maxW)}" height="56" fill="url(#beamG)"/>
      <rect x="${rr(cx - maxW / 2)}" y="-0.5" width="${rr(maxW)}" height="1" fill="url(#bandG)"/>
      <g fill="url(#bandG)">${[0, 1, 2].map((k) => `<g>${noise(k)}</g>`).join('')}</g>
    </g>`;

  const body = `<defs>${defs.join('')}</defs>
    <g class="breathe"><g class="mono" font-size="${size}" font-weight="600">${layers.join('')}${band}</g></g>`;
  return {
    body,
    css: `${css.join('\n')}\n  .breathe { animation: breathe 8s ease-in-out infinite alternate; } @keyframes breathe { to { opacity: 0.72; } }`,
    hold,
    wipe,
  };
}
