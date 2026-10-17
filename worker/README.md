# signal.elvhack.com

GitHub 主页 SIGNAL DECK 背后的 Cloudflare Worker：访客点按钮 → 记一条信号 → 跳回主页；
`feed.svg` 和 `button/*.svg` 每次请求实时生成（带 no-cache，GitHub 的 camo 代理每次都会重新取）。

数据在 D1 里，只存动作、时间、国家/地区代码，以及按天轮换、加盐的访客哈希（只用于限流：同一访客 10 分钟最多 5 条）。
只有浏览器里真正点出来的跳转（`Sec-Fetch-Mode: navigate`）才计数。

```bash
npx wrangler@4.146.0 d1 create elvhack-signal          # 把输出的 database_id 填进 wrangler.jsonc
npx wrangler@4.146.0 d1 execute elvhack-signal --remote --file=schema.sql
npx wrangler@4.146.0 secret put SALT                    # 任意随机字符串
npx wrangler@4.146.0 deploy
```

本地调试：`npx wrangler@4.146.0 d1 execute elvhack-signal --local --file=schema.sql`，然后 `npx wrangler@4.146.0 dev --local`。
