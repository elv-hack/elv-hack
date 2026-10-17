/**
 * GitHub 主页上的信号台（signal.elvhack.com）。
 *
 *   GET /deck/:action        记一条信号（ping / scan / decrypt / trace），然后跳回 GitHub 主页
 *   GET /feed.svg?theme=     实时日志 + 计数 + BTC 行情
 *   GET /button/:action.svg  按钮，带当前计数
 *
 * README 里的图片经 GitHub 的 camo 代理加载，所以每个 SVG 都带 no-cache，访客回到主页时能看到自己刚发的信号。
 * 不存 IP：只存按天轮换、加盐的哈希，用来限制同一访客 10 分钟内最多 5 条。
 */
import grotesk from '../../scripts/fonts/space-grotesk.woff2';
import mono from '../../scripts/fonts/jetbrains-mono.woff2';
import { THEMES, baseStyle, esc, hashStr, r1 } from '../../scripts/lib.mjs';

const ACTIONS = ['ping', 'scan', 'decrypt', 'trace'];
const PROFILE = 'https://github.com/elv-hack#signal-deck';
const LIMIT = { count: 5, windowMs: 10 * 60_000 };
const KEEP_ROWS = 500;

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const BASE = baseStyle({ mono: toBase64(mono), grotesk: toBase64(grotesk) });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const theme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';

    const deck = url.pathname.match(/^\/deck\/([a-z]+)\/?$/);
    if (deck && ACTIONS.includes(deck[1])) {
      await record(request, env, deck[1]).catch((error) => console.error('record', error));
      return Response.redirect(PROFILE, 302);
    }
    if (url.pathname === '/feed.svg') return svg(await feed(env, ctx, theme));
    const button = url.pathname.match(/^\/button\/([a-z]+)\.svg$/);
    if (button && ACTIONS.includes(button[1])) return svg(await buttonSvg(env, button[1], theme));
    if (url.pathname === '/') return Response.redirect(PROFILE, 302);
    return new Response('not found', { status: 404 });
  },
};

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

async function digest(text) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(data).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function record(request, env, action) {
  // 只算浏览器里真正点出来的跳转，预取、爬虫和脚本请求都不算
  if (request.headers.get('sec-fetch-mode') !== 'navigate') return;
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const who = await digest(`${env.SALT ?? 'elvhack'}|${day}|${request.headers.get('cf-connecting-ip') ?? ''}`);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM signals WHERE who = ? AND ts > ?')
    .bind(who, now - LIMIT.windowMs)
    .first('n');
  if (recent >= LIMIT.count) return;
  const country = /^[A-Z]{2}$/.test(request.cf?.country ?? '') ? request.cf.country : 'XX';
  await env.DB.batch([
    env.DB.prepare('INSERT INTO signals (ts, action, country, who) VALUES (?, ?, ?, ?)').bind(now, action, country, who),
    env.DB.prepare('INSERT INTO counters (action, n) VALUES (?, 1) ON CONFLICT (action) DO UPDATE SET n = n + 1').bind(action),
    env.DB.prepare(`DELETE FROM signals WHERE id <= (SELECT id FROM signals ORDER BY id DESC LIMIT 1 OFFSET ${KEEP_ROWS})`),
  ]);
}

async function state(env, limit = 7) {
  const [counters, recent] = await env.DB.batch([
    env.DB.prepare('SELECT action, n FROM counters'),
    env.DB.prepare('SELECT id, ts, action, country FROM signals ORDER BY ts DESC, id DESC LIMIT ?').bind(limit),
  ]);
  const counts = Object.fromEntries(ACTIONS.map((a) => [a, 0]));
  for (const row of counters.results) counts[row.action] = row.n;
  return { counts, recent: recent.results };
}

// ---------- 行情 ----------

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
    // 每行 [time, low, high, open, close, volume]，新的在前；取最近 48 小时的收盘价
    const closes = rows.slice(0, 48).reverse().map((row) => row[4]);
    if (closes.length < 25) return null;
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(closes), { headers: { 'Cache-Control': 'max-age=120' } })));
    return closes;
  } catch {
    return null;
  }
}

// ---------- 渲染 ----------

const two = (n) => String(n).padStart(2, '0');
const clock = (ts) => {
  const d = new Date(ts);
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}Z`;
};
function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}S AGO`;
  if (s < 3600) return `${Math.floor(s / 60)}M AGO`;
  if (s < 86400) return `${Math.floor(s / 3600)}H AGO`;
  return `${Math.floor(s / 86400)}D AGO`;
}
const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function feed(env, ctx, theme) {
  const t = THEMES[theme];
  const W = 1200;
  const H = 420;
  const now = Date.now();
  const [{ counts, recent }, closes] = await Promise.all([state(env), market(ctx)]);
  const total = ACTIONS.reduce((s, a) => s + counts[a], 0);
  const max = Math.max(1, ...ACTIONS.map((a) => counts[a]));
  const d = new Date(now);
  const stamp = `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())} ${clock(now)}`;

  const fades = [1, 0.82, 0.68, 0.56, 0.46, 0.38, 0.3];
  const log = recent.length
    ? recent
        .map((row, i) => {
          const y = 112 + i * 30;
          const first = i === 0;
          const sig = (hashStr(`sig-${row.id}`) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
          return `<g opacity="${fades[i]}"${first ? ' class="incoming"' : ''}>
            ${first ? `<rect x="24" y="${y - 21}" width="728" height="30" fill="${t.accent}" opacity="0.1"/>` : ''}
            <text x="32" y="${y}" fill="${t.faint}">${first ? '&gt;' : ' '} ${clock(row.ts)}</text>
            <text x="200" y="${y}" fill="${first ? t.accent : t.fg}" font-weight="700">${esc(row.action.toUpperCase())}</text>
            <text x="340" y="${y}" fill="${t.muted}">ORIGIN ${esc(row.country)}</text>
            <text x="500" y="${y}" fill="${t.faint}">SIG 0x${sig}</text>
            <text x="740" y="${y}" fill="${t.faint}" text-anchor="end">${ago(now - row.ts)}</text>
          </g>`;
        })
        .join('')
    : `<text x="32" y="112" fill="${t.muted}">&gt; NO SIGNALS INTERCEPTED YET.</text>
       <text x="32" y="142" fill="${t.faint}">  PRESS A BUTTON BELOW TO TRANSMIT THE FIRST ONE.</text>`;
  const cursorY = recent.length ? 112 + Math.min(recent.length, 7) * 30 : 172;

  const bars = ACTIONS.map((a, i) => {
    const y = 104 + i * 42;
    const w = r1((counts[a] / max) * 344);
    return `<text x="808" y="${y}" fill="${t.fg}" letter-spacing="2">${a.toUpperCase()}</text>
      <text x="1168" y="${y}" fill="${t.accent}" text-anchor="end">${String(counts[a]).padStart(4, '0')}</text>
      <rect x="808" y="${y + 9}" width="360" height="4" fill="${t.line}"/>
      <rect x="808" y="${y + 9}" width="${w}" height="4" fill="${counts[a] === max && counts[a] > 0 ? t.accent : t.muted}"/>`;
  }).join('');
  const last = recent[0] ? ago(now - recent[0].ts) : '—';

  let tape;
  if (closes) {
    const lo = Math.min(...closes);
    const hi = Math.max(...closes);
    const x0 = 420;
    const x1 = 1168;
    const pts = closes.map((c, i) => `${r1(x0 + (i / (closes.length - 1)) * (x1 - x0))},${r1(396 - ((c - lo) / (hi - lo || 1)) * 52)}`);
    const price = closes.at(-1);
    const change = ((price - closes.at(-25)) / closes.at(-25)) * 100;
    const up = change >= 0;
    const color = up ? t.accent : t.alt;
    const [lx, ly] = pts.at(-1).split(',');
    tape = `<text x="32" y="356" fill="${t.faint}" font-size="11" letter-spacing="2">QUANT FEED // BTC-USD // 1H x 48</text>
      <text class="display" x="32" y="394" font-size="30" fill="${t.fg}">${usd.format(price)}</text>
      <text x="${32 + usd.format(price).length * 17.5 + 14}" y="392" font-size="16" fill="${color}">${up ? '+' : ''}${change.toFixed(2)}% 24H</text>
      <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>
      <circle class="blink" cx="${lx}" cy="${ly}" r="3.5" fill="${color}"/>`;
  } else {
    tape = `<text x="32" y="356" fill="${t.faint}" font-size="11" letter-spacing="2">QUANT FEED // BTC-USD</text>
      <text x="32" y="392" fill="${t.faint}" font-size="16">MARKET FEED OFFLINE</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="信号台：共 ${total} 条信号">
<style>${BASE}
  .blink { animation: blink 1.1s steps(1, end) infinite; }
  .incoming { animation: incoming 0.9s steps(6, end) both; }
  @keyframes blink { 50% { opacity: 0; } }
  @keyframes incoming { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
</style>
<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${t.fg}" opacity="0.04"/></pattern></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="${t.bg}" stroke="${t.strong}"/>
<g class="mono" font-size="15">
  <rect x="24" y="17" width="10" height="10" fill="${t.accent}"/>
  <text x="44" y="27" letter-spacing="2" fill="${t.fg}">LIVE // SIGNAL DECK</text>
  <circle class="blink" cx="276" cy="22" r="5" fill="${t.alt}"/>
  <text x="288" y="27" font-size="12" letter-spacing="2" fill="${t.alt}">REC</text>
  <text x="${W - 24}" y="27" font-size="12" letter-spacing="1" fill="${t.faint}" text-anchor="end">UTC ${stamp}</text>
</g>
<path d="M0 44H${W}" stroke="${t.strong}"/>
<path d="M780 44V322" stroke="${t.line}"/>
<g class="mono" font-size="15" xml:space="preserve">
  <text x="32" y="72" font-size="11" letter-spacing="2" fill="${t.faint}">INTERCEPT LOG</text>
  ${log}
  <rect class="blink" x="32" y="${cursorY - 15}" width="10" height="18" fill="${t.accent}"/>
</g>
<g class="mono" font-size="14">
  <text x="808" y="72" font-size="11" letter-spacing="2" fill="${t.faint}">SIGNAL COUNT</text>
  ${bars}
  <text x="808" y="290" font-size="11" letter-spacing="2" fill="${t.faint}">TOTAL</text>
  <text class="display" x="808" y="314" font-size="22" fill="${t.fg}">${String(total).padStart(4, '0')}</text>
  <text x="1168" y="290" font-size="11" letter-spacing="2" fill="${t.faint}" text-anchor="end">LAST CONTACT</text>
  <text x="1168" y="312" font-size="14" fill="${t.muted}" text-anchor="end">${last}</text>
</g>
<path d="M0 322H${W}" stroke="${t.strong}"/>
<g class="mono">${tape}</g>
<rect width="${W}" height="${H}" fill="url(#scan)"/>
</svg>
`;
}

const LABELS = { ping: 'SEND A PING', scan: 'RUN A SCAN', decrypt: 'TRY DECRYPT', trace: 'LEAVE A TRACE' };

/** 每个按钮一个会动的小图标 */
function icon(action, t) {
  const cx = 44;
  const cy = 48;
  switch (action) {
    case 'ping':
      return `<circle cx="${cx}" cy="${cy}" r="4" fill="${t.accent}"/>
        ${[0, 0.6, 1.2].map((d) => `<circle class="wave" style="animation-delay:${d}s" cx="${cx}" cy="${cy}" r="18" fill="none" stroke="${t.accent}" stroke-width="1.5"/>`).join('')}`;
    case 'scan':
      return `<circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="${t.strong}"/>
        <circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${t.line}"/>
        <path class="sweep" d="M${cx} ${cy}L${cx + 20} ${cy}" stroke="${t.accent}" stroke-width="2"/>
        <circle class="blink" cx="${cx - 9}" cy="${cy - 8}" r="2.5" fill="${t.alt}"/>`;
    case 'decrypt':
      return `<path class="shackle" d="M${cx - 9} ${cy - 2}V${cy - 10}a9 9 0 0 1 18 0V${cy - 2}" fill="none" stroke="${t.accent}" stroke-width="2.2"/>
        <rect x="${cx - 14}" y="${cy - 2}" width="28" height="22" fill="none" stroke="${t.accent}" stroke-width="2"/>
        <rect class="blink" x="${cx - 2}" y="${cy + 5}" width="4" height="8" fill="${t.accent}"/>`;
    default:
      return `<path class="route" pathLength="1" d="M${cx - 20} ${cy + 14}L${cx - 6} ${cy - 4}L${cx + 4} ${cy + 8}L${cx + 20} ${cy - 14}" fill="none" stroke="${t.accent}" stroke-width="2"/>
        ${[[cx - 20, cy + 14], [cx - 6, cy - 4], [cx + 4, cy + 8], [cx + 20, cy - 14]].map(([x, y]) => `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" fill="${t.bg}" stroke="${t.accent}" stroke-width="1.5"/>`).join('')}`;
  }
}

async function buttonSvg(env, action, theme) {
  const t = THEMES[theme];
  const W = 290;
  const H = 96;
  const n = (await env.DB.prepare('SELECT n FROM counters WHERE action = ?').bind(action).first('n')) ?? 0;
  const L = 12;
  const corners = [
    [0, 0, 1, 1],
    [W, 0, -1, 1],
    [0, H, 1, -1],
    [W, H, -1, -1],
  ]
    .map(([x, y, dx, dy]) => `<path d="M${x + dx * 1.5} ${y + dy * L}V${y + dy * 1.5}H${x + dx * L}" fill="none" stroke="${t.accent}" stroke-width="3"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${action}：${n}">
<style>${BASE}
  .blink { animation: blink 1.1s steps(1, end) infinite; }
  .wave { transform-box: fill-box; transform-origin: center; animation: wave 1.8s ease-out infinite; opacity: 0; }
  .sweep { transform-origin: 44px 48px; animation: sweep 2.4s linear infinite; }
  .shackle { animation: shackle 2.6s ease-in-out infinite; }
  .route { stroke-dasharray: 1; animation: route 2.2s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @keyframes wave { from { transform: scale(0.2); opacity: 1; } to { transform: scale(1.3); opacity: 0; } }
  @keyframes sweep { to { transform: rotate(-360deg); } }
  @keyframes shackle { 0%, 40%, 100% { transform: none; } 55%, 85% { transform: translateY(-6px); } }
  @keyframes route { 0% { stroke-dashoffset: 1; } 60%, 100% { stroke-dashoffset: 0; } }
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="${t.bg}" stroke="${t.strong}"/>
${corners}
${icon(action, t)}
<text class="display" x="86" y="50" font-size="26" letter-spacing="0.5" fill="${t.fg}">${action.toUpperCase()}</text>
<text class="mono" x="88" y="74" font-size="12" letter-spacing="2" fill="${t.faint}">${LABELS[action]}</text>
<text class="mono" x="${W - 18}" y="30" font-size="11" letter-spacing="2" fill="${t.faint}" text-anchor="end">HITS</text>
<text class="mono" x="${W - 18}" y="52" font-size="15" fill="${t.accent}" text-anchor="end">${String(n).padStart(4, '0')}</text>
</svg>
`;
}
