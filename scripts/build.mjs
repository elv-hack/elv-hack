/**
 * 生成 GitHub 主页上的所有图（assets/*.svg），并刷新 README 里标记之间的文章列表。
 * 图都是自己播放的动画，没有交互：片头的三张 ASCII 肖像、全息玫瑰、声呐（地形是一年的提交，要 token）、奇点。
 *
 *   node scripts/build.mjs          # 读 GITHUB_TOKEN / GH_TOKEN，没有就跳过需要 API 的部分
 *
 * 不依赖任何 npm 包。拉不到数据时保留上一次生成的文件，不会把 README 刷成空的。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseStyle } from './lib.mjs';
import { headerPanel, rosePanel, singularityPanel, sonarPanel } from './pieces.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = 'elv-hack';
const SITE = 'https://elvhack.com';
const POSTS = 6;
const TZ = 'Asia/Shanghai';

const font = (file) => readFileSync(join(ROOT, 'scripts/fonts', file)).toString('base64');
const FONTS = baseStyle({ mono: font('jetbrains-mono.woff2') });

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

// ---------- 自己播放的画面 ----------

// 每张图两版：深色（默认）和 -light（GitHub 浅色主题，README 里用 <picture> 切换）
const THEMES = [['dark', ''], ['light', '-light']];
const faces = JSON.parse(readFileSync(join(ROOT, 'scripts/faces.json'), 'utf8')).portraits;
for (const [theme, suffix] of THEMES) {
  write(`assets/header${suffix}.svg`, headerPanel({ faces, fonts: FONTS, theme }));
  write(`assets/rose${suffix}.svg`, rosePanel({ theme }));
  write(`assets/singularity${suffix}.svg`, singularityPanel({ theme }));
}

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

// 声呐的地形是一年的提交：每周一排（最近的在前），每排七天
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (token) {
  try {
    const cal = await contributions(token);
    const weeks = cal.weeks
      .map((w) => {
        const days = [0, 0, 0, 0, 0, 0, 0];
        for (const d of w.contributionDays) days[new Date(`${d.date}T00:00:00Z`).getUTCDay()] = d.contributionCount;
        return days;
      })
      .reverse();
    for (const [theme, suffix] of THEMES) write(`assets/sonar${suffix}.svg`, sonarPanel({ weeks, theme }));
  } catch (error) {
    console.warn('跳过声呐（一年的提交）：', error.message);
  }
} else {
  console.warn('没有 GITHUB_TOKEN / GH_TOKEN，跳过声呐（一年的提交）');
}

writeFileSync(readmePath, readme);
