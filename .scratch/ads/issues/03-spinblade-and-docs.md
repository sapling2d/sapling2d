# 03 — spinblade 的 Result 画面接广告；文档

**What to build:** 用一个仓库内的游戏把三种广告的用法走一遍，并写进 `llms.txt` / `CONTEXT.md`。规格见 `../spec.md`"验证载体"一节。

- `examples/spinblade`：`gameOptions.plugins` 加 `ads()`（不配 id：浏览器和无头是 mock；小游戏构建时通过 `import.meta.env.VITE_AD_*` 读 id，没有就还是 mock）。`Result` 画面：
  - 失败：按钮"看视频复活"（`ready.rewarded` 为 false 时不显示）→ `showRewarded()` → `'rewarded'` 重开本关并带奖励；`'skipped'` / `'unavailable'` 提示一句，留在结果页。
  - 通关：同一个按钮（"看视频 · 多带 4 把刀"）——这个游戏没有分数，"双倍"改成下一局多带刀。
  - 进入 Result 时 `showInterstitial()` 一次（结果不影响流程）。
  - 底部 `banner.show()`，`banner.resized` 时把按钮往上让；离开 Result 时 `banner.hide()`。
  - 测试：`test/ads-flow.test.ts`：mock 下的 rewarded / skipped / unavailable 三条路。
- `docs/examples/ads.test.ts`：llms 示例。
- `packages/engine/docs/llms.template.md`：入口表、新小节 **广告（小游戏流量主）**、"插件"一节的现有插件、"微信小游戏"一节、"常见陷阱"。重新生成 `llms.txt`。
- `CONTEXT.md`：新词条 **Ads**；Entry points；Plugin 词条补 `preload` / `autoload`。
- 三个 README 的入口表；`templates/game/AGENTS.md`；spinblade 的 AGENTS.md。

**Blocked by:** 01, 02

**Status:** done（2026-10-20；浏览器截图留到 04 和模拟器一起看）

- [x] spinblade `pnpm check` 绿（36 个用例，+3）：看完 → 回到 Arena、刀数 = 起始 + 4、banner 隐藏、树没留在暂停态；中途关了 → 留在结果页并提示；没广告 → 不显示按钮、点屏幕照常再来一局
- [ ] 浏览器里失败 → 点"看视频 · 多带 4 把刀"→ 弹 mock → 点"看完"→ 回到 Arena（截图）→ 04 和模拟器一起看
- [x] 小游戏构建通过（`build:wechat`），不配 id 时模拟器里是 mock 覆盖层（流程由 04 在模拟器里确认）
- [x] `llms.txt` 过期检查通过，新小节和示例在
- [x] `CONTEXT.md`、README、模板、spinblade AGENTS.md 跟上
- [x] 全 workspace `pnpm check` 绿（engine 505）

## Comments

**实现（2026-10-20）：**

- **奖励没用 Arena 的构造参数**：`Result` 在 `await changeScene(Arena)` 拿到新场景后直接 `arena.giveKnives(arena.player, 4)`——零改动 Arena。
- **测试默认当作没广告**：`game.ts` 里 `mock: import.meta.env.MODE === 'test' ? 'unavailable' : 'ui'`，否则进入 Result 的插屏 mock 会挡住原有流程测试的"点屏幕再来一局"；要测广告的用例自己传 `plugins: [touch(), ads({ mock: 'rewarded' })]`（覆盖 `plugins` 时记得带上 `touch()`）。浏览器 `pnpm dev` 仍然是 `'ui'`，能看能点。
- 广告位 id 走 `VITE_AD_REWARDED` / `VITE_AD_INTERSTITIAL` / `VITE_AD_BANNER`，`vite/client` 的类型下要 `as string | undefined`。
- 广告按钮是 `inputPickable` 的 `ColorRect`：按在它上面的手指不触发 `pointerPress()`，所以不会同时触发 `confirm` 重开。
- `Result.exitTree()` 里 `banner.hide()`：切场景时 `exitTree` 还能访问 `this.tree`（测试里 banner 在回到 Arena 后 `visible` 为 false）。
