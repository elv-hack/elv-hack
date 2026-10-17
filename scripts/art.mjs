/**
 * 手绘（用代码画）的 90 年代赛璐璐风格素材：看板娘エルヴ、少女侧脸剪影、复古夕阳、云、城市、卡面场景。
 * 全部原创。每个函数返回一段 SVG 片段，坐标都在各自的局部坐标系里，用 transform 摆放。
 * 生成脚本和 Worker 共用。
 */
import { SKIES, r1, rng } from './lib.mjs';

/** 角色和场景用的固定颜色（不随明暗主题变化，赛璐璐本来就是固定的色指定） */
export const CEL = {
  ink: '#1c1230',
  skin: '#ffe3cf',
  skinShade: '#f2b39b',
  hair: '#4a2f86',
  hairShade: '#2f1c63',
  hairLight: '#8a72dc',
  eyeTop: '#1d2f6b',
  eyeMid: '#3f7fd8',
  eyeLow: '#9ad8ff',
  pupil: '#0e1638',
  phones: '#ff5c8a',
  phonesShade: '#cf3567',
  collar: '#22306b',
  scarf: '#e8384f',
  shirt: '#fbf7f0',
  shirtShade: '#c9cfe6',
  blush: '#ff6f99',
  mouth: '#b8324f',
  tongue: '#ff8fa8',
};

const S = (w = 2.6) => `stroke="${CEL.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- 看板娘エルヴ（胸像，局部坐标 260×300） ----------

/**
 * expression: neutral | happy | blush | sleepy | surprised | pout
 * 头发、耳机天线可以通过 animate=true 带上轻微的摆动。
 */
export function mascot(expression = 'neutral', { animate = true } = {}) {
  const c = CEL;
  const eyes = eyesFor(expression);
  const mouth = mouthFor(expression);
  const blush =
    expression === 'blush' || expression === 'happy'
      ? `<g opacity="${expression === 'blush' ? 0.95 : 0.6}">
          <ellipse cx="100" cy="182" rx="14" ry="6" fill="${c.blush}" opacity="0.35"/>
          <ellipse cx="160" cy="182" rx="14" ry="6" fill="${c.blush}" opacity="0.35"/>
          <path d="M92 186l5-9M100 186l5-9M108 186l5-9M152 186l5-9M160 186l5-9M168 186l5-9" stroke="${c.blush}" stroke-width="2" stroke-linecap="round"/>
        </g>`
      : '';
  const extra =
    expression === 'surprised'
      ? `<g class="pop"><path d="M214 40l8-26 10 4-14 24z" fill="${c.phones}" ${S(2)}/><circle cx="212" cy="54" r="5" fill="${c.phones}" ${S(2)}/></g>`
      : expression === 'sleepy'
        ? `<g class="zzz" fill="${c.hairLight}" font-family="'JBM', monospace" font-weight="800"><text x="200" y="64" font-size="22">Z</text><text x="222" y="42" font-size="16">z</text><text x="236" y="26" font-size="12">z</text></g>`
        : expression === 'happy' || expression === 'blush'
          ? `<g class="spark" fill="#ffd23f" ${S(1.6)}><path d="M222 70l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path d="M36 92l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g>`
          : '';

  return `<g class="mascot">
  <!-- 后发 -->
  <path class="${animate ? 'sway' : ''}" d="M54 112C34 160 34 240 22 300H238C226 240 226 160 206 112C196 56 64 56 54 112Z" fill="${c.hair}" ${S()}/>
  <path d="M60 150C52 200 50 250 44 300H70C70 250 72 200 76 160Z" fill="${c.hairShade}"/>
  <path d="M200 150C208 200 210 250 216 300H190C190 250 188 200 184 160Z" fill="${c.hairShade}"/>
  <!-- 身体：水手服 -->
  <path d="M34 300C42 262 78 244 130 242C182 244 218 262 226 300Z" fill="${c.shirt}" ${S()}/>
  <path d="M60 300C64 280 72 268 84 262L92 300Z" fill="${c.shirtShade}"/>
  <path d="M50 274C68 254 96 246 112 244L130 290L148 244C164 246 192 254 210 274L218 300H42Z" fill="${c.collar}" ${S()}/>
  <path d="M60 276C76 260 96 254 108 252M200 276C184 260 164 254 152 252" fill="none" stroke="#fff" stroke-width="2.4"/>
  <path d="M116 262H144L130 298Z" fill="${c.scarf}" ${S(2.2)}/>
  <path d="M120 256L130 266L140 256L136 250H124Z" fill="${c.scarf}" ${S(2.2)}/>
  <!-- 脖子 -->
  <path d="M114 190V248Q130 256 146 248V190Z" fill="${c.skin}" ${S()}/>
  <path d="M116 196Q130 218 144 196V214Q130 232 116 214Z" fill="${c.skinShade}"/>
  <!-- 脸 -->
  <path d="M78 118C78 158 90 184 110 200Q130 214 150 200C170 184 182 158 182 118C182 76 78 76 78 118Z" fill="${c.skin}" ${S()}/>
  <!-- 刘海投在额头上的阴影（赛璐璐的硬边阴影） -->
  <path d="M82 120L90 140L100 118L110 146L122 120L132 150L144 120L156 146L166 118L176 138L180 116V110H82Z" fill="${c.skinShade}"/>
  ${blush}
  ${eyes}
  <path d="M131 172L128 180L133 180" fill="none" stroke="${c.skinShade}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  ${mouth}
  <!-- 鬓发 -->
  <path class="${animate ? 'sway' : ''}" d="M84 104C66 150 68 204 56 252C74 236 84 204 90 168Z" fill="${c.hair}" ${S()}/>
  <path class="${animate ? 'sway2' : ''}" d="M176 104C194 150 192 204 204 252C186 236 176 204 170 168Z" fill="${c.hair}" ${S()}/>
  <!-- 刘海：90 年代的尖刘海 -->
  <path d="M70 124C64 70 96 40 130 40C164 40 196 70 190 124L178 132L170 104L160 140L148 100L136 146L124 100L112 142L100 104L90 134L82 108Z" fill="${c.hair}" ${S()}/>
  <path d="M90 74Q130 52 170 74L166 84Q130 64 94 84Z" fill="${c.hairLight}"/>
  <!-- 呆毛 -->
  <path class="${animate ? 'ahoge' : ''}" d="M128 44C118 22 136 10 152 16C138 20 134 30 136 44Z" fill="${c.hair}" ${S(2.2)}/>
  <!-- 耳机 + 天线 -->
  <path d="M66 128C60 64 96 34 130 34C164 34 200 64 194 128" fill="none" stroke="${c.ink}" stroke-width="12" stroke-linecap="round"/>
  <path d="M66 128C60 64 96 34 130 34C164 34 200 64 194 128" fill="none" stroke="${c.phones}" stroke-width="7" stroke-linecap="round"/>
  <rect x="52" y="116" width="28" height="46" rx="12" fill="${c.phones}" ${S()}/>
  <rect x="58" y="124" width="10" height="30" rx="5" fill="${c.phonesShade}"/>
  <rect x="180" y="116" width="28" height="46" rx="12" fill="${c.phones}" ${S()}/>
  <rect x="192" y="124" width="10" height="30" rx="5" fill="${c.phonesShade}"/>
  <g class="${animate ? 'antenna' : ''}"><path d="M200 120L226 70" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/><circle class="${animate ? 'beacon' : ''}" cx="228" cy="66" r="6" fill="#ffd23f" ${S(2.2)}/></g>
  ${extra}
</g>`;
}

function eye(cx, cy, flip) {
  const c = CEL;
  const f = flip ? -1 : 1;
  return `<g>
    <ellipse cx="${cx}" cy="${cy}" rx="16.5" ry="21" fill="#fff"/>
    <ellipse cx="${cx + f}" cy="${cy + 2}" rx="13.5" ry="19" fill="${c.eyeMid}"/>
    <path d="M${cx - 13.5 + f} ${cy - 2}A13.5 19 0 0 1 ${cx + 13.5 + f} ${cy - 2}Z" fill="${c.eyeTop}"/>
    <path d="M${cx - 11 + f} ${cy + 10}A12 10 0 0 0 ${cx + 13 + f} ${cy + 10}Z" fill="${c.eyeLow}" opacity="0.9"/>
    <ellipse cx="${cx + f}" cy="${cy + 3}" rx="6" ry="9.5" fill="${c.pupil}"/>
    <ellipse cx="${cx - 4.5 * f}" cy="${cy - 7}" rx="5.2" ry="7.2" fill="#fff"/>
    <circle cx="${cx + 5.5 * f}" cy="${cy + 10}" r="2.6" fill="#fff"/>
    <path d="M${cx - 18.5 * f} ${cy - 6}Q${cx} ${cy - 29} ${cx + 18.5 * f} ${cy - 11}" fill="none" stroke="${c.ink}" stroke-width="5" stroke-linecap="round"/>
    <path d="M${cx - 18.5 * f} ${cy - 6}L${cx - 24 * f} ${cy - 13}" stroke="${c.ink}" stroke-width="3.8" stroke-linecap="round"/>
    <path d="M${cx - 10 * f} ${cy + 22}Q${cx} ${cy + 25} ${cx + 10 * f} ${cy + 21}" fill="none" stroke="${c.ink}" stroke-width="1.8" stroke-linecap="round"/>
  </g>`;
}

function eyesFor(expression) {
  const c = CEL;
  const L = [106, 156];
  const R = [154, 156];
  const brows = (dy = 0, tilt = 0) =>
    `<path d="M94 ${132 + dy - tilt}Q106 ${126 + dy} 118 ${131 + dy + tilt}M142 ${131 + dy + tilt}Q154 ${126 + dy} 166 ${132 + dy - tilt}" fill="none" stroke="${c.hairShade}" stroke-width="3" stroke-linecap="round"/>`;
  switch (expression) {
    case 'happy':
      return `${brows(-2)}<path d="M92 162Q106 144 120 162M140 162Q154 144 168 162" fill="none" stroke="${c.ink}" stroke-width="4.6" stroke-linecap="round"/>`;
    case 'sleepy':
      return `${brows(2)}<g>${[L, R]
        .map(
          ([x, y], i) => `<path d="M${x - 15} ${y + 2}H${x + 15}V${y + 16}Q${x} ${y + 24} ${x - 15} ${y + 16}Z" fill="#fff"/>
          <path d="M${x - 12} ${y + 3}H${x + 12}V${y + 14}Q${x} ${y + 21} ${x - 12} ${y + 14}Z" fill="${c.eyeMid}"/>
          <ellipse cx="${x}" cy="${y + 9}" rx="5" ry="5" fill="${c.pupil}"/>
          <path d="M${x - 17} ${y + 2}H${x + 17}" stroke="${c.ink}" stroke-width="4.2" stroke-linecap="round"/>
          <path d="M${x - 10} ${y + 6}H${x + 10}" stroke="${c.skinShade}" stroke-width="3" opacity="${i ? 1 : 1}"/>`,
        )
        .join('')}</g>`;
    case 'surprised':
      return `${brows(-6)}${[L, R]
        .map(
          ([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="19" fill="#fff"/>
          <ellipse cx="${x}" cy="${y + 2}" rx="7" ry="9" fill="${c.eyeMid}"/>
          <ellipse cx="${x}" cy="${y + 2}" rx="3" ry="4" fill="${c.pupil}"/>
          <path d="M${x - 17} ${y - 8}Q${x} ${y - 28} ${x + 17} ${y - 8}" fill="none" stroke="${c.ink}" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="${x}" cy="${y}" rx="15" ry="19" fill="none" stroke="${c.ink}" stroke-width="1.6"/>`,
        )
        .join('')}`;
    case 'pout':
      return `${brows(0, 4)}${eye(...L, false)}${eye(...R, true)}`;
    default:
      return `${brows()}${eye(...L, false)}${eye(...R, true)}`;
  }
}

function mouthFor(expression) {
  const c = CEL;
  switch (expression) {
    case 'happy':
      return `<path d="M118 188Q130 210 142 188Z" fill="${c.mouth}" ${S(2.2)}/><path d="M123 198Q130 206 137 198Q130 194 123 198Z" fill="${c.tongue}"/>`;
    case 'blush':
      return `<path d="M120 194Q125 189 130 194Q135 199 140 194" fill="none" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'sleepy':
      return `<ellipse cx="130" cy="195" rx="4" ry="3" fill="${c.mouth}" ${S(1.8)}/>`;
    case 'surprised':
      return `<ellipse cx="130" cy="196" rx="6" ry="8" fill="${c.mouth}" ${S(2.2)}/>`;
    case 'pout':
      return `<path d="M122 196Q130 188 138 196" fill="none" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round"/><path d="M140 186l6-4M141 192l7 0" stroke="${c.ink}" stroke-width="1.8" stroke-linecap="round"/>`;
    default:
      return `<path d="M122 192Q130 199 138 192" fill="none" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
}

/** 看板娘动起来要用到的 CSS（摆动、呆毛、天线灯、星星、Z） */
export const MASCOT_CSS = `
  .sway { transform-box: fill-box; transform-origin: 50% 0; animation: sway 4.2s ease-in-out infinite; }
  .sway2 { transform-box: fill-box; transform-origin: 50% 0; animation: sway 4.2s ease-in-out -2.1s infinite; }
  .ahoge { transform-box: fill-box; transform-origin: 30% 100%; animation: ahoge 2.6s ease-in-out infinite; }
  .antenna { transform-box: fill-box; transform-origin: 0 100%; animation: ahoge 3.4s ease-in-out -1s infinite; }
  .beacon { animation: beacon 1.4s steps(1, end) infinite; }
  .spark { transform-box: fill-box; transform-origin: center; animation: spark 1.6s ease-in-out infinite; }
  .zzz { animation: zzz 3s ease-in-out infinite; }
  .pop { transform-box: fill-box; transform-origin: 0 100%; animation: pop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
  @keyframes sway { 50% { transform: rotate(1.6deg); } }
  @keyframes ahoge { 50% { transform: rotate(-9deg); } }
  @keyframes beacon { 50% { fill: #fff6c2; } }
  @keyframes spark { 50% { transform: scale(0.55) rotate(20deg); opacity: 0.6; } }
  @keyframes zzz { 50% { transform: translate(4px, -6px); opacity: 0.5; } }
  @keyframes pop { from { transform: scale(0); } }`;

// ---------- 少女侧脸剪影（局部坐标 320×360，面朝右） ----------

/** 正面轮廓（额头到胸口），单独拿出来描夕阳的轮廓光 */
const PROFILE_FRONT =
  'M150 44C182 48 204 70 208 98C210 106 211 112 214 118C220 126 228 134 226 138C222 142 216 141 215 145C219 148 220 151 216 154C219 157 219 161 214 164C214 170 214 176 206 180C196 184 190 186 188 192C188 206 192 224 206 248C220 268 246 288 262 320';

/** 一束渐细的头发：中心线是三次贝塞尔，宽度从根部到发梢线性收窄 */
function strand([x, y], len, w, [d1, d2, d3]) {
  const P = [
    [x, y],
    [x - len * 0.33, y + d1],
    [x - len * 0.68, y + d2],
    [x - len, y + d3],
  ];
  const at = (t) => {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [0, 1].map((i) => k.reduce((s, kk, j) => s + kk * P[j][i], 0));
  };
  const left = [];
  const right = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [px, py] = at(t);
    const [nx, ny] = at(Math.min(1, t + 0.01));
    const [qx, qy] = at(Math.max(0, t - 0.01));
    const dx = nx - qx;
    const dy = ny - qy;
    const l = Math.hypot(dx, dy) || 1;
    const half = (w / 2) * Math.pow(1 - t, 0.9);
    left.push(`${r1(px - (dy / l) * half)},${r1(py + (dx / l) * half)}`);
    right.push(`${r1(px + (dy / l) * half)},${r1(py - (dx / l) * half)}`);
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

/** 被风吹向左后方的长发：一组从后脑出发的发束 */
const HAIR = [
  [[140, 56], 150, 46, [-16, -20, -6]],
  [[132, 80], 190, 52, [-8, 0, 18]],
  [[128, 108], 210, 52, [-2, 16, 40]],
  [[128, 138], 214, 50, [4, 28, 62]],
  [[130, 168], 196, 48, [8, 38, 80]],
  [[134, 198], 170, 44, [12, 44, 92]],
  [[138, 228], 130, 38, [14, 46, 96]],
];

export function profile(fill, rim, { animate = true } = {}) {
  const body = 'L262 360H58C62 330 74 300 96 276C108 262 118 250 122 236C110 210 104 170 112 140C104 112 116 70 150 44Z';
  const strands = HAIR.map((h) => `<path d="${strand(...h)}"/>`).join('');
  return `<g>
    <g class="${animate ? 'hairwave' : ''}" fill="${fill}">${strands}</g>
    <path d="${PROFILE_FRONT}${body}" fill="${fill}"/>
    <path d="${PROFILE_FRONT}" fill="none" stroke="${rim}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M110 70C128 54 152 48 172 54" fill="none" stroke="${rim}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <path d="M150 44C142 30 150 18 164 16C154 24 156 34 160 44Z" fill="${fill}"/>
  </g>`;
}

// ---------- 场景素材 ----------

/** 复古条纹夕阳：下半部分开横缝，缝会慢慢往下走 */
export function retroSun(id, cx, cy, r, top, bottom, { animate = true } = {}) {
  const slits = [];
  for (let i = 0; i < 7; i++) {
    const y = cy + r * 0.05 + i * (r / 6.2);
    const h = 2 + i * 1.6;
    slits.push(`<rect x="${cx - r}" y="${r1(y)}" width="${2 * r}" height="${r1(h)}"/>`);
  }
  return `<defs>
      <linearGradient id="${id}-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
      <mask id="${id}-m" maskUnits="userSpaceOnUse" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}">
        <rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="#fff"/>
        <g class="${animate ? 'slits' : ''}" fill="#000">${slits.join('')}</g>
      </mask>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-g)" mask="url(#${id}-m)"/>`;
}

/** 赛璐璐风格的云：几个圆拼起来，平底，上面一块亮色 */
export function cloud(x, y, w, base, light, cls = '') {
  const h = w * 0.34;
  return `<g class="${cls}" transform="translate(${x} ${y})">
    <path d="M0 ${h}C-4 ${h * 0.5} ${w * 0.1} ${h * 0.2} ${w * 0.22} ${h * 0.36}C${w * 0.26} ${-h * 0.2} ${w * 0.56} ${-h * 0.3} ${w * 0.62} ${h * 0.2}C${w * 0.74} ${-h * 0.04} ${w * 0.96} ${h * 0.2} ${w} ${h}Z" fill="${base}"/>
    <path d="M${w * 0.26} ${h * 0.34}C${w * 0.3} ${h * 0.02} ${w * 0.5} ${-h * 0.08} ${w * 0.58} ${h * 0.26}C${w * 0.46} ${h * 0.12} ${w * 0.34} ${h * 0.14} ${w * 0.26} ${h * 0.34}Z" fill="${light}"/>
  </g>`;
}

/** 城市剪影 + 零星亮着的窗 */
export function skyline(seed, x, baseY, width, maxH, fill, windows) {
  const rand = rng(seed);
  const out = [];
  const lit = [];
  let cx = x;
  while (cx < x + width) {
    const w = 18 + Math.floor(rand() * 34);
    const h = maxH * (0.35 + rand() * 0.65);
    out.push(`<rect x="${cx}" y="${r1(baseY - h)}" width="${w}" height="${r1(h)}"/>`);
    if (rand() > 0.6) out.push(`<rect x="${cx + w / 2 - 1}" y="${r1(baseY - h - 14)}" width="2" height="14"/>`);
    for (let wy = baseY - h + 8; wy < baseY - 6; wy += 9) {
      for (let wx = cx + 4; wx < cx + w - 5; wx += 7) if (rand() > 0.82) lit.push(`<rect x="${wx}" y="${r1(wy)}" width="3" height="4"/>`);
    }
    cx += w + 2;
  }
  return `<g fill="${fill}">${out.join('')}</g><g fill="${windows}" class="windows">${lit.join('')}</g>`;
}

/** 网点纸 */
export const halftone = (id, color, size = 6, r = 1.2) =>
  `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}"/></pattern>`;

// ---------- 天空（色带 + 太阳 + 云 + 海） ----------

/**
 * 一整片天：horizon 以上是分色的天空色带，以下是海；name 取 SKIES 里的天色。
 * opts.sun = [cx, cy, r]，opts.clouds = [[x, y, w], ...]，opts.city = [x, width, maxH]
 */
export function sky(uid, name, W, H, horizon, opts = {}) {
  const k = SKIES[name];
  const bandH = horizon / k.bands.length;
  const bands = k.bands.map((c, i) => `<rect y="${r1(i * bandH)}" width="${W}" height="${r1(bandH + 0.6)}" fill="${c}"/>`).join('');
  const night = name === 'night';
  let stars = '';
  if (night) {
    const rand = rng(`${uid}-stars`);
    const pts = [];
    for (let i = 0; i < Math.round((W * horizon) / 2600); i++) {
      const x = r1(rand() * W);
      const y = r1(rand() * horizon * 0.8);
      pts.push(`<circle class="${i % 3 ? '' : 'twinkle'}" style="animation-delay:${r1(rand() * 3)}s" cx="${x}" cy="${y}" r="${r1(0.6 + rand() * 1.2)}"/>`);
    }
    stars = `<g fill="#fff6d6">${pts.join('')}</g>`;
  }
  const [sx, sy, sr] = opts.sun ?? [W * 0.6, horizon, Math.min(W, H) * 0.18];
  const sun = opts.plainSun
    ? `<circle cx="${sx}" cy="${sy}" r="${r1(sr * 1.7)}" fill="${k.sun[0]}" opacity="0.18"/><circle cx="${sx}" cy="${sy}" r="${r1(sr * 1.3)}" fill="${k.sun[0]}" opacity="0.3"/><circle cx="${sx}" cy="${sy}" r="${sr}" fill="${k.sun[0]}"/>`
    : night
    ? `<circle cx="${sx}" cy="${sy - sr * 0.6}" r="${r1(sr * 0.42)}" fill="${k.sun[0]}"/><circle cx="${r1(sx + sr * 0.16)}" cy="${r1(sy - sr * 0.68)}" r="${r1(sr * 0.38)}" fill="${k.bands[2]}"/>`
    : retroSun(`${uid}-sun`, sx, sy, sr, k.sun[0], k.sun[1], { animate: opts.animate !== false });
  const clouds = (opts.clouds ?? [])
    .map(([x, y, w], i) => cloud(x, y, w, k.clouds[i % 2][0], k.clouds[i % 2][1], opts.animate === false ? '' : `drift${i % 2}`))
    .join('');
  const city = opts.city ? skyline(`${uid}-city`, opts.city[0], horizon, opts.city[1], opts.city[2], k.city, k.windows) : '';
  // 海面上太阳的倒影：一排排短横线，闪一闪
  const rand = rng(`${uid}-glint`);
  const glints = [];
  if (H > horizon + 4) {
    for (let y = horizon + 5; y < H - 2; y += 5 + (y - horizon) * 0.08) {
      const spread = 0.25 + ((y - horizon) / (H - horizon)) * 0.9;
      const w = r1(sr * spread * (0.6 + rand() * 0.7));
      glints.push(`<rect class="${rand() > 0.5 ? 'glint' : 'glint2'}" x="${r1(sx - w / 2 + (rand() - 0.5) * sr * 0.3)}" y="${r1(y)}" width="${w}" height="${r1(1.4 + (y - horizon) * 0.03)}"/>`);
    }
  }
  return `<g>${bands}${stars}${sun}${clouds}${city}
    <rect y="${horizon}" width="${W}" height="${H - horizon}" fill="${k.sea}"/>
    <g fill="${k.glint}" opacity="${night ? 0.5 : 0.85}">${glints.join('')}</g></g>`;
}

/** 天空和场景里的小动画 */
export const SCENE_CSS = `
  .slits { animation: slits 5s linear infinite; }
  .drift0 { animation: drift 38s linear infinite alternate; }
  .drift1 { animation: drift 52s linear -20s infinite alternate-reverse; }
  .glint { animation: glint 2.4s steps(2, end) infinite; }
  .glint2 { animation: glint 3.1s steps(2, end) -1s infinite; }
  .twinkle { animation: twinkle 2.8s ease-in-out infinite; }
  .hairwave { transform-box: fill-box; transform-origin: 100% 50%; animation: hairwave 5s ease-in-out infinite; }
  .blinkA { animation: lamp 1s steps(1, end) infinite; }
  .blinkB { animation: lamp 1s steps(1, end) -0.5s infinite; }
  .spin { transform-box: fill-box; transform-origin: center; animation: spin 2.4s linear infinite; }
  .rays { transform-box: fill-box; transform-origin: center; animation: spin 40s linear infinite; }
  .cursor { animation: lamp 1s steps(1, end) infinite; }
  .flutter { animation: flutter 0.5s ease-in-out infinite alternate; }
  @keyframes slits { to { transform: translateY(14px); } }
  @keyframes drift { to { transform: translateX(60px); } }
  @keyframes glint { 50% { opacity: 0.25; } }
  @keyframes twinkle { 50% { opacity: 0.2; } }
  @keyframes hairwave { 50% { transform: skewY(2deg) scaleX(1.02); } }
  @keyframes lamp { 50% { opacity: 0.15; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes flutter { to { transform: translate(3px, -4px); } }`;

// ---------- 卡面场景（局部坐标 176×150） ----------

const AW = 176;
const AH = 150;

function stripes(id, a, b, w = 6, angle = 45) {
  return `<pattern id="${id}" width="${w * 2}" height="${w * 2}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><rect width="${w * 2}" height="${w * 2}" fill="${a}"/><rect width="${w}" height="${w * 2}" fill="${b}"/></pattern>`;
}

const SCENES = {
  crossing(uid) {
    const ink = CEL.ink;
    return `<defs>${stripes(`${uid}-yb`, '#ffd23f', ink, 4)}${stripes(`${uid}-rw`, '#e8384f', '#fff6e6', 5, 0)}</defs>
      ${sky(`${uid}-s`, 'dusk', AW, AH, 112, { sun: [126, 112, 30], clouds: [[6, 28, 70]] })}
      <rect y="112" width="${AW}" height="38" fill="#2a1d4a"/>
      <path d="M40 150L84 112M136 150L96 112" stroke="#6b5a9a" stroke-width="2"/>
      <path d="M30 18C70 30 120 28 176 16M30 26C70 40 120 38 176 28" fill="none" stroke="${ink}" stroke-width="1.2"/>
      <rect x="26" y="8" width="7" height="142" fill="${ink}"/><rect x="18" y="16" width="23" height="4" fill="${ink}"/>
      <rect x="117" y="44" width="6" height="106" fill="#f2efe6" stroke="${ink}" stroke-width="2"/>
      <g transform="translate(120 44)"><rect x="-26" y="-5" width="52" height="10" fill="url(#${uid}-yb)" stroke="${ink}" stroke-width="2" transform="rotate(25)"/><rect x="-26" y="-5" width="52" height="10" fill="url(#${uid}-yb)" stroke="${ink}" stroke-width="2" transform="rotate(-25)"/></g>
      <rect x="100" y="64" width="40" height="8" fill="${ink}"/>
      <circle class="blinkA" cx="107" cy="78" r="7" fill="#ff3b4e" stroke="${ink}" stroke-width="2"/>
      <circle class="blinkB" cx="133" cy="78" r="7" fill="#ff3b4e" stroke="${ink}" stroke-width="2"/>
      <path d="M100 74a7 7 0 0 1 14 0M126 74a7 7 0 0 1 14 0" fill="${ink}"/>
      <path d="M124 112L-4 98" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>
      <path d="M124 112L-4 98" stroke="url(#${uid}-rw)" stroke-width="5" stroke-linecap="round"/>`;
  },

  vending(uid) {
    const ink = CEL.ink;
    const cans = [];
    const colors = ['#ff5c8a', '#ffd23f', '#5fe1d0', '#ff9442', '#8a72dc'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) cans.push(`<rect x="${70 + c * 9.6}" y="${54 + r * 13}" width="6" height="9" rx="1.5" fill="${colors[(r * 2 + c) % 5]}" stroke="${ink}" stroke-width="0.8"/>`);
    return `<defs><radialGradient id="${uid}-glow"><stop offset="0" stop-color="#e8f6ff" stop-opacity="0.75"/><stop offset="1" stop-color="#e8f6ff" stop-opacity="0"/></radialGradient></defs>
      ${sky(`${uid}-s`, 'night', AW, AH, 120, { sun: [150, 60, 30] })}
      <rect y="120" width="${AW}" height="30" fill="#141a3e"/>
      <ellipse cx="92" cy="128" rx="74" ry="20" fill="url(#${uid}-glow)"/>
      <ellipse cx="92" cy="60" rx="56" ry="54" fill="url(#${uid}-glow)" opacity="0.5"/>
      <rect x="62" y="22" width="60" height="106" rx="4" fill="#e8eef7" stroke="${ink}" stroke-width="2.6"/>
      <rect x="67" y="27" width="50" height="17" rx="2" fill="#ffffff" stroke="${ink}" stroke-width="1.6"/>
      <text x="92" y="39" font-family="'JBM', monospace" font-size="8" font-weight="800" fill="#ff5c8a" text-anchor="middle">DRINK</text>
      <rect x="67" y="49" width="50" height="44" rx="2" fill="#bfe3ff" stroke="${ink}" stroke-width="1.6"/>
      ${cans.join('')}
      <g fill="#ff5c8a">${[0, 1, 2, 3, 4].map((c) => `<rect x="${71 + c * 9.6}" y="96" width="4" height="3" rx="1"/>`).join('')}</g>
      <rect x="70" y="108" width="44" height="14" rx="2" fill="#2a2f55" stroke="${ink}" stroke-width="1.6"/>
      <rect x="106" y="100" width="8" height="5" fill="#2a2f55"/>
      <g fill="${ink}"><ellipse cx="146" cy="134" rx="13" ry="9"/><circle cx="138" cy="122" r="7"/><path d="M132 118l1-9 5 6zM140 116l4-8 2 9z"/><path d="M158 134c10-2 12-10 8-18" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/></g>
      <g fill="#fff6d6"><circle class="flutter" cx="58" cy="30" r="1.6"/><circle class="flutter" style="animation-delay:-0.25s" cx="126" cy="20" r="1.4"/></g>`;
  },

  cassette(uid) {
    const ink = CEL.ink;
    const reel = (cx) => `<circle cx="${cx}" cy="89" r="10" fill="#f4f1ea" stroke="${ink}" stroke-width="2"/>
      <g class="spin"><circle cx="${cx}" cy="89" r="10" fill="none"/>${[0, 60, 120].map((a) => `<rect x="${cx - 1.5}" y="81" width="3" height="16" fill="${ink}" transform="rotate(${a} ${cx} 89)"/>`).join('')}</g>`;
    return `<defs>${stripes(`${uid}-bg`, '#ffb3c7', '#8fe3d6', 12, 30)}</defs>
      <rect width="${AW}" height="${AH}" fill="url(#${uid}-bg)"/>
      <rect width="${AW}" height="${AH}" fill="#fff1c9" opacity="0.35"/>
      <rect x="18" y="26" width="140" height="98" rx="10" fill="#f4f1ea" stroke="${ink}" stroke-width="3"/>
      <rect x="28" y="36" width="120" height="32" rx="4" fill="#ff5c8a" stroke="${ink}" stroke-width="2"/>
      <rect x="28" y="60" width="120" height="8" fill="#ffd23f"/>
      <text x="38" y="54" font-family="'JBM', monospace" font-size="12" font-weight="800" fill="#fff6e6">ELV MIX '96</text>
      <text x="140" y="54" font-family="'JBM', monospace" font-size="9" font-weight="800" fill="#1c1230" text-anchor="end">A</text>
      <rect x="48" y="76" width="80" height="26" rx="13" fill="#3a2f55" stroke="${ink}" stroke-width="2"/>
      <path d="M68 99Q88 104 108 99" stroke="#6b4a2a" stroke-width="3" fill="none"/>
      ${reel(68)}${reel(108)}
      <path d="M50 124L58 110H118L126 124" fill="#e2ddd0" stroke="${ink}" stroke-width="2.4"/>
      <g fill="${ink}"><circle cx="26" cy="32" r="2"/><circle cx="150" cy="32" r="2"/><circle cx="26" cy="118" r="2"/><circle cx="150" cy="118" r="2"/><circle cx="74" cy="117" r="3"/><circle cx="102" cy="117" r="3"/></g>`;
  },

  midnight(uid) {
    const ink = CEL.ink;
    const rand = rng(`${uid}-code`);
    const code = [];
    const colors = ['#5fe1d0', '#ff5c8a', '#ffd23f', '#9ad8ff', '#5fe1d0'];
    for (let i = 0; i < 7; i++) {
      let x = 54 + (i % 3 === 0 ? 0 : 6);
      const parts = 1 + Math.floor(rand() * 3);
      for (let p = 0; p < parts; p++) {
        const w = 6 + rand() * 18;
        code.push(`<rect x="${r1(x)}" y="${36 + i * 6.5}" width="${r1(w)}" height="3" fill="${colors[(i + p) % 5]}"/>`);
        x += w + 3;
      }
    }
    return `<defs><radialGradient id="${uid}-glow" cx="0.45" cy="0.4"><stop offset="0" stop-color="#5fe1d0" stop-opacity="0.45"/><stop offset="1" stop-color="#5fe1d0" stop-opacity="0"/></radialGradient></defs>
      <rect width="${AW}" height="${AH}" fill="#15122d"/>
      <rect x="120" y="10" width="46" height="40" fill="#0a0e2c" stroke="${ink}" stroke-width="2"/>
      <path d="M143 10V50M120 30H166" stroke="${ink}" stroke-width="2"/>
      <circle cx="132" cy="22" r="5" fill="#fff7d6"/><circle cx="134" cy="20" r="4.4" fill="#0a0e2c"/>
      <ellipse cx="82" cy="62" rx="80" ry="64" fill="url(#${uid}-glow)"/>
      <rect y="112" width="${AW}" height="38" fill="#2b2350"/>
      <rect x="40" y="22" width="96" height="80" rx="8" fill="#d9d2bf" stroke="${ink}" stroke-width="2.6"/>
      <rect x="49" y="30" width="78" height="58" rx="6" fill="#08221a" stroke="${ink}" stroke-width="2"/>
      ${code.join('')}
      <rect class="cursor" x="${r1(60)}" y="82" width="5" height="4" fill="#5fe1d0"/>
      <rect x="76" y="102" width="24" height="10" fill="#bfb7a2" stroke="${ink}" stroke-width="2"/>
      <rect x="34" y="114" width="70" height="8" rx="2" fill="#d9d2bf" stroke="${ink}" stroke-width="2"/>
      <text x="12" y="140" font-family="'JBM', monospace" font-size="10" font-weight="800" fill="#ff5c8a">2:00</text>
      <g transform="translate(118 84)">
        <path d="M2 66C-2 40 6 6 32 4C58 6 66 40 62 66Z" fill="${CEL.hair}" stroke="${ink}" stroke-width="2.4"/>
        <path d="M6 30C6 2 58 2 58 30" fill="none" stroke="${CEL.phones}" stroke-width="6" stroke-linecap="round"/>
        <rect x="0" y="24" width="12" height="20" rx="5" fill="${CEL.phones}" stroke="${ink}" stroke-width="2"/>
        <path d="M52 26L66 0" stroke="${ink}" stroke-width="2.4"/><circle class="cursor" cx="67" cy="-2" r="4" fill="#ffd23f" stroke="${ink}" stroke-width="1.6"/>
        <path d="M14 20C22 10 40 10 48 18" fill="none" stroke="${CEL.hairLight}" stroke-width="3" stroke-linecap="round"/>
      </g>`;
  },

  sunset(uid) {
    const k = SKIES.dusk;
    return `${sky(`${uid}-s`, 'dusk', AW, AH, 104, { sun: [70, 104, 38], clouds: [[4, 20, 60], [100, 8, 56]] })}
      <g transform="translate(70 18) scale(0.4)">${profile(k.silhouette, k.rim)}</g>`;
  },

  boot(uid) {
    const rays = [];
    for (let i = 0; i < 16; i++) rays.push(`<path d="M88 75L${r1(88 + 200 * Math.cos((i * Math.PI) / 8))} ${r1(75 + 200 * Math.sin((i * Math.PI) / 8))}L${r1(88 + 200 * Math.cos(((i + 0.5) * Math.PI) / 8))} ${r1(75 + 200 * Math.sin(((i + 0.5) * Math.PI) / 8))}Z" fill="${i % 2 ? '#ffd23f' : '#ff9442'}"/>`);
    return `<rect width="${AW}" height="${AH}" fill="#ff5c8a"/>
      <g class="rays" opacity="0.55">${rays.join('')}</g>
      <circle cx="88" cy="75" r="56" fill="#fff6e6" opacity="0.35"/>
      <g transform="translate(16 2) scale(0.56)">${mascot('happy')}</g>`;
  },
};

// ---------- 卡牌（局部坐标 200×280） ----------

export const CARD_W = 200;
export const CARD_H = 280;
const FRAME = {
  R: ['#9fc8ff', '#5d8fe0'],
  SR: ['#f4f6fb', '#9aa3b8'],
  SSR: ['#fff2a8', '#f2b500'],
};

/** 卡面；locked 时只画剪影和“？？？” */
export function card(def, index, uid, { locked = false, count } = {}) {
  const ink = CEL.ink;
  const [hi, lo] = FRAME[def.rarity];
  const stars = { R: 1, SR: 2, SSR: 3 }[def.rarity];
  const art = locked
    ? `<rect width="${AW}" height="${AH}" fill="#2a2148"/><g opacity="0.55">${SCENES[def.id](`${uid}-a`).replace(/fill="[^"]+"/g, 'fill="#3a3060"').replace(/stroke="[^"]+"/g, 'stroke="#3a3060"')}</g>
       <text x="${AW / 2}" y="${AH / 2 + 12}" class="logo" font-size="34" fill="#8a7bb0" text-anchor="middle">？？？</text>`
    : SCENES[def.id](`${uid}-a`);
  const holo =
    def.rarity === 'SSR' && !locked
      ? `<rect class="holo" x="-200" y="0" width="400" height="${CARD_H}" fill="url(#${uid}-holo)" opacity="0.45" style="mix-blend-mode:overlay"/>`
      : def.rarity === 'SR' && !locked
        ? `<rect class="sheen" x="-120" y="0" width="60" height="${CARD_H}" fill="#fff" opacity="0.28" transform="skewX(-20)"/>`
        : '';
  const starPath = (x) => `<path transform="translate(${x} 0)" d="M0 -6l1.8 4 4.4.5-3.3 3 1 4.3L0 3.6l-3.9 2.2 1-4.3-3.3-3 4.4-.5z"/>`;
  return `<g>
    <defs>
      <linearGradient id="${uid}-frame" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
      <linearGradient id="${uid}-holo" x1="0" x2="1"><stop offset="0" stop-color="#ff5c8a"/><stop offset="0.25" stop-color="#ffd23f"/><stop offset="0.5" stop-color="#5fe1d0"/><stop offset="0.75" stop-color="#8a72dc"/><stop offset="1" stop-color="#ff5c8a"/></linearGradient>
      <clipPath id="${uid}-clip"><rect width="${CARD_W}" height="${CARD_H}" rx="12"/></clipPath>
      <clipPath id="${uid}-art"><rect width="${AW}" height="${AH}" rx="4"/></clipPath>
    </defs>
    <g clip-path="url(#${uid}-clip)">
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#${uid}-frame)"/>
      <rect x="6" y="6" width="${CARD_W - 12}" height="${CARD_H - 12}" rx="8" fill="#fff8ec" stroke="${ink}" stroke-width="1.6"/>
      <g transform="translate(12 40)"><g clip-path="url(#${uid}-art)">${art}</g><rect width="${AW}" height="${AH}" rx="4" fill="none" stroke="${ink}" stroke-width="2.4"/></g>
      <text x="14" y="31" class="display" font-size="${def.rarity === 'SSR' ? 22 : 20}" font-style="italic" fill="${lo}" stroke="${ink}" stroke-width="1" paint-order="stroke">${def.rarity}</text>
      <text x="${CARD_W - 14}" y="29" class="mono" font-size="11" font-weight="700" fill="${ink}" text-anchor="end">No.${String(index + 1).padStart(2, '0')}</text>
      <text x="${CARD_W / 2}" y="218" class="serif" font-size="18" fill="${ink}" text-anchor="middle">${locked ? '？？？' : def.ja}</text>
      <text x="${CARD_W / 2}" y="238" class="ui" font-size="11" fill="#6b5a80" text-anchor="middle">${locked ? '未解锁' : def.zh}</text>
      <g transform="translate(${CARD_W / 2 - (stars - 1) * 8} 256)" fill="${def.rarity === 'R' ? '#5d8fe0' : def.rarity === 'SR' ? '#9aa3b8' : '#f2b500'}" stroke="${ink}" stroke-width="1">${Array.from({ length: stars }, (_, i) => starPath(i * 16)).join('')}</g>
      ${count != null ? `<text x="${CARD_W - 14}" y="262" class="mono" font-size="10" font-weight="700" fill="#6b5a80" text-anchor="end">x${count}</text>` : ''}
      ${holo}
    </g>
    <rect x="1.5" y="1.5" width="${CARD_W - 3}" height="${CARD_H - 3}" rx="11" fill="none" stroke="${ink}" stroke-width="3"/>
  </g>`;
}

/** 卡背（还没有人抽卡时显示） */
export function cardBack(uid) {
  const ink = CEL.ink;
  return `<g>
    <defs>${stripes(`${uid}-back`, '#3a2a7a', '#2e2166', 8, 45)}<clipPath id="${uid}-c"><rect width="${CARD_W}" height="${CARD_H}" rx="12"/></clipPath></defs>
    <g clip-path="url(#${uid}-c)">
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#${uid}-back)"/>
      <rect x="10" y="10" width="${CARD_W - 20}" height="${CARD_H - 20}" rx="8" fill="none" stroke="#ffd23f" stroke-width="2"/>
      <circle cx="${CARD_W / 2}" cy="${CARD_H / 2}" r="46" fill="#ff5c8a" stroke="${ink}" stroke-width="3"/>
      <text x="${CARD_W / 2}" y="${CARD_H / 2 + 9}" class="display" font-size="26" fill="#fff6e6" text-anchor="middle" stroke="${ink}" stroke-width="1" paint-order="stroke">ELV</text>
      <rect class="sheen" x="-120" y="0" width="60" height="${CARD_H}" fill="#fff" opacity="0.2" transform="skewX(-20)"/>
    </g>
    <rect x="1.5" y="1.5" width="${CARD_W - 3}" height="${CARD_H - 3}" rx="11" fill="none" stroke="${ink}" stroke-width="3"/>
  </g>`;
}

export const CARD_CSS = `
  .holo { animation: holo 4s linear infinite; }
  .sheen { animation: sheen 3.6s ease-in-out infinite; }
  .flip { transform-box: fill-box; transform-origin: center; animation: flip 0.9s cubic-bezier(0.2, 0.8, 0.2, 1.1) both; }
  @keyframes holo { to { transform: translateX(200px); } }
  @keyframes sheen { 0%, 40% { transform: translateX(0) skewX(-20deg); } 100% { transform: translateX(420px) skewX(-20deg); } }
  @keyframes flip { from { transform: perspective(600px) rotateY(90deg) scale(0.9); opacity: 0; } }`;
