/**
 * GitHub 主页背后的小服务（signal.elvhack.com）：所有访客共享的互动画面。
 *
 *   GET /face/:id             片头先浮现哪一张肖像（ghost / crimson / phantom）
 *   GET /rose/place           放上一段玫瑰曲线碎片，然后回到主页
 *   GET /dive/:move           在迷宫里 left / forward / right / back
 *   GET /draw/pull            抽一件生成艺术
 *   GET /header.svg  /rose.svg  /dive.svg  /draw.svg  /button/:id.svg
 *
 * README 里的图片经 GitHub 的 camo 代理加载，每个 SVG 都带 no-cache，访客回到主页时能看到刚才的结果。
 * camo 是 GitHub 的服务器在取图，分不出是谁在看，所以画面都是全站共享的。
 * 不存 IP：只存按天轮换、加盐的哈希，用来限流；只有浏览器里真正点出来的跳转才计数。
 */
import grotesk from '../../scripts/fonts/space-grotesk.woff2';
import mono from '../../scripts/fonts/jetbrains-mono.woff2';
import FACE_DATA from '../../scripts/faces.json';
import { cell, start, step } from '../../scripts/dive.mjs';
import { FACES } from '../../scripts/face.mjs';
import { baseStyle } from '../../scripts/lib.mjs';
import { RATES, buttonPanel, divePanel, drawPanel, headerPanel, rosePanel } from '../../scripts/pieces.mjs';

const PROFILE = 'https://github.com/elv-hack';
const MOVES = ['left', 'forward', 'right', 'back'];
const LIMITS = { face: 20, rose: 12, dive: 40, draw: 10 };
const WINDOW_MS = 10 * 60_000;
const KEEP_ROWS = 500;

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const FONTS = baseStyle({ grotesk: toBase64(grotesk), mono: toBase64(mono) });

const BUTTONS = {
  ...Object.fromEntries(
    FACES.map((f, i) => [f.id, { glyph: f.id, label: `${f.numeral} — ${f.name}`, sub: 'bring it to the surface', counter: `face:${f.id}`, w: 380, face: i, accent: f.accent }]),
  ),
  place: { glyph: 'place', label: 'place a fragment', sub: 'the rose grows', counter: 'rose:placed', w: 380 },
  left: { glyph: 'left', label: 'turn left', sub: 'dive', w: 280 },
  forward: { glyph: 'forward', label: 'forward', sub: 'one cell', counter: 'dive:steps', w: 280 },
  right: { glyph: 'right', label: 'turn right', sub: 'dive', w: 280 },
  back: { glyph: 'back', label: 'turn around', sub: 'dive', w: 280 },
  draw: { glyph: 'draw', label: 'draw a specimen', sub: 'SSR 4%', counter: 'draw:total', w: 380 },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    let m;
    if ((m = path.match(/^\/face\/([a-z]+)$/)) && FACES.some((f) => f.id === m[1])) {
      await guard(() => pickFace(request, env, m[1]));
      return Response.redirect(`${PROFILE}#face`, 302);
    }
    if (path === '/rose/place') {
      await guard(() => placeFragment(request, env));
      return Response.redirect(`${PROFILE}#rose`, 302);
    }
    if ((m = path.match(/^\/dive\/([a-z]+)$/)) && MOVES.includes(m[1])) {
      await guard(() => move(request, env, m[1]));
      return Response.redirect(`${PROFILE}#dive`, 302);
    }
    if (path === '/draw/pull') {
      await guard(() => pull(request, env));
      return Response.redirect(`${PROFILE}#draw`, 302);
    }
    if (path === '/header.svg') return svg(await headerImage(env));
    if (path === '/rose.svg') return svg(await roseImage(env));
    if (path === '/dive.svg') return svg(await diveImage(env));
    if (path === '/draw.svg') return svg(await drawImage(env));
    if ((m = path.match(/^\/button\/([a-z]+)\.svg$/)) && BUTTONS[m[1]]) return svg(await buttonImage(env, m[1]));
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

// ---------- 存取 ----------

/** 访客身份（按天轮换的加盐哈希）；不是真正点出来的跳转、或者超过限流，返回 null */
async function visitor(request, env, kind) {
  if (request.headers.get('sec-fetch-mode') !== 'navigate') return null;
  const day = new Date().toISOString().slice(0, 10);
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.SALT ?? 'elvhack'}|${day}|${request.headers.get('cf-connecting-ip') ?? ''}`));
  const who = [...new Uint8Array(data).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const country = /^[A-Z]{2}$/.test(request.cf?.country ?? '') ? request.cf.country : 'XX';
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM actions WHERE who = ? AND kind = ? AND ts > ?')
    .bind(who, kind, Date.now() - WINDOW_MS)
    .first('n');
  return n >= LIMITS[kind] ? null : { who, country };
}

const bump = (env, key, by = 1) =>
  env.DB.prepare('INSERT INTO counters (action, n) VALUES (?, ?) ON CONFLICT (action) DO UPDATE SET n = n + ?').bind(key, by, by);
const set = (env, key, value) =>
  env.DB.prepare('INSERT INTO counters (action, n) VALUES (?, ?) ON CONFLICT (action) DO UPDATE SET n = excluded.n').bind(key, value);
const log = (env, kind, item, extra, v) =>
  env.DB.prepare('INSERT INTO actions (ts, kind, item, extra, country, who) VALUES (?, ?, ?, ?, ?, ?)').bind(Date.now(), kind, item, extra, v.country, v.who);
const prune = (env) => env.DB.prepare(`DELETE FROM actions WHERE id <= (SELECT id FROM actions ORDER BY id DESC LIMIT 1 OFFSET ${KEEP_ROWS})`);

async function counters(env, keys) {
  const { results } = await env.DB.prepare(`SELECT action, n FROM counters WHERE action IN (${keys.map(() => '?').join(',')})`).bind(...keys).all();
  return Object.fromEntries(results.map((r) => [r.action, r.n]));
}
const lastAction = (env, kind) =>
  env.DB.prepare('SELECT ts, item, extra, country FROM actions WHERE kind = ? ORDER BY ts DESC, id DESC LIMIT 1').bind(kind).first();

const currentFace = async (env) => (await env.DB.prepare("SELECT n FROM counters WHERE action = 'face:current'").first('n')) ?? 0;

async function pickFace(request, env, id) {
  const v = await visitor(request, env, 'face');
  if (!v) return;
  await env.DB.batch([log(env, 'face', id, '', v), set(env, 'face:current', FACES.findIndex((f) => f.id === id)), bump(env, `face:${id}`), prune(env)]);
}

async function placeFragment(request, env) {
  const v = await visitor(request, env, 'rose');
  if (!v) return;
  await env.DB.batch([log(env, 'rose', 'place', '', v), bump(env, 'rose:placed'), prune(env)]);
}

async function diveState(env) {
  const c = await counters(env, ['dive:x', 'dive:y', 'dive:dir', 'dive:steps', 'dive:breaches']);
  return {
    state: c['dive:x'] != null ? { x: c['dive:x'], y: c['dive:y'], dir: c['dive:dir'] } : start(),
    steps: c['dive:steps'] ?? 0,
    breaches: c['dive:breaches'] ?? 0,
  };
}

async function move(request, env, action) {
  const v = await visitor(request, env, 'dive');
  if (!v) return;
  const { state } = await diveState(env);
  let next;
  let reached = false;
  if (cell(state.x, state.y) === 'C') {
    next = start(); // 到过核心以后，下一步回到入口
  } else {
    next = step(state, action);
    reached = cell(next.x, next.y) === 'C' && !next.blocked;
  }
  const moved = action === 'forward' && !next.blocked;
  await env.DB.batch([
    log(env, 'dive', next.blocked ? 'blocked' : action, '', v),
    set(env, 'dive:x', next.x),
    set(env, 'dive:y', next.y),
    set(env, 'dive:dir', next.dir),
    ...(moved ? [bump(env, 'dive:steps')] : []),
    ...(reached ? [bump(env, 'dive:breaches')] : []),
    prune(env),
  ]);
}

function rarity() {
  const x = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  return x < RATES.SSR ? 'SSR' : x < RATES.SSR + RATES.SR ? 'SR' : 'R';
}

async function pull(request, env) {
  const v = await visitor(request, env, 'draw');
  if (!v) return;
  const no = ((await env.DB.prepare("SELECT n FROM counters WHERE action = 'draw:total'").first('n')) ?? 0) + 1;
  const r = rarity();
  await env.DB.batch([log(env, 'draw', String(no), r, v), set(env, 'draw:total', no), bump(env, `draw:${r}`), prune(env)]);
}

// ---------- 画面 ----------

/** 片头：从访客最后选的那张开始轮播 */
async function headerImage(env) {
  const first = await currentFace(env);
  const order = FACES.map((_, i) => (first + i) % FACES.length);
  return headerPanel({ faces: FACE_DATA.portraits, order, fonts: FONTS });
}

async function roseImage(env) {
  const [c, last] = await Promise.all([counters(env, ['rose:placed']), lastAction(env, 'rose')]);
  return rosePanel({ placed: c['rose:placed'] ?? 0, last, fonts: FONTS });
}

async function diveImage(env) {
  const [{ state, steps, breaches }, last] = await Promise.all([diveState(env), lastAction(env, 'dive')]);
  return divePanel({ state, last, steps, breaches, fonts: FONTS });
}

async function drawImage(env) {
  const [c, recent] = await Promise.all([
    counters(env, ['draw:total', 'draw:SSR', 'draw:SR', 'draw:R']),
    env.DB.prepare("SELECT ts, item, extra, country FROM actions WHERE kind = 'draw' ORDER BY ts DESC, id DESC LIMIT 9").all(),
  ]);
  const rows = recent.results.map((r) => ({ no: Number(r.item), rarity: r.extra, country: r.country, ts: r.ts }));
  return drawPanel({
    total: c['draw:total'] ?? 0,
    latest: rows[0],
    history: rows.slice(1),
    counts: { SSR: c['draw:SSR'] ?? 0, SR: c['draw:SR'] ?? 0 },
    fonts: FONTS,
  });
}

async function buttonImage(env, id) {
  const b = BUTTONS[id];
  const [count, face] = await Promise.all([
    b.counter ? env.DB.prepare('SELECT n FROM counters WHERE action = ?').bind(b.counter).first('n').then((n) => n ?? 0) : null,
    b.face != null ? currentFace(env) : null,
  ]);
  const active = b.face != null && face === b.face;
  return buttonPanel({ glyph: b.glyph, label: b.label, sub: active ? 'on the surface now' : b.sub, count, w: b.w, accent: b.accent, active, fonts: FONTS });
}
