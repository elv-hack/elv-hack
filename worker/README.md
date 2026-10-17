# signal.elvhack.com

GitHub 主页上会动、会变的部分：看板娘エルヴ、抽卡、图鉴、通信日志和所有按钮，都由这个 Cloudflare Worker 按请求生成 SVG。
访客点按钮 → 经过这里记一笔 → 302 回到主页对应的位置；图片都带 no-cache，GitHub 的 camo 代理每次都会重新取，所以回到主页就能看到结果。

| 路径 | 作用 |
|:--|:--|
| `/pet/milktea` `/pet/headpat` `/pet/poke` | 投喂奶茶 / 摸头 / 戳，全站好感度 +3 / +2 / +1 |
| `/gacha/pull` | 单抽（SSR 3% · SR 17% · R 80%） |
| `/deck/ping` 等 | 通信日志里的四种信号 |
| `/stage.svg` `/gacha.svg` `/collection.svg` `/feed.svg` `/button/:action.svg` | 图片，`?theme=light` 是亮色 |

只存动作、时间、国家/地区代码，以及按天轮换、加盐的访客哈希（只用于限流）；不存 IP。
只有浏览器里真正点出来的跳转（`Sec-Fetch-Mode: navigate`）才计数。

```bash
npx wrangler@4.146.0 d1 execute elvhack-signal --remote --file=schema.sql   # 建表（可重复执行）
npx wrangler@4.146.0 deploy
```

首次部署还需要 `d1 create elvhack-signal`（把 id 填进 wrangler.jsonc）和 `secret put SALT`。
本地调试：`d1 execute ... --local --file=schema.sql`，然后 `npx wrangler@4.146.0 dev --local`。
