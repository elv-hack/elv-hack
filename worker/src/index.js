/**
 * GitHub 主页背后的小服务（signal.elvhack.com）：看板娘、抽卡、通信日志。
 *
 *   GET /pet/:action          投喂 / 摸头 / 戳（milktea · headpat · poke），然后回到主页的看板娘
 *   GET /gacha/pull           单抽一次，然后回到主页的抽卡区
 *   GET /deck/:action         发一条信号（ping · scan · decrypt · trace），然后回到主页的通信日志
 *   GET /stage.svg            看板娘：按日本时间和全站好感度换表情和台词
 *   GET /gacha.svg            最新一抽 + 抽卡记录
 *   GET /collection.svg       全站图鉴
 *   GET /feed.svg             通信日志 + 新闻跑马灯（BTC 行情）
 *   GET /button/:action.svg   按钮，带当前计数
 *
 * README 里的图片经 GitHub 的 camo 代理加载，每个 SVG 都带 no-cache，访客回到主页时能看到刚才的结果。
 * camo 是 GitHub 的服务器在取图，所以分不出是谁在看：显示的都是“全站最新”。
 * 不存 IP：只存按天轮换、加盐的哈希，用来限流。
 */
import grotesk from '../../scripts/fonts/space-grotesk.woff2';
import mono from '../../scripts/fonts/jetbrains-mono.woff2';
import logo from '../../scripts/fonts/cjk-logo.woff2';
import serif from '../../scripts/fonts/cjk-serif.woff2';
import ui from '../../scripts/fonts/cjk-ui.woff2';
import { CARD_CSS, CARD_H, CARD_W, MASCOT_CSS, SCENE_CSS, card, cardBack, mascot, sky } from '../../scripts/art.mjs';
import { THEMES, baseStyle, esc, hashStr, r1, skyForHour, textWidth, wrap } from '../../scripts/lib.mjs';
import { BUTTONS, CARDS, RATES, REACTIONS, TIME_LINES, WEEKEND_LINE } from '../../scripts/story.mjs';

const PROFILE = 'https://github.com/elv-hack';
const SIGNALS = ['ping', 'scan', 'decrypt', 'trace'];
const PETS = ['milktea', 'headpat', 'poke'];
const AFFECTION = { milktea: 3, headpat: 2, poke: 1 };
/** 同一访客 10 分钟内的上限 */
const LIMITS = { signal: 5, pet: 12, gacha: 10 };
const WINDOW_MS = 10 * 60_000;
const KEEP_ROWS = 500;
const RECENT_MS = 10 * 60_000;

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const F = { grotesk: toBase64(grotesk), mono: toBase64(mono), logo: toBase64(logo), serif: toBase64(serif), ui: toBase64(ui) };
const STYLE = {
  stage: baseStyle({ grotesk: F.grotesk, mono: F.mono, logo: F.logo, ui: F.ui }),
  cards: baseStyle({ grotesk: F.grotesk, mono: F.mono, logo: F.logo, serif: F.serif, ui: F.ui }),
  feed: baseStyle({ grotesk: F.grotesk, mono: F.mono, logo: F.logo, ui: F.ui }),
  button: baseStyle({ grotesk: F.grotesk, mono: F.mono, logo: F.logo }),
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const theme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';
    const path = url.pathname.replace(/\/+$/, '') || '/';

    let m;
    if ((m = path.match(/^\/pet\/([a-z]+)$/)) && PETS.includes(m[1])) {
      await guard(() => recordAction(request, env, 'pet', m[1]));
      return Response.redirect(`${PROFILE}#kanban`, 302);
    }
    if (path === '/gacha/pull') {
      await guard(() => pull(request, env));
      return Response.redirect(`${PROFILE}#gacha`, 302);
    }
    if ((m = path.match(/^\/deck\/([a-z]+)$/)) && SIGNALS.includes(m[1])) {
      await guard(() => recordSignal(request, env, m[1]));
      return Response.redirect(`${PROFILE}#signal-deck`, 302);
    }
    if (path === '/stage.svg') return svg(await stage(env, theme));
    if (path === '/gacha.svg') return svg(await gacha(env, theme));
    if (path === '/collection.svg') return svg(await collection(env, theme));
    if (path === '/feed.svg') return svg(await feed(env, ctx, theme));
    if ((m = path.match(/^\/button\/([a-z]+)\.svg$/)) && BUTTONS[m[1]]) return svg(await button(env, m[1], theme));
    if (path === '/') return Response.redirect(PROFILE, 302);
    return new Response('not found', { status: 404 });
  },
};

const guard = (fn) => fn().catch((error) => console.error(error));

function svg(body) {
  return new Response(body, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; font-src data:",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// ---------- 记录 ----------

async function visitor(request, env) {
  // 只算浏览器里真正点出来的跳转；预取、爬虫和脚本请求都不算
  if (request.headers.get('sec-fetch-mode') !== 'navigate') return null;
  const day = new Date().toISOString().slice(0, 10);
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.SALT ?? 'elvhack'}|${day}|${request.headers.get('cf-connecting-ip') ?? ''}`));
  const who = [...new Uint8Array(data).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const country = /^[A-Z]{2}$/.test(request.cf?.country ?? '') ? request.cf.country : 'XX';
  return { who, country };
}

async function limited(env, table, who, kind) {
  const since = Date.now() - WINDOW_MS;
  const n =
    table === 'signals'
      ? await env.DB.prepare('SELECT COUNT(*) AS n FROM signals WHERE who = ? AND ts > ?').bind(who, since).first('n')
      : await env.DB.prepare('SELECT COUNT(*) AS n FROM actions WHERE who = ? AND kind = ? AND ts > ?').bind(who, kind, since).first('n');
  return n >= LIMITS[kind];
}

const bump = (env, key, by = 1) =>
  env.DB.prepare('INSERT INTO counters (action, n) VALUES (?, ?) ON CONFLICT (action) DO UPDATE SET n = n + ?').bind(key, by, by);
const prune = (env, table) =>
  env.DB.prepare(`DELETE FROM ${table} WHERE id <= (SELECT id FROM ${table} ORDER BY id DESC LIMIT 1 OFFSET ${KEEP_ROWS})`);

async function recordSignal(request, env, action) {
  const v = await visitor(request, env);
  if (!v || (await limited(env, 'signals', v.who, 'signal'))) return;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO signals (ts, action, country, who) VALUES (?, ?, ?, ?)').bind(Date.now(), action, v.country, v.who),
    bump(env, action),
    prune(env, 'signals'),
  ]);
}

async function recordAction(request, env, kind, item, extra = '') {
  const v = await visitor(request, env);
  if (!v || (await limited(env, 'actions', v.who, kind))) return false;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO actions (ts, kind, item, extra, country, who) VALUES (?, ?, ?, ?, ?, ?)').bind(Date.now(), kind, item, extra, v.country, v.who),
    bump(env, `${kind}:${item}`),
    ...(kind === 'pet' ? [bump(env, 'affection', AFFECTION[item])] : []),
    ...(kind === 'gacha' ? [bump(env, 'gacha:total'), bump(env, `rarity:${extra}`)] : []),
    prune(env, 'actions'),
  ]);
  return true;
}

function roll() {
  const r = crypto.getRandomValues(new Uint32Array(2));
  const x = r[0] / 2 ** 32;
  const rarity = x < RATES.SSR ? 'SSR' : x < RATES.SSR + RATES.SR ? 'SR' : 'R';
  const pool = CARDS.filter((c) => c.rarity === rarity);
  return pool[r[1] % pool.length];
}

const pull = (request, env) => {
  const c = roll();
  return recordAction(request, env, 'gacha', c.id, c.rarity);
};

async function counters(env) {
  const { results } = await env.DB.prepare('SELECT action, n FROM counters').all();
  return Object.fromEntries(results.map((r) => [r.action, r.n]));
}

// ---------- 时间和文字 ----------

/** 日本时间 */
function jst(now = Date.now()) {
  const d = new Date(now + 9 * 3600_000);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes(), day: d.getUTCDay(), date: d };
}
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const two = (n) => String(n).padStart(2, '0');

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return '刚刚';
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

function affection(score) {
  const level = Math.floor(Math.sqrt(score / 4)) + 1;
  const from = 4 * (level - 1) ** 2;
  const to = 4 * level ** 2;
  return { level, progress: (score - from) / (to - from), toNext: to - score };
}

/** 一行一行打字出来的台词 */
function typewriter(lines, x, y, size, lineH, fill) {
  let delay = 0.2;
  return lines
    .map((line, i) => {
      const chars = [...line].length;
      const dur = Math.max(0.3, chars * 0.045);
      const el = `<text class="ui type" x="${x}" y="${y + i * lineH}" font-size="${size}" fill="${fill}" style="animation-duration:${r1(dur)}s;animation-delay:${r1(delay)}s;animation-timing-function:steps(${chars}, end)" xml:space="preserve">${esc(line)}</text>`;
      delay += dur;
      return el;
    })
    .join('');
}
const TYPE_CSS = `
  .type { clip-path: inset(0 100% 0 0); animation-name: type; animation-fill-mode: forwards; }
  .caret { animation: caret 0.9s ease-in-out infinite; }
  @keyframes type { to { clip-path: inset(0 0 0 0); } }
  @keyframes caret { 50% { transform: translateY(5px); } }
  @media (prefers-reduced-motion: reduce) { .type { clip-path: none; } }`;

const frame = (W, H, t, fill = t.panel) =>
  `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="18" fill="${fill}" stroke="${t.ink}" stroke-width="3"/>`;
const pill = (x, y, text, t, bg = t.pink, fg = t.onPink, size = 18) => {
  const w = textWidth(text, size) + 30;
  return `<rect x="${x}" y="${y}" width="${r1(w)}" height="${size + 14}" rx="${(size + 14) / 2}" fill="${bg}" stroke="${t.ink}" stroke-width="2.4"/>
    <text class="logo" x="${r1(x + w / 2)}" y="${y + size + 3}" font-size="${size}" fill="${fg}" text-anchor="middle">${esc(text)}</text>`;
};
const heart = (x, y, s, fill, stroke) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -3C-2 -8 -10 -8 -10 -1C-10 5 0 10 0 12C0 10 10 5 10 -1C10 -8 2 -8 0 -3Z" fill="${fill}" stroke="${stroke}" stroke-width="${r1(2 / s)}"/>`;

// ---------- 看板娘 ----------

async function stage(env, theme) {
  const t = THEMES[theme];
  const W = 1200;
  const H = 460;
  const now = Date.now();
  const time = jst(now);
  const [c, recent, ssr] = await Promise.all([
    counters(env),
    env.DB.prepare("SELECT item, ts FROM actions WHERE kind = 'pet' AND ts > ? ORDER BY ts DESC LIMIT 6").bind(now - RECENT_MS).all(),
    env.DB.prepare("SELECT ts FROM actions WHERE kind = 'gacha' AND extra = 'SSR' AND ts > ? ORDER BY ts DESC LIMIT 1").bind(now - RECENT_MS).first('ts'),
  ]);
  const score = c.affection ?? 0;
  const aff = affection(score);

  // 台词：刚被互动过 → 反应；刚有人抽到 SSR → 惊喜；否则按日本时间
  let line;
  const last = recent.results[0];
  if (last) {
    const pokes = recent.results.filter((r) => r.item === 'poke').length;
    line = last.item === 'poke' && pokes >= 3 ? REACTIONS.pokeAgain : REACTIONS[last.item];
  } else if (ssr) {
    line = REACTIONS.ssr;
  } else if (score === 0 && !(c['gacha:total'] > 0)) {
    line = REACTIONS.firstVisit;
  } else if ((time.day === 0 || time.day === 6) && time.hour >= 10 && time.hour < 22) {
    line = WEEKEND_LINE;
  } else {
    line = TIME_LINES.find((l) => time.hour >= l.from && time.hour < l.to);
  }
  const skyName = skyForHour(time.hour);
  const night = skyName === 'night';
  const lines = wrap(line.text, 27, 640, 3);

  const hearts = Array.from({ length: 10 }, (_, i) =>
    heart(560 + i * 30, 118, 1.15, i < Math.round(aff.progress * 10) ? t.pink : 'none', i < Math.round(aff.progress * 10) ? t.ink : t.faint),
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="エルヴ：${esc(line.text)}">
<style>${STYLE.stage}${MASCOT_CSS}${SCENE_CSS}${TYPE_CSS}</style>
<defs>
  <clipPath id="st-win"><rect x="18" y="18" width="404" height="${H - 36}" rx="12"/></clipPath>
  <pattern id="st-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.4" fill="${t.pink}" opacity="0.18"/></pattern>
</defs>
${frame(W, H, t)}
<rect x="430" y="12" width="${W - 442}" height="${H - 24}" rx="12" fill="url(#st-dots)"/>
<g clip-path="url(#st-win)">
  ${sky('st', skyName, 440, H, 300, { sun: night ? [330, 160, 60] : skyName === 'day' ? [330, 90, 40] : [300, 300, 110], clouds: [[30, 60, 150], [250, 150, 120]], city: [0, 160, 70], plainSun: skyName === 'day' || skyName === 'morning' })}
  <g transform="translate(46 128) scale(1.3)">${mascot(line.expr)}</g>
</g>
<rect x="18" y="18" width="404" height="${H - 36}" rx="12" fill="none" stroke="${t.ink}" stroke-width="3"/>
${night ? `<text class="mono" x="36" y="50" font-size="14" font-weight="800" fill="#fff6d6">NIGHT</text>` : ''}

<!-- 右上：时间 -->
${pill(452, 30, '看板娘', t, t.teal, t.ink, 16)}
<text class="ui" x="${W - 40}" y="52" font-size="17" fill="${t.muted}" text-anchor="end">日本时间 ${two(time.hour)}:${two(time.minute)} · 星期${WEEK[time.day]}</text>

<!-- 好感度 -->
<text class="logo" x="452" y="126" font-size="22" fill="${t.fg}">好感度</text>
${hearts}
<text class="display" x="${W - 40}" y="128" font-size="34" fill="${t.pink}" text-anchor="end" stroke="${t.ink}" stroke-width="1.2" paint-order="stroke">Lv.${aff.level}</text>
<text class="ui" x="452" y="166" font-size="15" fill="${t.muted}">奶茶 ×${c['pet:milktea'] ?? 0}　摸头 ×${c['pet:headpat'] ?? 0}　戳 ×${c['pet:poke'] ?? 0}　· 全站一起攒的，再 ${aff.toNext} 点升级</text>

<!-- 对话框 -->
<g transform="translate(452 214)">
  <rect width="708" height="206" rx="16" fill="${t.box}" stroke="${t.ink}" stroke-width="3"/>
  <rect x="7" y="7" width="694" height="192" rx="11" fill="none" stroke="${t.pink}" stroke-width="1.6"/>
  <g transform="translate(26 -22)">${pill(0, 0, 'エルヴ', t, t.pink, t.onPink, 20)}</g>
  ${typewriter(lines, 34, 74, 27, 46, t.boxText)}
  <path class="caret" d="M672 176L688 176L680 186Z" fill="${t.pink}"/>
</g>
</svg>
`;
}

// ---------- 抽卡 ----------

const RARITY_COLOR = { R: '#5d8fe0', SR: '#9aa3b8', SSR: '#f2b500' };

async function gacha(env, theme) {
  const t = THEMES[theme];
  const W = 1200;
  const H = 480;
  const now = Date.now();
  const [c, recent] = await Promise.all([
    counters(env),
    env.DB.prepare("SELECT id, ts, item, extra, country FROM actions WHERE kind = 'gacha' ORDER BY ts DESC, id DESC LIMIT 10").all(),
  ]);
  const pulls = recent.results;
  const latest = pulls[0];
  const def = latest && CARDS.find((x) => x.id === latest.item);
  const total = c['gacha:total'] ?? 0;
  const fresh = latest && now - latest.ts < RECENT_MS;
  const cardSvg = def ? card(def, CARDS.indexOf(def), 'g-latest') : cardBack('g-back');

  const chips = pulls
    .map((p, i) => {
      const x = 440 + i * 72;
      return `<g transform="translate(${x} 352)" opacity="${r1(1 - i * 0.07)}">
        <rect width="62" height="34" rx="8" fill="${RARITY_COLOR[p.extra] ?? t.faint}" stroke="${t.ink}" stroke-width="2"/>
        <text class="display" x="31" y="23" font-size="${p.extra === 'SSR' ? 15 : 16}" fill="#fff" text-anchor="middle" stroke="${t.ink}" stroke-width="0.8" paint-order="stroke">${p.extra}</text>
        <text class="mono" x="31" y="54" font-size="11" font-weight="700" fill="${t.faint}" text-anchor="middle">${esc(p.country)}</text>
      </g>`;
    })
    .join('');

  const celebrate =
    fresh && def.rarity !== 'R'
      ? `<g class="pop"><text class="display" x="${W - 60}" y="110" font-size="${def.rarity === 'SSR' ? 64 : 52}" fill="${RARITY_COLOR[def.rarity]}" stroke="${t.ink}" stroke-width="3" paint-order="stroke" text-anchor="end" transform="rotate(-6 ${W - 160} 90)">${def.rarity}!!</text></g>`
      : '';

  const rays = Array.from({ length: 18 }, (_, i) => {
    const a0 = (i * Math.PI) / 9;
    const a1 = a0 + Math.PI / 18;
    return `<path d="M200 240L${r1(200 + 700 * Math.cos(a0))} ${r1(240 + 700 * Math.sin(a0))}L${r1(200 + 700 * Math.cos(a1))} ${r1(240 + 700 * Math.sin(a1))}Z"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="最新一抽：${def ? `${def.rarity} ${esc(def.ja)}` : '还没有人抽卡'}">
<style>${STYLE.cards}${CARD_CSS}${SCENE_CSS}${MASCOT_CSS}
  .pop { transform-box: fill-box; transform-origin: center; animation: popIn 0.7s 0.6s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
  @keyframes popIn { from { transform: scale(0) rotate(-20deg); } }
</style>
<defs><clipPath id="g-frame"><rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="16"/></clipPath></defs>
${frame(W, H, t)}
<g clip-path="url(#g-frame)"><g class="rays" fill="${t.gold}" opacity="${theme === 'dark' ? 0.07 : 0.14}">${rays}</g></g>
<g transform="translate(60 40) scale(1.4)"><g class="flip">${cardSvg}</g></g>

${pill(440, 40, 'ガチャ', t, t.gold, t.ink, 20)}
<text class="ui" x="${440 + textWidth('ガチャ', 20) + 46}" y="63" font-size="18" fill="${t.muted}">最新一抽</text>
${
  def
    ? `<text class="serif" x="440" y="150" font-size="44" fill="${t.fg}">${esc(def.ja)}</text>
       <text class="ui" x="440" y="188" font-size="18" fill="${t.muted}">${esc(def.zh)}　·　<tspan class="display" fill="${RARITY_COLOR[def.rarity]}" font-size="20">${def.rarity}</tspan></text>
       <text class="ui" x="440" y="228" font-size="17" fill="${t.faint}">No.${String(total).padStart(4, '0')} · 来自 ${esc(latest.country)} · ${ago(now - latest.ts)}</text>`
    : `<text class="ui" x="440" y="150" font-size="34" fill="${t.fg}">还没有人抽卡</text>
       <text class="ui" x="440" y="192" font-size="18" fill="${t.muted}">点下面的按钮，来抽第一张吧</text>`
}
<text class="ui" x="440" y="292" font-size="17" fill="${t.fg}">累计 <tspan class="display" fill="${t.pink}" font-size="22">${total}</tspan> 抽　SSR ${c['rarity:SSR'] ?? 0} · SR ${c['rarity:SR'] ?? 0} · R ${c['rarity:R'] ?? 0}</text>
<text class="ui" x="440" y="324" font-size="14" fill="${t.faint}">出货率 SSR 3% · SR 17% · R 80%</text>
${chips}
${celebrate}
</svg>
`;
}

async function collection(env, theme) {
  const t = THEMES[theme];
  const W = 1200;
  const H = 330;
  const c = await counters(env);
  const owned = CARDS.filter((x) => (c[`gacha:${x.id}`] ?? 0) > 0).length;
  const scale = 0.84;
  const gap = (W - 80 - CARDS.length * CARD_W * scale) / (CARDS.length - 1);
  const cards = CARDS.map((def, i) => {
    const n = c[`gacha:${def.id}`] ?? 0;
    return `<g transform="translate(${r1(40 + i * (CARD_W * scale + gap))} 68) scale(${scale})">${card(def, i, `col${i}`, { locked: n === 0, count: n })}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="图鉴 ${owned}/${CARDS.length}">
<style>${STYLE.cards}${CARD_CSS}${SCENE_CSS}${MASCOT_CSS}</style>
${frame(W, H, t)}
${pill(40, 22, '図鑑', t, t.teal, t.ink, 18)}
<text class="ui" x="${40 + textWidth('図鑑', 18) + 44}" y="44" font-size="17" fill="${t.muted}">全站收集 <tspan class="display" fill="${t.pink}" font-size="20">${owned}/${CARDS.length}</tspan> 张</text>
${cards}
</svg>
`;
}

// ---------- 通信日志 ----------

async function market(ctx) {
  const cache = caches.default;
  const key = new Request('https://signal.elvhack.com/__cache/btc-usd');
  const hit = await cache.match(key);
  if (hit) return hit.json();
  try {
    const res = await fetch('https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600', {
      headers: { 'User-Agent': 'elvhack-signal', Accept: 'application/json' },
      // GitHub 的图片代理等不了太久：行情慢就先不画
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const closes = rows.slice(0, 48).reverse().map((row) => row[4]);
    if (closes.length < 25) return null;
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(closes), { headers: { 'Cache-Control': 'max-age=120' } })));
    return closes;
  } catch {
    return null;
  }
}

const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SIGNAL_COLOR = (t) => ({ ping: t.pink, scan: t.teal, decrypt: t.gold, trace: t.orange });

async function feed(env, ctx, theme) {
  const t = THEMES[theme];
  const W = 1200;
  const H = 420;
  const now = Date.now();
  const time = jst(now);
  const [c, recent, closes] = await Promise.all([
    counters(env),
    env.DB.prepare('SELECT id, ts, action, country FROM signals ORDER BY ts DESC, id DESC LIMIT 6').all(),
    market(ctx),
  ]);
  const rows = recent.results;
  const colors = SIGNAL_COLOR(t);
  const total = SIGNALS.reduce((s, a) => s + (c[a] ?? 0), 0);
  const max = Math.max(1, ...SIGNALS.map((a) => c[a] ?? 0));

  const log = rows.length
    ? rows
        .map((row, i) => {
          const y = 128 + i * 34;
          const d = jst(row.ts);
          return `<g opacity="${r1(1 - i * 0.13)}">
            ${i === 0 ? `<rect x="30" y="${y - 23}" width="700" height="32" rx="8" fill="${t.pink}" opacity="0.14"/>` : ''}
            <text class="mono" x="44" y="${y}" font-size="16" font-weight="700" fill="${t.faint}">${two(d.hour)}:${two(d.minute)}:${two(d.date.getUTCSeconds())}</text>
            <rect x="150" y="${y - 17}" width="98" height="24" rx="12" fill="${colors[row.action]}" stroke="${t.ink}" stroke-width="1.6"/>
            <text class="display" x="199" y="${y}" font-size="14" fill="${t.ink}" text-anchor="middle">${row.action.toUpperCase()}</text>
            <text class="ui" x="270" y="${y}" font-size="16" fill="${t.fg}">来自 ${esc(row.country)}</text>
            <text class="ui" x="716" y="${y}" font-size="15" fill="${t.faint}" text-anchor="end">${ago(now - row.ts)}</text>
          </g>`;
        })
        .join('')
    : `<text class="ui" x="44" y="132" font-size="20" fill="${t.fg}">还没有信号。</text><text class="ui" x="44" y="166" font-size="16" fill="${t.muted}">按下面的按钮发出第一条。</text>`;

  const bars = SIGNALS.map((a, i) => {
    const y = 120 + i * 46;
    const n = c[a] ?? 0;
    return `<text class="display" x="772" y="${y}" font-size="15" fill="${t.fg}">${a.toUpperCase()}</text>
      <text class="mono" x="1160" y="${y}" font-size="15" font-weight="700" fill="${colors[a]}" text-anchor="end">${String(n).padStart(4, '0')}</text>
      <rect x="772" y="${y + 9}" width="388" height="10" rx="5" fill="${t.line}"/>
      <rect x="772" y="${y + 9}" width="${r1(Math.max(n ? 10 : 0, (n / max) * 388))}" height="10" rx="5" fill="${colors[a]}" stroke="${t.ink}" stroke-width="1.4"/>`;
  }).join('');

  // 底部新闻跑马灯：行情 + 全站数据
  let news = `本站好感度 Lv.${affection(c.affection ?? 0).level}　｜　累计抽卡 ${c['gacha:total'] ?? 0} 次　｜　通信合计 ${total} 条　｜　`;
  let spark = '';
  if (closes) {
    const price = closes.at(-1);
    const change = ((price - closes.at(-25)) / closes.at(-25)) * 100;
    news = `BTC/USD ${usd.format(price)}  ${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24H　｜　${news}`;
    const lo = Math.min(...closes);
    const hi = Math.max(...closes);
    const pts = closes.map((v, i) => `${r1(1010 + (i / (closes.length - 1)) * 150)},${r1(398 - ((v - lo) / (hi - lo || 1)) * 30)}`);
    spark = `<rect x="996" y="356" width="178" height="50" fill="${t.ink}"/><polyline points="${pts.join(' ')}" fill="none" stroke="${change >= 0 ? t.teal : t.pink}" stroke-width="2"/>`;
  } else {
    news = `行情离线　｜　${news}`;
  }
  const newsW = textWidth(news, 18);
  const tickerW = spark ? 880 : 1060;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="通信日志：共 ${total} 条">
<style>${STYLE.feed}
  .blink { animation: blink 1.1s steps(1, end) infinite; }
  .ticker { animation: ticker ${r1(newsW / 70)}s linear infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @keyframes ticker { to { transform: translateX(-${r1(newsW)}px); } }
</style>
<defs><clipPath id="f-tick"><rect x="116" y="356" width="${tickerW}" height="50"/></clipPath></defs>
${frame(W, H, t)}
${pill(30, 26, '通信ログ', t, t.pink, t.onPink, 18)}
<circle class="blink" cx="${30 + textWidth('通信ログ', 18) + 52}" cy="42" r="6" fill="#ff3b4e"/>
<text class="mono" x="${30 + textWidth('通信ログ', 18) + 64}" y="47" font-size="14" font-weight="800" fill="#ff3b4e">REC</text>
<text class="ui" x="${W - 40}" y="48" font-size="16" fill="${t.muted}" text-anchor="end">日本时间 ${two(time.hour)}:${two(time.minute)}</text>
<path d="M30 76H${W - 30}" stroke="${t.line}" stroke-width="2"/>
<path d="M748 90V330" stroke="${t.line}" stroke-width="2"/>
${log}
<text class="ui" x="772" y="94" font-size="13" fill="${t.faint}">合计 ${total} 条 · 最后联络 ${rows[0] ? ago(now - rows[0].ts) : '—'}</text>
${bars}
<rect x="18" y="352" width="${W - 36}" height="58" rx="10" fill="${t.ink}"/>
<rect x="26" y="360" width="82" height="42" rx="6" fill="${t.gold}"/>
<text class="logo" x="67" y="389" font-size="18" fill="${t.ink}" text-anchor="middle">NEWS</text>
<g clip-path="url(#f-tick)"><g class="ticker">
  <text class="ui" x="124" y="389" font-size="18" fill="#fff6e6" xml:space="preserve">${esc(news)}${esc(news)}</text>
</g></g>
${spark}
</svg>
`;
}

// ---------- 按钮 ----------

const BUTTON_STYLE = {
  milktea: { w: 380, h: 120, fill: '#ffd6a5' },
  headpat: { w: 380, h: 120, fill: '#ffc8dd' },
  poke: { w: 380, h: 120, fill: '#bde0fe' },
  pull: { w: 560, h: 124, fill: '#ffe066' },
  ping: { w: 290, h: 104, fill: '#ffc8dd' },
  scan: { w: 290, h: 104, fill: '#b9f3ea' },
  decrypt: { w: 290, h: 104, fill: '#ffe066' },
  trace: { w: 290, h: 104, fill: '#ffd6a5' },
};

/** 按钮上的小图标（局部坐标 64×64） */
function icon(action, ink) {
  switch (action) {
    case 'milktea':
      return `<path d="M16 18H48L44 58H20Z" fill="#f4e1c6" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M18 30H46L44 58H20Z" fill="#c89f74"/><path d="M16 18H48L44 58H20Z" fill="none" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
        <rect x="12" y="12" width="40" height="8" rx="3" fill="#fff6e6" stroke="${ink}" stroke-width="3"/>
        <path d="M36 14L44 -2" stroke="#ff5c8a" stroke-width="5" stroke-linecap="round"/>
        <g fill="#3b2a1e">${[[25, 50], [33, 52], [40, 49], [29, 44], [37, 43]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</g>`;
    case 'headpat':
      return `<path d="M8 40C8 24 20 16 32 16C44 16 56 24 56 40Z" fill="#4a2f86" stroke="${ink}" stroke-width="3"/>
        <path d="M16 26Q32 18 48 26" stroke="#8a72dc" stroke-width="3" fill="none"/>
        <path d="M12 40H52V46Q32 56 12 46Z" fill="#ffe3cf" stroke="${ink}" stroke-width="3"/>
        <g class="pat"><path d="M18 18C16 8 22 2 30 4L44 6C52 8 54 16 50 22L46 24C40 24 26 22 20 22Z" fill="#ffe3cf" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M30 6L28 16M38 7L36 17M46 9L43 19" stroke="${ink}" stroke-width="2" stroke-linecap="round"/></g>
        <path class="spark" d="M56 2l2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5z" fill="#ff5c8a" stroke="${ink}" stroke-width="1.4"/>`;
    case 'poke':
      return `<path class="poke" d="M6 44L30 30L34 36L12 50Z" fill="#ffe3cf" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
        <g class="spark"><path d="M44 20L50 8M50 30L62 26M42 34L50 44" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/></g>
        <circle cx="38" cy="28" r="5" fill="#ff5c8a" stroke="${ink}" stroke-width="2.4"/>`;
    case 'pull':
      return `<g class="wobble"><circle cx="32" cy="34" r="24" fill="#ff5c8a" stroke="${ink}" stroke-width="3"/><path d="M8 34A24 24 0 0 0 56 34Z" fill="#fff6e6" stroke="${ink}" stroke-width="3"/>
        <circle cx="32" cy="34" r="7" fill="#ffd23f" stroke="${ink}" stroke-width="3"/><path d="M16 22Q22 14 30 14" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/></g>`;
    case 'ping':
      return `<circle cx="32" cy="34" r="6" fill="#ff5c8a" stroke="${ink}" stroke-width="2.4"/>${[0, 0.6, 1.2].map((d) => `<circle class="wave" style="animation-delay:${d}s" cx="32" cy="34" r="22" fill="none" stroke="${ink}" stroke-width="2.4"/>`).join('')}`;
    case 'scan':
      return `<circle cx="32" cy="34" r="22" fill="#fff6e6" stroke="${ink}" stroke-width="3"/><circle cx="32" cy="34" r="11" fill="none" stroke="${ink}" stroke-width="1.6" opacity="0.4"/>
        <path class="sweep" d="M32 34L54 34" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="26" r="3" fill="#ff5c8a"/>`;
    case 'decrypt':
      return `<circle cx="22" cy="34" r="12" fill="#ffd23f" stroke="${ink}" stroke-width="3"/><circle cx="22" cy="34" r="4" fill="${ink}"/>
        <path d="M34 34H58M48 34V44M56 34V42" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
    default:
      return `<g fill="${ink}"><ellipse class="step1" cx="20" cy="46" rx="6" ry="9" transform="rotate(-15 20 46)"/><ellipse class="step2" cx="42" cy="24" rx="6" ry="9" transform="rotate(-15 42 24)"/></g>`;
  }
}

async function button(env, action, theme) {
  const t = THEMES[theme];
  const b = BUTTONS[action];
  const s = BUTTON_STYLE[action];
  const { w: W, h: H } = s;
  const key = PETS.includes(action) ? `pet:${action}` : action === 'pull' ? 'gacha:total' : action;
  const n = (await env.DB.prepare('SELECT n FROM counters WHERE action = ?').bind(key).first('n')) ?? 0;
  const big = action === 'pull';
  const jaSize = big ? 38 : SIGNALS.includes(action) ? 26 : 30;
  const ink = '#2a1b3d';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(b.ja)} ${esc(b.zh)}：${n}">
<style>${STYLE.button}
  .wave { transform-box: fill-box; transform-origin: center; animation: wave 1.8s ease-out infinite; opacity: 0; }
  .sweep { transform-origin: 32px 34px; animation: sweep 2.4s linear infinite; }
  .spark { transform-box: fill-box; transform-origin: center; animation: spark 1.4s ease-in-out infinite; }
  .pat { animation: pat 1.2s ease-in-out infinite; }
  .poke { animation: poke 1s ease-in-out infinite; }
  .wobble { transform-box: fill-box; transform-origin: 50% 90%; animation: wobble 1.6s ease-in-out infinite; }
  .step1 { animation: step 1.6s steps(1, end) infinite; }
  .step2 { animation: step 1.6s steps(1, end) -0.8s infinite; }
  .shine { animation: shine 3s ease-in-out infinite; }
  @keyframes wave { from { transform: scale(0.2); opacity: 1; } to { transform: scale(1.2); opacity: 0; } }
  @keyframes sweep { to { transform: rotate(360deg); } }
  @keyframes spark { 50% { transform: scale(0.6) rotate(20deg); } }
  @keyframes pat { 50% { transform: translateY(3px); } }
  @keyframes poke { 50% { transform: translate(5px, -3px); } }
  @keyframes wobble { 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); } }
  @keyframes step { 50% { opacity: 0.2; } }
  @keyframes shine { 0%, 60% { transform: translateX(-80px) skewX(-20deg); } 100% { transform: translateX(${W + 80}px) skewX(-20deg); } }
</style>
<defs><clipPath id="b-c"><rect x="4" y="4" width="${W - 14}" height="${H - 14}" rx="22"/></clipPath></defs>
<rect x="10" y="10" width="${W - 14}" height="${H - 14}" rx="22" fill="${ink}"/>
<rect x="4" y="4" width="${W - 14}" height="${H - 14}" rx="22" fill="${s.fill}" stroke="${ink}" stroke-width="4"/>
<g clip-path="url(#b-c)">
  <rect x="4" y="4" width="${W - 14}" height="${(H - 14) * 0.38}" fill="#fff" opacity="0.35"/>
  <rect class="shine" x="0" y="0" width="34" height="${H}" fill="#fff" opacity="0.45"/>
</g>
<g transform="translate(${big ? 26 : 18} ${(H - 14) / 2 - 30}) scale(${big ? 1.05 : 0.94})">${icon(action, ink)}</g>
<text class="logo" x="${big ? 104 : 90}" y="${(H - 14) / 2 + (big ? 6 : 4)}" font-size="${jaSize}" fill="${ink}">${esc(b.ja)}</text>
<text class="logo" x="${big ? 106 : 92}" y="${(H - 14) / 2 + (big ? 32 : 28)}" font-size="${big ? 16 : 14}" fill="${ink}" opacity="0.7">${esc(b.zh)}　${esc(b.note)}</text>
<text class="mono" x="${W - 30}" y="${big ? 40 : 34}" font-size="${big ? 15 : 13}" font-weight="800" fill="${ink}" text-anchor="end" opacity="0.8">x${String(n).padStart(4, '0')}</text>
</svg>
`;
}
