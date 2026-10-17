/**
 * 生成 GitHub 主页用到的 SVG，并刷新 README 里标记之间的内容。
 * 视觉沿用博客 elvhack.com：暗色 + 荧光绿，亮色是暖白纸 + 国际橙；信号点阵、HUD 标注、等宽字。
 *
 *   node scripts/build.mjs          # 本地：读 GITHUB_TOKEN / GH_TOKEN，没有就跳过需要 API 的部分
 *
 * 不依赖任何 npm 包。拉不到数据时保留上一次生成的文件，不会把 README 刷成空的。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = 'elv-hack';
const SITE = 'https://elvhack.com';
/** 主页上展示的仓库，按顺序 */
const FEATURED = ['elvhack', 'quant-human', 'elvpath', 'schat'];
const POSTS = 5;
const TZ = 'Asia/Shanghai';

const THEMES = {
  dark: {
    bg: '#0a0b0d',
    elev: '#121418',
    fg: '#ecebe6',
    muted: '#9b9b95',
    faint: '#55575a',
    line: 'rgba(236,235,230,0.11)',
    strong: 'rgba(236,235,230,0.26)',
    accent: '#c6ff3d',
  },
  light: {
    bg: '#f3efe6',
    elev: '#fbf9f4',
    fg: '#161412',
    muted: '#5c5750',
    faint: '#a8a196',
    line: 'rgba(22,20,18,0.12)',
    strong: 'rgba(22,20,18,0.28)',
    accent: '#ff5a1f',
  },
};

const font = (file) => readFileSync(join(ROOT, 'scripts/fonts', file)).toString('base64');
const FONTS = `
  @font-face { font-family: 'SG'; src: url(data:font/woff2;base64,${font('space-grotesk.woff2')}) format('woff2'); font-weight: 300 700; }
  @font-face { font-family: 'JBM'; src: url(data:font/woff2;base64,${font('jetbrains-mono.woff2')}) format('woff2'); font-weight: 100 800; }`;
const SANS = `'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', system-ui, sans-serif`;
const STYLE_BASE = `
  .mono { font-family: 'JBM', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .display { font-family: 'SG', 'JBM', system-ui, sans-serif; font-weight: 700; }
  .sans { font-family: ${SANS}; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

// ---------- 小工具 ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;

function hash2(x, y, seed = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const smooth = (t) => t * t * (3 - 2 * t);
const smoothstep = (a, b, x) => smooth(Math.min(Math.max((x - a) / (b - a), 0), 1));

function noise(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const dayFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
const fmtDate = (date) => dayFormat.format(date).replaceAll('/', '.');

/** 粗略估算文字宽度：中日韩字符按 1em，其余按 0.56em */
const textWidth = (s, size) => [...s].reduce((w, ch) => w + (ch.codePointAt(0) > 0x2e80 ? size : size * 0.56), 0);

/** 按宽度折行，最多 lines 行，超出加省略号 */
function wrap(text, size, width, lines) {
  const tokens = text.match(/[⺀-￿]|[^\s⺀-￿]+|\s+/g) ?? [];
  const out = [''];
  for (const token of tokens) {
    const line = out[out.length - 1];
    if (textWidth(line + token, size) <= width) {
      out[out.length - 1] = line + token;
    } else if (/^\s+$/.test(token)) {
      out.push('');
    } else {
      out.push(token);
    }
  }
  const result = out.map((l) => l.trim()).filter(Boolean);
  if (result.length > lines) {
    let last = result[lines - 1];
    while (textWidth(`${last}…`, size) > width) last = [...last].slice(0, -1).join('');
    result.length = lines;
    result[lines - 1] = `${last.trimEnd()}…`;
  }
  return result;
}

const cropMarks = (w, h, inset, len, color) =>
  [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ]
    .map(([x, y, dx, dy]) => `<path d="M${x} ${y + dy * len}V${y}H${x + dx * len}" fill="none" stroke="${color}" stroke-width="1"/>`)
    .join('');

const write = (path, content) => {
  writeFileSync(join(ROOT, path), content);
  console.log(`wrote ${path} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
};

// ---------- 头图 ----------

function header(theme) {
  const t = THEMES[theme];
  const W = 1200;
  const H = 420;
  const CELL = 20;

  // 信号点阵：两层噪声决定每个点的大小和浓淡（和博客文章页的点阵背景同一个思路）
  const dots = [];
  const sparks = [];
  for (let y = CELL / 2; y < H; y += CELL) {
    for (let x = CELL / 2; x < W; x += CELL) {
      const n = 0.62 * noise(x / 230, y / 230, 3) + 0.38 * noise(x / 95, y / 95, 11);
      const level = smoothstep(0.3, 0.85, n);
      dots.push(`<circle cx="${x}" cy="${y}" r="${r1(0.9 + 2.5 * level)}" opacity="${r1(0.12 + 0.6 * level)}"/>`);
      // 右半边少数信号强的点用强调色闪烁
      if (x > 640 && level > 0.55 && hash2(x, y, 5) > 0.9) sparks.push([x, y, r1(1.4 + 2.2 * level)]);
    }
  }

  // 示波器窗口
  const sx = 770;
  const sy = 92;
  const sw = 366;
  const sh = 232;
  const cy = sy + sh / 2;
  const grid = [];
  for (let i = 1; i < 8; i++) grid.push(`<path d="M${r1(sx + (sw / 8) * i)} ${sy}V${sy + sh}"/>`);
  for (let i = 1; i < 6; i++) grid.push(`<path d="M${sx} ${r1(sy + (sh / 6) * i)}H${sx + sw}"/>`);
  const wave = (period, amp, harmonics, phase) => {
    const pts = [];
    for (let x = 0; x <= sw + period; x += 3) {
      const v = harmonics.reduce((s, [k, a, ph]) => s + a * Math.sin(((2 * Math.PI * k) / period) * x + ph + phase), 0);
      pts.push(`${r1(sx + x)},${r1(cy - amp * v)}`);
    }
    return `M${pts.join('L')}`;
  };
  const P1 = 183;
  const P2 = 122;
  const wave1 = wave(P1, 62, [[1, 0.7, 0], [3, 0.22, 1.3], [5, 0.08, 0.4]], 0);
  const wave2 = wave(P2, 34, [[1, 1, 0], [2, 0.3, 2.1]], 1.1);

  const sparkSvg = sparks
    .map(([x, y, r], i) => `<circle class="spark" cx="${x}" cy="${y}" r="${r}" style="animation-delay:${r1((i * 0.73) % 4)}s"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="elvhack — 代码、视觉与好奇心的个人实验室">
<style>${FONTS}${STYLE_BASE}
  .spark { fill: ${t.accent}; opacity: 0.15; animation: twinkle 4s ease-in-out infinite; }
  .band { transform: translateY(-200px); animation: scan 7.5s linear infinite; }
  .cursor { animation: blink 1.1s steps(1) infinite; }
  .live { animation: pulse 2.4s ease-in-out infinite; }
  .w1 { animation: run1 3.6s linear infinite; }
  .w2 { animation: run2 5.2s linear infinite; }
  @keyframes twinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 1; } }
  @keyframes scan { from { transform: translateY(-180px); } to { transform: translateY(${H + 40}px); } }
  @keyframes blink { 50% { opacity: 0; } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
  @keyframes run1 { to { transform: translateX(-${P1}px); } }
  @keyframes run2 { to { transform: translateX(-${P2}px); } }
</style>
<defs>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  <clipPath id="scope"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}"/></clipPath>
  <linearGradient id="fadeX" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
    <stop offset="0.42" stop-color="#fff" stop-opacity="0.3"/>
    <stop offset="0.62" stop-color="#fff" stop-opacity="1"/>
  </linearGradient>
  <linearGradient id="bandY" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset="0.7" stop-color="#fff" stop-opacity="0.9"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="edgeY" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#000" stop-opacity="1"/>
    <stop offset="0.07" stop-color="#000" stop-opacity="1"/>
    <stop offset="0.16" stop-color="#000" stop-opacity="0"/>
    <stop offset="0.8" stop-color="#000" stop-opacity="0"/>
    <stop offset="0.9" stop-color="#000" stop-opacity="1"/>
    <stop offset="1" stop-color="#000" stop-opacity="1"/>
  </linearGradient>
  <!-- 左边压淡给标题让位，上下两条压暗给 HUD 文字让位 -->
  <mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#fadeX)"/><rect width="${W}" height="${H}" fill="url(#edgeY)"/></mask>
  <mask id="scanMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect class="band" width="${W}" height="160" fill="url(#bandY)"/></mask>
  <g id="dots">${dots.join('')}</g>
</defs>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <g mask="url(#fade)">
    <use href="#dots" fill="${t.fg}" opacity="0.55"/>
    <g mask="url(#scanMask)"><use href="#dots" fill="${t.accent}"/></g>
    ${sparkSvg}
  </g>

  <!-- 示波器 -->
  <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="${t.elev}" stroke="${t.strong}"/>
  <g stroke="${t.line}" stroke-width="1" fill="none">${grid.join('')}</g>
  <path d="M${sx} ${cy}H${sx + sw}M${sx + sw / 2} ${sy}V${sy + sh}" stroke="${t.strong}" stroke-dasharray="2 4"/>
  <g clip-path="url(#scope)" fill="none" stroke-linejoin="round">
    <path class="w2" d="${wave2}" stroke="${t.muted}" stroke-width="1.2" opacity="0.6"/>
    <path class="w1" d="${wave1}" stroke="${t.accent}" stroke-width="2"/>
  </g>
  <text class="mono" x="${sx + 12}" y="${sy + 24}" font-size="14" fill="${t.muted}">CH1  SIG-ELVH</text>
  <text class="mono" x="${sx + sw - 12}" y="${sy + 24}" font-size="14" fill="${t.faint}" text-anchor="end">2.0 V/div</text>
  <text class="mono" x="${sx + 12}" y="${sy + sh - 13}" font-size="14" fill="${t.faint}">CH2  NOISE</text>
  <text class="mono" x="${sx + sw - 12}" y="${sy + sh - 13}" font-size="14" fill="${t.faint}" text-anchor="end">500 ms/div</text>

  <!-- 标题 -->
  <text class="mono" x="64" y="132" font-size="16" letter-spacing="3" fill="${t.accent}">// PERSONAL LAB</text>
  <text class="display" x="58" y="252" font-size="132" letter-spacing="-4" fill="${t.fg}">elvhack<tspan class="cursor" fill="${t.accent}">_</tspan></text>
  <text class="sans" x="66" y="306" font-size="26" fill="${t.muted}">代码、视觉与好奇心的个人实验室。</text>
  <text class="mono" x="66" y="342" font-size="17" letter-spacing="1" fill="${t.faint}">code · visuals · curiosity</text>

  <!-- HUD -->
  <rect x="40" y="33" width="11" height="11" fill="${t.accent}"/>
  <text class="mono" x="62" y="44" font-size="15" letter-spacing="2" fill="${t.muted}">SIGNAL · ELVHACK.COM</text>
  <circle class="live" cx="${W - 138}" cy="39" r="5" fill="${t.accent}"/>
  <text class="mono" x="${W - 40}" y="44" font-size="15" letter-spacing="2" fill="${t.muted}" text-anchor="end">ONLINE</text>
  <text class="mono" x="40" y="${H - 28}" font-size="15" letter-spacing="2" fill="${t.faint}">EST. 2021 · GITHUB.COM/ELV-HACK</text>
  <text class="mono" x="${W - 40}" y="${H - 28}" font-size="15" letter-spacing="2" fill="${t.faint}" text-anchor="end">X @ELVHACK · TIKTOK @ELVHACK</text>
  ${cropMarks(W, H, 18, 14, t.strong)}
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ---------- 仓库卡片 ----------

const LANG_FALLBACK = '#8b8b85';

/** 每个仓库一个由名字哈希决定的李萨如小图形，和博客的生成封面一个思路 */
function lissajous(name, x, y, size) {
  const h = hashStr(name);
  const a = 1 + (h % 4);
  const b = a + 1 + ((h >>> 3) % 3);
  const phase = ((h >>> 7) % 100) / 100 * Math.PI;
  const pts = [];
  for (let i = 0; i <= 160; i++) {
    const s = (i / 160) * Math.PI * 2;
    pts.push(`${r1(x + size / 2 + (size / 2) * Math.sin(a * s + phase))},${r1(y + size / 2 + (size / 2) * Math.sin(b * s))}`);
  }
  return `M${pts.join('L')}Z`;
}

function repoCard(repo, index, theme) {
  const t = THEMES[theme];
  const W = 420;
  const H = 178;
  const lines = wrap(repo.description || '（还没有描述）', 14, W - 48, 2);
  const lang = repo.primaryLanguage;
  const updated = fmtDate(new Date(repo.pushedAt));
  let bx = 24;
  const bottom = [];
  if (lang) {
    bottom.push(`<circle cx="${bx + 5}" cy="${H - 23}" r="5" fill="${lang.color || LANG_FALLBACK}"/>`);
    bottom.push(`<text class="mono" x="${bx + 16}" y="${H - 19}" font-size="12" fill="${t.muted}">${esc(lang.name)}</text>`);
    bx += 16 + textWidth(lang.name, 12) + 22;
  }
  if (repo.stargazerCount > 0) bottom.push(`<text class="mono" x="${bx}" y="${H - 19}" font-size="12" fill="${t.muted}">★ ${repo.stargazerCount}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(repo.name)}：${esc(repo.description || '')}">
<style>${FONTS}${STYLE_BASE}
  .mark { stroke-dasharray: 1; animation: draw 2.4s cubic-bezier(0.3, 0.6, 0.2, 1); }
  @keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${t.bg}" stroke="${t.line}"/>
<rect x="0" y="24" width="3" height="28" fill="${t.accent}"/>
<text class="mono" x="24" y="34" font-size="11" letter-spacing="2" fill="${t.faint}">REPO / ${String(index + 1).padStart(2, '0')}</text>
<path class="mark" pathLength="1" d="${lissajous(repo.name, W - 70, 18, 46)}" fill="none" stroke="${t.accent}" stroke-width="1.2" opacity="0.9"/>
<text class="display" x="24" y="70" font-size="24" letter-spacing="-0.5" fill="${t.fg}">${esc(repo.name)}</text>
${lines.map((line, i) => `<text class="sans" x="24" y="${100 + i * 21}" font-size="14" fill="${t.muted}">${esc(line)}</text>`).join('\n')}
<path d="M24 ${H - 42}H${W - 24}" stroke="${t.line}"/>
${bottom.join('\n')}
<text class="mono" x="${W - 24}" y="${H - 19}" font-size="12" fill="${t.faint}" text-anchor="end">${updated}</text>
</svg>
`;
}

// ---------- 提交信号 ----------

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

function activity(calendar, theme) {
  const t = THEMES[theme];
  const W = 880;
  const H = 256;
  const CELL = 15;
  const left = 46;
  const top = 116;
  const weeks = calendar.weeks.slice(-53);
  const dots = [];
  const months = [];
  let lastMonth = -1;
  let today = null;
  weeks.forEach((week, wi) => {
    for (const day of week.contributionDays) {
      const date = new Date(`${day.date}T00:00:00Z`);
      const wd = date.getUTCDay();
      const x = left + wi * CELL + CELL / 2;
      const y = top + wd * CELL + CELL / 2;
      const level = LEVELS[day.contributionLevel] ?? 0;
      const r = [1.3, 2.6, 3.6, 4.5, 5.4][level];
      const fill = level === 4 ? t.accent : t.fg;
      const opacity = [0.16, 0.4, 0.62, 0.85, 1][level];
      dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}"/>`);
      today = { x, y };
      if (wd === 0 && date.getUTCMonth() !== lastMonth && date.getUTCDate() <= 7) {
        lastMonth = date.getUTCMonth();
        months.push(`<text class="mono" x="${x - 5}" y="${top - 12}" font-size="11" fill="${t.faint}">${lastMonth + 1}月</text>`);
      }
    }
  });
  const legend = [1.3, 2.6, 3.6, 4.5, 5.4]
    .map((r, i) => `<circle cx="${W - 116 + i * 15}" cy="44" r="${r}" fill="${i === 4 ? t.accent : t.fg}" opacity="${[0.16, 0.4, 0.62, 0.85, 1][i]}"/>`)
    .join('');
  const total = calendar.totalContributions;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="过去一年 ${total} 次提交">
<style>${FONTS}${STYLE_BASE}
  .now { animation: ping 2.4s ease-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes ping { from { transform: scale(0.6); opacity: 1; } to { transform: scale(2.2); opacity: 0; } }
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.bg}" stroke="${t.line}"/>
<rect x="28" y="33" width="8" height="8" fill="${t.accent}"/>
<text class="mono" x="44" y="41" font-size="12" letter-spacing="2" fill="${t.muted}">SIGNAL / 365 DAYS</text>
<text class="sans" x="28" y="70" font-size="15" fill="${t.fg}">过去一年 <tspan class="display" font-size="18" fill="${t.accent}">${total}</tspan> 次提交</text>
<text class="mono" x="${W - 136}" y="48" font-size="11" fill="${t.faint}" text-anchor="end">少</text>
${legend}
<text class="mono" x="${W - 32}" y="48" font-size="11" fill="${t.faint}">多</text>
${months.join('')}
${['一', '三', '五'].map((d, i) => `<text class="sans" x="26" y="${top + (1 + i * 2) * CELL + CELL / 2 + 4}" font-size="10" fill="${t.faint}">${d}</text>`).join('')}
${dots.join('')}
${today ? `<circle class="now" cx="${today.x}" cy="${today.y}" r="6" fill="none" stroke="${t.accent}" stroke-width="1.2"/>` : ''}
<text class="mono" x="${W - 28}" y="${H - 22}" font-size="11" fill="${t.faint}" text-anchor="end">updated ${fmtDate(new Date())}</text>
</svg>
`;
}

// ---------- 数据 ----------

async function github(token) {
  const repos = FEATURED.map(
    (name, i) =>
      `r${i}: repository(owner: "${USER}", name: "${name}") { name description url stargazerCount pushedAt primaryLanguage { name color } }`,
  ).join('\n');
  const query = `query { user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } } } } ${repos} }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'elv-hack-profile' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  return {
    calendar: json.data.user.contributionsCollection.contributionCalendar,
    repos: FEATURED.map((_, i) => json.data[`r${i}`]).filter(Boolean),
  };
}

async function posts() {
  const res = await fetch(`${SITE}/rss.xml`, { headers: { 'User-Agent': 'elv-hack-profile' } });
  if (!res.ok) throw new Error(`rss ${res.status}`);
  const xml = await res.text();
  const pick = (item, tag) => item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1].trim() ?? '';
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => ({ title: pick(item, 'title'), link: pick(item, 'link'), date: new Date(pick(item, 'pubDate')), description: pick(item, 'description') }))
    .sort((a, b) => b.date - a.date)
    .slice(0, POSTS);
}

// ---------- README ----------

const picture = (name, alt, attrs = '') =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg"><img src="assets/${name}-light.svg" alt="${esc(alt)}"${attrs}></picture>`;

function replaceBlock(readme, key, body) {
  const re = new RegExp(`(<!-- ${key}:start -->)[\\s\\S]*?(<!-- ${key}:end -->)`);
  if (!re.test(readme)) throw new Error(`README 缺少 ${key} 标记`);
  return readme.replace(re, `$1\n${body}\n$2`);
}

// ---------- main ----------

for (const theme of Object.keys(THEMES)) write(`assets/header-${theme}.svg`, header(theme));

const readmePath = join(ROOT, 'README.md');
let readme = readFileSync(readmePath, 'utf8');

try {
  const list = await posts();
  const body = list
    .map((p) => `- \`${fmtDate(p.date)}\` **[${p.title}](${p.link})**<br><sub>${p.description}</sub>`)
    .join('\n');
  readme = replaceBlock(readme, 'posts', `${body}\n\n<sub>→ 全部文章在 [elvhack.com/posts](${SITE}/posts/)，也可以 [订阅 RSS](${SITE}/rss.xml)。</sub>`);
  console.log(`posts: ${list.length}`);
} catch (error) {
  console.warn('跳过文章列表：', error.message);
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (token) {
  try {
    const { calendar, repos } = await github(token);
    for (const theme of Object.keys(THEMES)) {
      write(`assets/activity-${theme}.svg`, activity(calendar, theme));
      repos.forEach((repo, i) => write(`assets/repo-${repo.name}-${theme}.svg`, repoCard(repo, i, theme)));
    }
    // GitHub 会把行内图片之间的换行变成 <br>，所以同一行的两张卡片写在一行里
    const cardHtml = repos.map(
      (repo) => `<a href="${repo.url}">${picture(`repo-${repo.name}`, `${repo.name}：${repo.description ?? ''}`, ' width="49%"')}</a>`,
    );
    const cards = cardHtml
      .map((html, i) => (i % 2 ? `&nbsp;${html}` : html))
      .reduce((rows, html, i) => (i % 2 ? rows.with(-1, rows.at(-1) + html) : [...rows, html]), [])
      .join('\n');
    readme = replaceBlock(readme, 'repos', cards);
    readme = replaceBlock(
      readme,
      'activity',
      `<a href="https://github.com/${USER}">${picture('activity', `过去一年 ${calendar.totalContributions} 次提交`, ' width="100%"')}</a>`,
    );
  } catch (error) {
    console.warn('跳过 GitHub 数据：', error.message);
  }
} else {
  console.warn('没有 GITHUB_TOKEN / GH_TOKEN，跳过仓库卡片和提交信号');
}

if (existsSync(readmePath)) writeFileSync(readmePath, readme);
