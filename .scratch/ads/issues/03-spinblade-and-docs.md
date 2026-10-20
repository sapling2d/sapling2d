# 03 — spinblade 的 Result 画面接广告；文档

**What to build:** 用一个仓库内的游戏把三种广告的用法走一遍，并写进 `llms.txt` / `CONTEXT.md`。规格见 `../spec.md`"验证载体"一节。

- `examples/spinblade`：`gameOptions.plugins` 加 `ads()`（不配 id：浏览器和无头是 mock；小游戏构建时通过 `import.meta.env.VITE_AD_*` 读 id，没有就还是 mock）。`Result` 画面：
  - 失败：按钮"看视频复活"（`ready.rewarded` 为 false 时不显示）→ `showRewarded()` → `'rewarded'` 重开本关并带奖励（实现者读 `Arena` 后选最小改动，比如起步多带几把刀；`'skipped'` / `'unavailable'` 提示一句，留在结果页）。
  - 通关：按钮"看视频双倍"→ `'rewarded'` 分数翻倍显示。
  - 进入 Result 时 `showInterstitial()` 一次（结果不影响流程）。
  - 底部 `banner.show()`，`banner.resized` 时把下方的按钮往上挪 `banner.height`；离开 Result 时 `banner.hide()`。
  - 测试：`test/flow.test.ts` 加 mock 下的两条路（复活 / 双倍）和"不可用时按钮不显示"。
- `docs/examples/ads.test.ts`：llms 示例（`plugins: [ads()]`，复活按钮，`mock: 'rewarded'` 的测试）。
- `packages/engine/docs/llms.template.md`：入口表加 `sapling2d/ads`；新小节 **广告（小游戏流量主）**（引用示例；三态；`pauseGame`；mock 规则；banner 布局；错误码）；"插件"一节的现有插件加 `ads()`；"微信小游戏"一节加一条（广告位 id 来自流量主，模拟器显示模拟广告，真机才是真的）；"常见陷阱"加"奖励只认 `'rewarded'`"和"没配 id 是 mock，上线前检查日志里的 info"。重新生成 `llms.txt`。
- `CONTEXT.md`：新词条 **Ads**；Entry points 加 `sapling2d/ads`；Plugin 词条的例子里加广告。
- 三个 README 的入口表加 `sapling2d/ads`。`templates/game/AGENTS.md` 的插件那条提一句广告。

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] spinblade `pnpm check` 绿，浏览器里失败 → 点"看视频复活"→ 弹 mock → 点"看完"→ 回到 Arena（截图记在评论里）
- [ ] 小游戏构建通过（`build:wechat`），不配 id 时模拟器里是 mock 覆盖层
- [ ] `llms.txt` 过期检查通过，新小节和示例在
- [ ] `CONTEXT.md`、README、模板跟上
- [ ] 全 workspace `pnpm check` 绿
