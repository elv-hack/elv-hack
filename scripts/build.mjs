/**
 * 生成 GitHub 主页的静态图（片头、一年的提交），并刷新 README 里标记之间的文章列表。
 * 会变的部分（玫瑰、迷宫、抽一件、按钮）由 worker/ 里的 Cloudflare Worker 按请求生成。
 *
 *   node scripts/build.mjs          # 读 GITHUB_TOKEN / GH_TOKEN，没有就跳过需要 API 的部分
 *
 * 不依赖任何 npm 包。拉不到数据时保留上一次生成的文件，不会把 README 刷成空的。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ABYSS } from './abyss.mjs';
import { faceLayer } from './face.mjs';
import { baseStyle } from './lib.mjs';
import { headerPanel, yearPanel } from './pieces.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = 'elv-hack';
const SITE = 'https://elvhack.com';
const POSTS = 6;
const TZ = 'Asia/Shanghai';

const font = (file) => readFileSync(join(ROOT, 'scripts/fonts', file)).toString('base64');
const FONTS = baseStyle({ grotesk: font('space-grotesk.woff2'), mono: font('jetbrains-mono.woff2') });

const dayFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
const fmtDate = (date) => dayFormat.format(date).replaceAll('/', '.');

const write = (path, content) => {
  writeFileSync(join(ROOT, path), content);
  console.log(`wrote ${path} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
};

async function contributions(token) {
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
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => ({ title: pick(item, 'title'), link: pick(item, 'link'), date: new Date(pick(item, 'pubDate')) }))
    .sort((a, b) => b.date - a.date)
    .slice(0, POSTS);
}

function replaceBlock(readme, key, body) {
  const re = new RegExp(`(<!-- ${key}:start -->)[\\s\\S]*?(<!-- ${key}:end -->)`);
  if (!re.test(readme)) throw new Error(`README 缺少 ${key} 标记`);
  return readme.replace(re, `$1\n${body}\n$2`);
}

// ---------- 片头 ----------

const face = faceLayer({ cols: 96, rows: 54, size: 10.4, cx: 850, cy: 306, fill: 'url(#head-flow)', eye: ABYSS.amber });
write('assets/header.svg', headerPanel({ faceGroups: face.body, faceCss: face.css, fonts: FONTS }));

// ---------- README ----------

const readmePath = join(ROOT, 'README.md');
let readme = readFileSync(readmePath, 'utf8');

try {
  const list = await posts();
  readme = replaceBlock(readme, 'posts', list.map((p) => `<a href="${p.link}">${p.title}</a> <sub>${fmtDate(p.date)}</sub><br>`).join('\n'));
  console.log(`posts: ${list.length}`);
} catch (error) {
  console.warn('跳过文章列表：', error.message);
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (token) {
  try {
    const cal = await contributions(token);
    const days = cal.weeks.flatMap((w) => w.contributionDays).slice(-365).map((d) => ({ date: d.date, count: d.contributionCount }));
    write('assets/year.svg', yearPanel({ days, total: cal.totalContributions, fonts: FONTS }));
  } catch (error) {
    console.warn('跳过一年的提交：', error.message);
  }
} else {
  console.warn('没有 GITHUB_TOKEN / GH_TOKEN，跳过一年的提交');
}

writeFileSync(readmePath, readme);
