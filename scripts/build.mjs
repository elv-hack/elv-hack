/**
 * 生成 GitHub 主页的静态 SVG（片头、片尾字幕、放送记录），并刷新 README 里标记之间的内容。
 * 会动、会变的部分（看板娘、抽卡、通信日志、按钮）由 worker/ 里的 Cloudflare Worker 按请求生成。
 *
 *   node scripts/build.mjs          # 读 GITHUB_TOKEN / GH_TOKEN，没有就跳过需要 API 的部分
 *
 * 不依赖任何 npm 包。拉不到数据时保留上一次生成的文件，不会把 README 刷成空的。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MASCOT_CSS, SCENE_CSS, profile, sky } from './art.mjs';
import { SKIES, THEMES, baseStyle, esc, r1, rng } from './lib.mjs';
import { EPISODE, STAFF } from './story.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = 'elv-hack';
const SITE = 'https://elvhack.com';
const POSTS = 5;
const TZ = 'Asia/Shanghai';
/** 片尾字幕里的名字对应的仓库 */
const REPOS = { elvhack: 'elvhack', quantcore: 'quantcore', Z3r0: 'Z3r0', nexus: 'nexus' };

const font = (file) => readFileSync(join(ROOT, 'scripts/fonts', file)).toString('base64');
const FONTS = {
  grotesk: font('space-grotesk.woff2'),
  mono: font('jetbrains-mono.woff2'),
  logo: font('cjk-logo.woff2'),
  serif: font('cjk-serif.woff2'),
  ui: font('cjk-ui.woff2'),
};

const dayFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
const fmtDate = (date) => dayFormat.format(date).replaceAll('/', '.');

const write = (path, content) => {
  writeFileSync(join(ROOT, path), content);
  console.log(`wrote ${path} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
};

/** 录像带的屏幕叠加：PLAY、走动的计时、日期、跟踪噪声条、扫描线、暗角 */
function vhs(W, H, uid, date) {
  const rand = rng(`${uid}-noise`);
  const noise = [];
  for (let i = 0; i < 26; i++) noise.push(`<rect x="${r1(rand() * W)}" y="${r1(rand() * 26)}" width="${r1(20 + rand() * 180)}" height="${r1(1 + rand() * 2.5)}" fill="#fff" opacity="${r1(0.2 + rand() * 0.6)}"/>`);
  // 计时：60 帧，每秒换一帧
  const clock = Array.from({ length: 60 }, (_, s) => `<text class="tick" style="animation-delay:${s}s" x="${W - 44}" y="58" text-anchor="end">0:02:${String(s).padStart(2, '0')}</text>`).join('');
  const osd = `font-family="'JBM', monospace" font-weight="800" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"`;
  return `<defs>
      <pattern id="${uid}-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.2" fill="#000" opacity="0.16"/></pattern>
      <radialGradient id="${uid}-vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}-scan)"/>
    <g class="track" opacity="0.5">${noise.join('')}</g>
    <rect width="${W}" height="${H}" fill="url(#${uid}-vig)"/>
    <g ${osd} font-size="26">
      <g class="blink"><path d="M44 36L66 49L44 62Z" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"/><text x="76" y="58">PLAY</text></g>
      <text x="176" y="58" font-size="20">SP</text>
      ${clock}
      <text x="${W - 44}" y="${H - 40}" fill="#ffb347" font-size="28" text-anchor="end">${date}</text>
    </g>`;
}

const VHS_CSS = `
  .blink { animation: blink 1.2s steps(1, end) infinite; }
  .tick { opacity: 0; animation: tick 60s steps(1, end) infinite; }
  .track { animation: track 7s linear infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @keyframes tick { 0% { opacity: 1; } 1.6667% { opacity: 0; } }
  @keyframes track { 0% { transform: translateY(-60px); } 70%, 100% { transform: translateY(700px); } }`;

// ---------- 片头 ----------

function opening(theme) {
  const t = THEMES[theme];
  const k = SKIES[t.sky];
  const W = 1200;
  const H = 620;
  const horizon = 440;
  const dusk = t.sky === 'dusk';
  const ep = EPISODE[theme];
  const scene = sky('op', t.sky, W, H, horizon, {
    sun: dusk ? [780, horizon, 170] : [930, 150, 76],
    clouds: dusk ? [[40, 120, 280], [600, 70, 200], [960, 230, 170]] : [[20, 150, 340], [560, 60, 280], [980, 260, 200]],
    city: [0, 430, 96],
    plainSun: !dusk,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="エルヴハック ${esc(ep.no)}「${esc(ep.title)}」">
<style>${baseStyle({ grotesk: FONTS.grotesk, mono: FONTS.mono, logo: FONTS.logo, serif: FONTS.serif })}${SCENE_CSS}${MASCOT_CSS}${VHS_CSS}
  .logoIn { transform-box: fill-box; transform-origin: 0 100%; animation: logoIn 0.9s cubic-bezier(0.2, 1.3, 0.4, 1) both; }
  @keyframes logoIn { from { transform: scale(1.25) skewX(-8deg); opacity: 0; } }
</style>
<defs>
  <clipPath id="op-frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  <linearGradient id="op-logo" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="0.55" stop-color="#fff0c2"/><stop offset="1" stop-color="${dusk ? '#ffb347' : '#ffd23f'}"/></linearGradient>
</defs>
<g clip-path="url(#op-frame)">
  ${scene}
  <g transform="translate(872 104) scale(1.42)">${profile(k.silhouette, k.rim)}</g>

  <!-- 片名 -->
  <text class="mono" x="66" y="148" font-size="17" font-weight="800" letter-spacing="7" fill="#fff" stroke="${t.ink}" stroke-width="4" paint-order="stroke">TV ANIMATION · 1996</text>
  <g class="logoIn" transform="skewX(-7)">
    <text class="logo" x="86" y="270" font-size="116" letter-spacing="-2" fill="${t.pink}" transform="translate(8 8)">エルヴハック</text>
    <text class="logo" x="86" y="270" font-size="116" letter-spacing="-2" fill="url(#op-logo)" stroke="${t.ink}" stroke-width="14" stroke-linejoin="round" paint-order="stroke">エルヴハック</text>
  </g>
  <text class="display" x="80" y="326" font-size="40" letter-spacing="24" fill="${t.orange}" stroke="${t.ink}" stroke-width="6" stroke-linejoin="round" paint-order="stroke" transform="skewX(-7)">ELVHACK</text>

  <!-- 话数卡 -->
  <g transform="translate(60 470)">
    <rect width="500" height="98" fill="#0b0716" opacity="0.88"/>
    <rect x="6" y="6" width="488" height="86" fill="none" stroke="#fff6e6" stroke-width="1.4"/>
    <text class="serif" x="24" y="40" font-size="24" fill="#fff6e6">${esc(ep.no)}</text>
    <text class="serif" x="24" y="80" font-size="34" fill="#fff6e6">「${esc(ep.title)}」</text>
  </g>

  ${vhs(W, H, 'op', dusk ? 'OCT.18 1996' : 'AUG.08 1996')}
</g>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="17" fill="none" stroke="${t.ink}" stroke-width="3"/>
</svg>
`;
}

// ---------- 片尾字幕 ----------

function ending(theme) {
  const t = THEMES[theme];
  const k = SKIES.dusk;
  const W = 1200;
  const H = 420;
  const lineH = 70;
  // 字幕从画面中间开始往上滚，打开时就能看到 STAFF
  const top = 150;
  const rows = STAFF.map(
    ([role, name], i) => `<text class="serif" x="820" y="${top + 70 + i * lineH}" font-size="15" fill="#c9b8e8" text-anchor="end">${esc(role)}</text>
      <text class="serif" x="846" y="${top + 70 + i * lineH}" font-size="26" fill="#fff6e6">${esc(name)}</text>`,
  );
  const end = top + 70 + STAFF.length * lineH + 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="STAFF：${esc(STAFF.map((s) => s.join(' ')).join('，'))}">
<style>${baseStyle({ mono: FONTS.mono, logo: FONTS.logo, serif: FONTS.serif })}${SCENE_CSS}${MASCOT_CSS}
  .roll { animation: roll 22s linear infinite; }
  @keyframes roll { to { transform: translateY(-${end - 40}px); } }
</style>
<defs>
  <clipPath id="ed-frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  <clipPath id="ed-left"><rect width="560" height="${H}"/></clipPath>
  <linearGradient id="ed-fade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0b0716"/><stop offset="0.16" stop-color="#0b0716" stop-opacity="0"/><stop offset="0.84" stop-color="#0b0716" stop-opacity="0"/><stop offset="1" stop-color="#0b0716"/></linearGradient>
</defs>
<g clip-path="url(#ed-frame)">
  <rect width="${W}" height="${H}" fill="#0b0716"/>
  <g clip-path="url(#ed-left)">
    ${sky('ed', 'dusk', 560, H, 300, { sun: [250, 300, 120], clouds: [[20, 70, 180], [330, 40, 150]], city: [360, 200, 90] })}
    <g transform="translate(250 96) scale(0.95)">${profile(k.silhouette, k.rim)}</g>
  </g>
  <path d="M560 0V${H}" stroke="#fff6e6" stroke-width="2"/>
  <g class="roll">
    <text class="logo" x="833" y="${top}" font-size="30" fill="${t.pink}" text-anchor="middle" letter-spacing="10">STAFF</text>
    ${rows.join('')}
    <text class="logo" x="833" y="${end}" font-size="26" fill="#fff6e6" text-anchor="middle">おわり</text>
  </g>
  <rect x="560" width="${W - 560}" height="${H}" fill="url(#ed-fade)"/>
  <text class="mono" x="${W - 30}" y="30" font-size="12" font-weight="700" fill="#8a7bb0" text-anchor="end">(C) 1996-2026 ELVHACK</text>
</g>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="17" fill="none" stroke="${t.ink}" stroke-width="3"/>
</svg>
`;
}

// ---------- 放送记录（全年提交） ----------

function broadcast(calendar, theme) {
  const t = THEMES[theme];
  const W = 880;
  const H = 250;
  const x0 = 40;
  const x1 = W - 40;
  const base = 170;
  const days = calendar.weeks.flatMap((w) => w.contributionDays).slice(-365);
  const max = Math.max(1, ...days.map((d) => d.contributionCount));
  const step = (x1 - x0) / (days.length - 1);
  const bars = [];
  const ticks = [];
  days.forEach((day, i) => {
    const x = r1(x0 + i * step);
    const n = day.contributionCount;
    const k = Math.sqrt(n / max);
    const h = n ? r1(6 + 96 * k) : 2;
    const color = n === 0 ? t.line : k > 0.75 ? t.gold : k > 0.4 ? t.orange : t.pink;
    bars.push(`<rect x="${x - 0.9}" y="${r1(base - h)}" width="1.8" height="${h}" fill="${color}"/>`);
    const date = new Date(`${day.date}T00:00:00Z`);
    if (date.getUTCDate() === 1) ticks.push(`<path d="M${x} ${base + 4}V${base + 10}" stroke="${t.strong}"/><text x="${x + 3}" y="${base + 26}">${date.getUTCMonth() + 1}月</text>`);
  });
  const last = [...days].reverse().find((d) => d.contributionCount > 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="过去一年 ${calendar.totalContributions} 次提交">
<style>${baseStyle({ mono: FONTS.mono, logo: FONTS.logo, ui: FONTS.ui, grotesk: FONTS.grotesk })}
  .head { animation: head 10s linear infinite; }
  .blink { animation: blink 1.2s steps(1, end) infinite; }
  @keyframes head { to { transform: translateX(${x1 - x0}px); } }
  @keyframes blink { 50% { opacity: 0; } }
</style>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="16" fill="${t.panel}" stroke="${t.ink}" stroke-width="3"/>
<rect x="${x0}" y="24" width="96" height="30" rx="15" fill="${t.pink}" stroke="${t.ink}" stroke-width="2.4"/>
<text class="logo" x="${x0 + 48}" y="45" font-size="16" fill="${t.onPink}" text-anchor="middle">放送記録</text>
<text class="ui" x="${x0 + 112}" y="45" font-size="15" fill="${t.fg}">过去一年 <tspan class="display" font-size="20" fill="${t.pink}">${calendar.totalContributions}</tspan> 次提交 · 峰值 ${max} · 最后 ${last ? last.date.replaceAll('-', '.') : '—'}</text>
<g>${bars.join('')}</g>
<path d="M${x0} ${base}H${x1}" stroke="${t.strong}"/>
<g class="ui" font-size="11" fill="${t.faint}">${ticks.join('')}</g>
<g class="head"><path d="M${x0} 66V${base}" stroke="${t.teal}" stroke-width="2"/><path d="M${x0 - 6} 62h12l-6 8z" fill="${t.teal}"/></g>
<circle class="blink" cx="${x1}" cy="${base - 6}" r="4" fill="${t.pink}"/>
<text class="mono" x="${x1}" y="${H - 20}" font-size="10" font-weight="700" fill="${t.faint}" text-anchor="end">ON AIR · ${fmtDate(new Date())}</text>
</svg>
`;
}

// ---------- 数据 ----------

async function github(token) {
  const query = `query { user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'elv-hack-profile' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  return json.data.user.contributionsCollection.contributionCalendar;
}

async function posts() {
  const res = await fetch(`${SITE}/rss.xml`, { headers: { 'User-Agent': 'elv-hack-profile' } });
  if (!res.ok) throw new Error(`rss ${res.status}`);
  const xml = await res.text();
  const pick = (item, tag) => item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1].trim() ?? '';
  const all = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => ({ title: pick(item, 'title'), link: pick(item, 'link'), date: new Date(pick(item, 'pubDate')), description: pick(item, 'description') }))
    .sort((a, b) => b.date - a.date);
  return all.slice(0, POSTS).map((post, i) => ({ ...post, no: all.length - i }));
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

for (const theme of Object.keys(THEMES)) {
  write(`assets/opening-${theme}.svg`, opening(theme));
  write(`assets/ending-${theme}.svg`, ending(theme));
}

const readmePath = join(ROOT, 'README.md');
let readme = readFileSync(readmePath, 'utf8');

try {
  const list = await posts();
  const [next, ...rest] = list;
  const body = [
    `> **次回、第${next.no}話「[${next.title}](${next.link})」。** お楽しみに！<br><sub>${next.description}</sub>`,
    '',
    ...rest.map((p) => `- \`第${p.no}話\` [${p.title}](${p.link}) <sub>${fmtDate(p.date)}</sub>`),
    '',
    `<sub>全部剧集 → [elvhack.com/posts](${SITE}/posts/) · [RSS](${SITE}/rss.xml)</sub>`,
  ].join('\n');
  readme = replaceBlock(readme, 'posts', body);
  console.log(`posts: ${list.length}`);
} catch (error) {
  console.warn('跳过次回予告：', error.message);
}

const staffLinks = [...new Set(STAFF.map(([, name]) => name).filter((name) => REPOS[name]))]
  .map((name) => `<a href="https://github.com/${USER}/${REPOS[name]}">${name}</a>`)
  .join(' · ');
readme = replaceBlock(readme, 'staff', `<p align="center"><sub>STAFF：${staffLinks}</sub></p>`);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (token) {
  try {
    const calendar = await github(token);
    for (const theme of Object.keys(THEMES)) write(`assets/broadcast-${theme}.svg`, broadcast(calendar, theme));
    readme = replaceBlock(
      readme,
      'broadcast',
      `<a href="https://github.com/${USER}">${picture('broadcast', `过去一年 ${calendar.totalContributions} 次提交`, ' width="100%"')}</a>`,
    );
  } catch (error) {
    console.warn('跳过放送记录：', error.message);
  }
} else {
  console.warn('没有 GITHUB_TOKEN / GH_TOKEN，跳过放送记录');
}

writeFileSync(readmePath, readme);
