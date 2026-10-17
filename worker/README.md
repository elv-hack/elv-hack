# signal.elvhack.com

GitHub 主页上三个会变的画面：玫瑰曲线碎片、线框迷宫、生成艺术标本，以及它们的按钮，都由这个 Cloudflare Worker 按请求生成 SVG。
访客点按钮 → 经过这里记一笔 → 302 回到主页对应的位置；图片都带 no-cache，GitHub 的 camo 代理每次都会重新取。

| 路径 | 作用 |
|:--|:--|
| `/rose/place` | 放上一段碎片；拼满一朵，下一朵换一个 k |
| `/dive/left` `/dive/forward` `/dive/right` `/dive/back` | 在共享的迷宫里移动，到达 core 算一次 |
| `/draw/pull` | 抽一件生成艺术（SSR 4% · SR 22% · R 74%） |
| `/rose.svg` `/dive.svg` `/draw.svg` `/button/:id.svg` | 图片 |

只存动作、时间、国家/地区代码，以及按天轮换、加盐的访客哈希（只用于限流）；不存 IP。
只有浏览器里真正点出来的跳转（`Sec-Fetch-Mode: navigate`）才计数。

```bash
npx wrangler@4.146.0 d1 execute elvhack-signal --remote --file=schema.sql   # 建表（可重复执行）
npx wrangler@4.146.0 deploy
```

本地调试：`d1 execute ... --local --file=schema.sql`，然后 `npx wrangler@4.146.0 dev --local`。
