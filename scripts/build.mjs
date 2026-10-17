/**
 * 生成 GitHub 主页用到的静态 SVG（头图、频道卷宗、全年信号波形），并刷新 README 里标记之间的内容。
 * 实时的部分（信号台日志、按钮计数、行情）由 worker/ 里的 Cloudflare Worker 按请求生成。
 *
 *   node scripts/build.mjs          # 读 GITHUB_TOKEN / GH_TOKEN，没有就跳过需要 API 的部分
 *
 * 不依赖任何 npm 包。拉不到数据时保留上一次生成的文件，不会把 README 刷成空的。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { THEMES, barcode, baseStyle, esc, hashStr, monoWidth, r1, rng, wrap } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = 'elv-hack';
const SITE = 'https://elvhack.com';
/** 四个频道，各配一个仓库；stamp 是卡片上盖的章 */
const CHANNELS = [
  { code: 'QUANT', repo: 'quantcore', stamp: 'ALPHA' },
  { code: 'SEC', repo: 'Z3r0', stamp: 'RED TEAM' },
  { code: 'DEV', repo: 'elvhack', stamp: 'SHIPPED' },
  { code: 'INTEL', repo: 'nexus', stamp: 'OSINT' },
];
const POSTS = 5;
const TZ = 'Asia/Shanghai';

const fontFile = (file) => readFileSync(join(ROOT, 'scripts/fonts', file)).toString('base64');
const BASE = baseStyle({ mono: fontFile('jetbrains-mono.woff2'), grotesk: fontFile('space-grotesk.woff2') });

const dayFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
const fmtDate = (date) => dayFormat.format(date).replaceAll('/', '.');

const write = (path, content) => {
  writeFileSync(join(ROOT, path), content);
  console.log(`wrote ${path} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
};

// ---------- 头图 ----------

function header(theme) {
  const t = THEMES[theme];
  const W = 1200;
  const H = 580;

  // 顶部滚动的密级横幅
  const unit = ' CLASSIFIED // QUANT · SEC · DEV · INTEL // SUBJECT: ELVHACK // EYES ONLY //';
  const marqSize = 14;
  const marqSpacing = 2;
  const unitW = unit.length * (marqSize * 0.6 + marqSpacing);
  const marquee = unit.repeat(Math.ceil((W * 2) / unitW) + 1);

  // 右下角滚动的内存转储
  const rand = rng('elvhack-hexdump');
  const hexLines = [];
  for (let i = 0; i < 16; i++) {
    const bytes = Array.from({ length: 8 }, () => Math.floor(rand() * 256));
    const ascii = bytes.map((b) => (b > 32 && b < 127 && b !== 60 && b !== 62 && b !== 38 ? String.fromCharCode(b) : '.')).join('');
    hexLines.push(`0x${(0x7ffe0 + i * 8).toString(16).toUpperCase()}  ${bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}  ${ascii}`);
  }
  const hexX = 812;
  const hexTop = 392;
  const hexH = 112;
  const LINE = 18;
  const hexText = [...hexLines, ...hexLines]
    .map((line, i) => `<text x="${hexX + 14}" y="${hexTop + 32 + i * LINE}">${esc(line)}</text>`)
    .join('');

  // CLEARANCE 一栏的“解密”过程：几帧乱码逐步变成明文
  const clear = 'QUANT · SEC · DEV · INTEL';
  const glyphs = 'ABCDEF0123456789#%&@$/\\';
  const scr = rng('elvhack-decrypt');
  const FRAMES = 9;
  const frames = Array.from({ length: FRAMES }, (_, f) =>
    [...clear].map((ch, i) => (i < (f / FRAMES) * clear.length || ch === ' ' ? ch : glyphs[Math.floor(scr() * glyphs.length)])).join(''),
  );
  const CYCLE = 7;
  const STEP = 0.09;
  const finalAt = ((FRAMES * STEP) / CYCLE) * 100;

  // 四个频道框，轮流点亮
  const boxW = 168;
  const boxes = CHANNELS.map(({ code }, i) => {
    const x = 40 + i * (boxW + 12);
    const label = `0${i + 1} ${code}`;
    return `<g>
      <rect x="${x}" y="526" width="${boxW}" height="34" fill="none" stroke="${t.strong}"/>
      <text class="mono" x="${x + 14}" y="548" font-size="14" letter-spacing="2" fill="${t.muted}">${label}</text>
      <g class="lit" style="animation-delay:${i * 2}s"><rect x="${x}" y="526" width="${boxW}" height="34" fill="${t.accent}"/>
      <text class="mono" x="${x + 14}" y="548" font-size="14" font-weight="700" letter-spacing="2" fill="${t.onAccent}">${label}</text></g>
    </g>`;
  }).join('');

  // 标题切片：每片是一条横带，故障时整条左右错开
  const slices = [
    [196, 30, 'g1', '5s', '0s'],
    [252, 16, 'g2', '5s', '-0.15s'],
    [284, 22, 'g3', '7s', '-2.2s'],
  ]
    .map(
      ([y, h, cls, dur, delay], i) => `<clipPath id="slice${i}"><rect x="0" y="${y}" width="${W}" height="${h}"/></clipPath>
      <g clip-path="url(#slice${i})"><g class="${cls}" style="animation-duration:${dur};animation-delay:${delay}">
        <rect x="-40" y="${y}" width="${W + 80}" height="${h}" fill="${t.bg}"/><use href="#word" fill="${t.fg}"/>
        <rect x="-40" y="${y + h - 2}" width="${W + 80}" height="2" fill="${t.accent}" opacity="0.8"/>
      </g></g>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="ELVHACK — QUANT · SEC · DEV · INTEL">
<style>${BASE}
  .marq { animation: marq ${r1(unitW / 38)}s linear infinite; }
  .ga { transform: translateX(-5px); animation: ga 5s steps(1, end) infinite; mix-blend-mode: ${t.blend}; }
  .gb { transform: translateX(5px); animation: gb 5s steps(1, end) infinite; mix-blend-mode: ${t.blend}; }
  .g1, .g2, .g3 { opacity: 0; animation: glitch 5s steps(1, end) infinite; }
  .g2 { animation-name: glitch2; }
  .g3 { animation-name: glitch3; }
  .fr { opacity: 0; animation: fr ${CYCLE}s steps(1, end) infinite; }
  .fin { animation: fin ${CYCLE}s steps(1, end) infinite; }
  .hex { animation: hex 14s linear infinite; }
  .lit { opacity: 0; animation: lit 8s steps(1, end) infinite; }
  .blink { animation: blink 1.2s steps(1, end) infinite; }
  .crt { transform: translateY(-160px); animation: crt 6.5s linear infinite; }
  @keyframes marq { to { transform: translateX(-${r1(unitW)}px); } }
  @keyframes ga { 0% { transform: translateX(-5px); } 88% { transform: translateX(-16px); } 89.5% { transform: translateX(-2px); } 91% { transform: translateX(-11px); } 92.5% { transform: translateX(-5px); } }
  @keyframes gb { 0% { transform: translateX(5px); } 88% { transform: translateX(13px); } 89.5% { transform: translateX(3px); } 91% { transform: translateX(9px); } 92.5% { transform: translateX(5px); } }
  @keyframes glitch { 0% { opacity: 0; transform: none; } 88% { opacity: 1; transform: translateX(-26px); } 89.5% { transform: translateX(18px); } 91% { transform: translateX(-8px); } 92.5% { opacity: 0; transform: none; } }
  @keyframes glitch2 { 0% { opacity: 0; transform: none; } 88.5% { opacity: 1; transform: translateX(34px); } 90% { transform: translateX(-12px); } 92% { opacity: 0; transform: none; } }
  @keyframes glitch3 { 0% { opacity: 0; transform: none; } 70% { opacity: 1; transform: translateX(-14px); } 71.5% { transform: translateX(22px); } 73% { opacity: 0; transform: none; } }
  @keyframes fr { 0% { opacity: 1; } ${r1((STEP / CYCLE) * 100)}% { opacity: 0; } }
  @keyframes fin { 0% { opacity: 0; } ${r1(finalAt)}% { opacity: 1; } }
  @keyframes hex { to { transform: translateY(-${hexLines.length * LINE}px); } }
  @keyframes lit { 0% { opacity: 1; } 25% { opacity: 0; } }
  @keyframes blink { 50% { opacity: 0; } }
  @keyframes crt { to { transform: translateY(${H + 40}px); } }
</style>
<defs>
  <text id="word" class="display" x="40" y="318" font-size="250" textLength="1120" lengthAdjust="spacingAndGlyphs">ELVHACK</text>
  <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${t.fg}" opacity="0.045"/></pattern>
  <linearGradient id="crtGrad" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="${t.accent}" stop-opacity="0"/>
    <stop offset="0.85" stop-color="${t.accent}" stop-opacity="0.07"/>
    <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="hexClip"><rect x="${hexX}" y="${hexTop + 14}" width="348" height="${hexH - 14}"/></clipPath>
  <clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>
</defs>
<g clip-path="url(#frame)">
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<g stroke="${t.line}">${Array.from({ length: 11 }, (_, i) => `<path d="M${(i + 1) * 100} 38V${H}"/>`).join('')}</g>

<!-- 密级横幅 -->
<rect width="${W}" height="38" fill="${t.stripBg}"/>
<text class="mono marq" x="0" y="25" font-size="${marqSize}" font-weight="700" letter-spacing="${marqSpacing}" fill="${t.stripFg}" xml:space="preserve">${esc(marquee)}</text>

<!-- HUD -->
<rect x="40" y="62" width="11" height="11" fill="${t.accent}"/>
<text class="mono" x="62" y="73" font-size="14" letter-spacing="2" fill="${t.muted}">SIGINT TERMINAL // NODE ELV-HACK // REV 2.6</text>
<circle class="blink" cx="${W - 142}" cy="68" r="5" fill="${t.alt}"/>
<text class="mono" x="${W - 40}" y="73" font-size="14" letter-spacing="2" fill="${t.muted}" text-anchor="end">REC LIVE</text>
<text class="mono" x="40" y="112" font-size="12" letter-spacing="2" fill="${t.faint}">FIG.01 — SUBJECT IDENT</text>
<text class="mono" x="${W - 40}" y="112" font-size="12" letter-spacing="2" fill="${t.faint}" text-anchor="end">LAT ██.████ / LON ███.████</text>

<!-- 标题：两层错位的色版 + 正片 + 故障切片 -->
<use class="ga" href="#word" fill="${t.alt}"/>
<use class="gb" href="#word" fill="${t.accent}"/>
<use href="#word" fill="${t.fg}"/>
${slices}

<path d="M40 356H${W - 40}" stroke="${t.strong}"/>
<text class="mono" x="40" y="376" font-size="11" letter-spacing="2" fill="${t.faint}">DOSSIER</text>
<text class="mono" x="${hexX}" y="376" font-size="11" letter-spacing="2" fill="${t.faint}">MEMORY DUMP // 0x7FFE0</text>

<!-- 档案 -->
<g class="mono" font-size="18">
  <text x="40" y="414" letter-spacing="2" fill="${t.faint}">SUBJECT</text>
  <text x="220" y="414" fill="${t.fg}">ELVHACK</text>
  <text x="40" y="446" letter-spacing="2" fill="${t.faint}">REAL NAME</text>
  <rect x="220" y="430" width="248" height="21" fill="${t.fg}"/>
  <text x="482" y="446" font-size="13" letter-spacing="2" fill="${t.faint}">[REDACTED]</text>
  <text x="40" y="478" letter-spacing="2" fill="${t.faint}">CLEARANCE</text>
  ${frames.map((f, i) => `<text class="fr" x="220" y="478" fill="${t.muted}" style="animation-delay:${r1(i * STEP * 100) / 100}s" xml:space="preserve">${esc(f)}</text>`).join('')}
  <text class="fin" x="220" y="478" fill="${t.accent}" xml:space="preserve">${esc(clear)}</text>
  <text x="40" y="510" letter-spacing="2" fill="${t.faint}">BASE</text>
  <text x="220" y="510" fill="${t.fg}">ELVHACK.COM</text>
  <text x="480" y="510" letter-spacing="2" fill="${t.faint}">STATUS</text>
  <circle class="blink" cx="586" cy="504" r="5" fill="${t.accent}"/>
  <text x="600" y="510" fill="${t.fg}">ACTIVE</text>
</g>

<!-- 内存转储 -->
<rect x="${hexX}" y="${hexTop}" width="348" height="${hexH}" fill="${t.panel}" stroke="${t.strong}"/>
<g clip-path="url(#hexClip)"><g class="mono hex" font-size="12" fill="${t.muted}" xml:space="preserve">${hexText}</g></g>
<rect x="${hexX}" y="${hexTop}" width="348" height="14" fill="${t.panel}"/>

<!-- 频道 + 条形码 -->
${boxes}
${barcode('elvhack-tx', hexX, 526, 230, 34, t.fg)}
<text class="mono" x="${W - 40}" y="548" font-size="12" letter-spacing="1" fill="${t.faint}" text-anchor="end">TX 0x5F649D</text>

<!-- 扫描线 -->
<rect width="${W}" height="${H}" fill="url(#scanlines)" pointer-events="none"/>
<rect class="crt" width="${W}" height="160" fill="url(#crtGrad)"/>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${t.strong}"/>
</svg>
`;
}

// ---------- 频道卷宗 ----------

function dossier(channel, repo, index, theme) {
  const t = THEMES[theme];
  const W = 420;
  const H = 240;
  const cut = 22;
  const tab = `CH.0${index + 1} // ${channel.code}`;
  const tabW = tab.length * (13 * 0.6 + 2) + 26;
  const caseId = hashStr(repo.name).toString(16).toUpperCase().slice(0, 6);
  const pushed = new Date(repo.pushedAt);
  const active = Date.now() - pushed.getTime() < 30 * 86400_000;

  let body;
  if (repo.description) {
    body = wrap(repo.description, 14, W - 44, 2)
      .map((line, i) => `<text class="sans" x="22" y="${142 + i * 22}" font-size="14" fill="${t.muted}">${esc(line)}</text>`)
      .join('');
  } else {
    // 没有简介：涂黑，而不是替作者编一句
    const rand = rng(`redact-${repo.name}`);
    const bars = [];
    for (let row = 0; row < 2; row++) {
      let x = 22;
      while (x < W - 90) {
        const w = 30 + rand() * 90;
        bars.push(`<rect x="${r1(x)}" y="${128 + row * 22}" width="${r1(Math.min(w, W - 60 - x))}" height="14" fill="${t.fg}" opacity="0.85"/>`);
        x += w + 8;
      }
    }
    body = `${bars.join('')}<text class="mono" x="22" y="${186}" font-size="11" letter-spacing="2" fill="${t.faint}">[DESCRIPTION REDACTED]</text>`;
  }
  const origin = repo.isFork && repo.parent ? `FORKED FROM ${repo.parent.nameWithOwner}` : `${USER}/${repo.name}`;
  const stampW = monoWidth(channel.stamp, 15) + channel.stamp.length * 4 + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(channel.code)}：${esc(repo.name)}">
<style>${BASE}
  .stamp { transform-box: fill-box; transform-origin: center; animation: stamp 0.55s cubic-bezier(0.2, 0.7, 0.2, 1.2) both; animation-delay: 0.3s; }
  @keyframes stamp { from { transform: scale(1.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
<path d="M0.5 0.5H${W - 0.5}V${H - cut}L${W - cut} ${H - 0.5}H0.5Z" fill="${t.bg}" stroke="${t.strong}"/>
<rect x="0" y="0" width="${r1(tabW)}" height="30" fill="${t.accent}"/>
<text class="mono" x="13" y="20" font-size="13" font-weight="700" letter-spacing="2" fill="${t.onAccent}">${esc(tab)}</text>
<text class="mono" x="${W - 16}" y="20" font-size="11" letter-spacing="1" fill="${t.faint}" text-anchor="end">CASE 0x${caseId}</text>
${barcode(`case-${repo.name}`, W - 116, 28, 100, 10, t.faint)}
<text class="display" x="20" y="84" font-size="34" letter-spacing="-0.5" fill="${t.fg}">${esc(repo.name)}</text>
<text class="mono" x="22" y="108" font-size="11" letter-spacing="1" fill="${t.faint}">${esc(origin.toUpperCase())}</text>
<g transform="rotate(-8 ${W - 20 - stampW / 2} 78)"><g class="stamp">
  <rect x="${r1(W - 20 - stampW)}" y="60" width="${r1(stampW)}" height="34" fill="none" stroke="${t.alt}" stroke-width="2"/>
  <text class="mono" x="${r1(W - 20 - stampW / 2)}" y="83" font-size="15" font-weight="800" letter-spacing="4" fill="${t.alt}" text-anchor="middle">${esc(channel.stamp)}</text>
</g></g>
${body}
<path d="M22 ${H - 50}H${W - 22}" stroke="${t.line}"/>
<g class="mono" font-size="11" letter-spacing="1">
  <text x="22" y="${H - 24}" fill="${t.faint}">LANG <tspan fill="${t.muted}">${esc(repo.primaryLanguage?.name ?? '—')}</tspan></text>
  <text x="170" y="${H - 24}" fill="${t.faint}">LAST <tspan fill="${t.muted}">${fmtDate(pushed)}</tspan></text>
  <text x="${W - 40}" y="${H - 24}" fill="${active ? t.accent : t.faint}" text-anchor="end">${active ? '● ACTIVE' : '○ DORMANT'}</text>
</g>
</svg>
`;
}

// ---------- 全年信号波形 ----------

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function intercepts(calendar, theme) {
  const t = THEMES[theme];
  const W = 880;
  const H = 264;
  const x0 = 40;
  const x1 = W - 40;
  const mid = 140;
  const days = calendar.weeks.flatMap((w) => w.contributionDays).slice(-365);
  const max = Math.max(1, ...days.map((d) => d.contributionCount));
  const step = (x1 - x0) / (days.length - 1);
  const quiet = [];
  const loud = [];
  const ticks = [];
  days.forEach((day, i) => {
    const x = r1(x0 + i * step);
    const n = day.contributionCount;
    if (n === 0) {
      quiet.push(`M${x} ${mid - 1.5}V${mid + 1.5}`);
    } else {
      const k = Math.sqrt(n / max);
      const h = r1(4 + 58 * k);
      const hot = n >= max * 0.6;
      loud.push(`<path d="M${x} ${r1(mid - h)}V${r1(mid + h)}" stroke="${hot ? t.accent : t.fg}" opacity="${hot ? 1 : r1(0.35 + 0.6 * k)}"/>`);
    }
    const date = new Date(`${day.date}T00:00:00Z`);
    if (date.getUTCDate() === 1) {
      ticks.push(`<path d="M${x} 214V222" stroke="${t.strong}"/><text x="${x + 4}" y="236">${MONTHS[date.getUTCMonth()]}</text>`);
    }
  });
  const last = [...days].reverse().find((d) => d.contributionCount > 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="过去一年 ${calendar.totalContributions} 次提交">
<style>${BASE}
  .head { animation: head 9s linear infinite; }
  .blink { animation: blink 1.2s steps(1, end) infinite; }
  @keyframes head { from { transform: translateX(0); } to { transform: translateX(${x1 - x0}px); } }
  @keyframes blink { 50% { opacity: 0; } }
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="${t.bg}" stroke="${t.strong}"/>
<rect x="${x0}" y="27" width="10" height="10" fill="${t.accent}"/>
<text class="mono" x="${x0 + 18}" y="37" font-size="13" letter-spacing="2" fill="${t.muted}">INTERCEPTS // 365D</text>
<text class="mono" x="${x1}" y="37" font-size="12" letter-spacing="1" fill="${t.faint}" text-anchor="end">${calendar.totalContributions} SIGNALS · PEAK ${max}/D · LAST ${last ? last.date.replaceAll('-', '.') : '—'}</text>
<path d="M${x0} ${mid}H${x1}" stroke="${t.line}"/>
<path d="${quiet.join('')}" stroke="${t.faint}" stroke-width="1.2"/>
<g stroke-width="1.6">${loud.join('')}</g>
<g class="mono" font-size="11" letter-spacing="1" fill="${t.faint}">${ticks.join('')}</g>
<path d="M${x0} 214H${x1}" stroke="${t.line}"/>
<g class="head"><path d="M${x0} 66V214" stroke="${t.alt}" opacity="0.75"/><rect x="${x0 - 3}" y="62" width="6" height="6" fill="${t.alt}"/></g>
<circle class="blink" cx="${x1}" cy="${mid}" r="4" fill="${t.accent}"/>
<text class="mono" x="${x1}" y="${H - 10}" font-size="10" letter-spacing="1" fill="${t.faint}" text-anchor="end">SYNC ${fmtDate(new Date())}</text>
</svg>
`;
}

// ---------- 数据 ----------

async function github(token) {
  const repos = CHANNELS.map(
    ({ repo }, i) =>
      `r${i}: repository(owner: "${USER}", name: "${repo}") { name description url isFork parent { nameWithOwner } pushedAt primaryLanguage { name } }`,
  ).join('\n');
  const query = `query { user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } ${repos} }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'elv-hack-profile' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  return {
    calendar: json.data.user.contributionsCollection.contributionCalendar,
    repos: CHANNELS.map((_, i) => json.data[`r${i}`]),
  };
}

async function posts() {
  const res = await fetch(`${SITE}/rss.xml`, { headers: { 'User-Agent': 'elv-hack-profile' } });
  if (!res.ok) throw new Error(`rss ${res.status}`);
  const xml = await res.text();
  const pick = (item, tag) => item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1].trim() ?? '';
  const all = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => ({ title: pick(item, 'title'), link: pick(item, 'link'), date: new Date(pick(item, 'pubDate')), description: pick(item, 'description') }))
    .sort((a, b) => b.date - a.date);
  return all.slice(0, POSTS).map((post, i) => ({ ...post, tx: all.length - i }));
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
    .map((p) => `- \`TX/${String(p.tx).padStart(3, '0')}\` **[${p.title}](${p.link})** \`${fmtDate(p.date)}\`<br><sub>${p.description}</sub>`)
    .join('\n');
  readme = replaceBlock(readme, 'posts', `${body}\n\n<sub>全部文章 → [elvhack.com/posts](${SITE}/posts/) · [RSS](${SITE}/rss.xml)</sub>`);
  console.log(`posts: ${list.length}`);
} catch (error) {
  console.warn('跳过文章列表：', error.message);
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (token) {
  try {
    const { calendar, repos } = await github(token);
    const cards = [];
    CHANNELS.forEach((channel, i) => {
      const repo = repos[i];
      if (!repo) return console.warn(`找不到仓库 ${channel.repo}，跳过`);
      const name = `channel-${channel.code.toLowerCase()}`;
      for (const theme of Object.keys(THEMES)) write(`assets/${name}-${theme}.svg`, dossier(channel, repo, i, theme));
      cards.push(`<a href="${repo.url}">${picture(name, `${channel.code}：${repo.name}`, ' width="49%"')}</a>`);
    });
    for (const theme of Object.keys(THEMES)) write(`assets/intercepts-${theme}.svg`, intercepts(calendar, theme));
    // GitHub 会把行内图片之间的换行变成 <br>，所以同一行的两张卡片写在一行里
    const rows = [];
    for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2).join('&nbsp;'));
    readme = replaceBlock(readme, 'channels', rows.join('\n'));
    readme = replaceBlock(
      readme,
      'intercepts',
      `<a href="https://github.com/${USER}">${picture('intercepts', `过去一年 ${calendar.totalContributions} 次提交`, ' width="100%"')}</a>`,
    );
  } catch (error) {
    console.warn('跳过 GitHub 数据：', error.message);
  }
} else {
  console.warn('没有 GITHUB_TOKEN / GH_TOKEN，跳过频道卡片和信号波形');
}

writeFileSync(readmePath, readme);
