# 04 — `examples/spine` + 文档

**What to build:** 用官方 spineboy 做示例并把插件写进文档。规格见 `../spec.md`"示例与验证"和"核心新增 / 修改"第 6 条。

- `examples/spine`：`package.json`（依赖 `sapling2d`、`@sapling2d/spine`、`@sapling2d/touch`?——不用，点击半区就够）、`vite.config.ts`（`sapling()`）、`vite.wechat.config.ts`、`index.html`、`src/game.ts` / `main.ts` / `main.wechat.ts`、`public/assets/spineboy/{spineboy-pro.json,spineboy.atlas,spineboy.png}`、`test/spine.test.ts`。
- `packages/spine/docs/examples/spine.test.ts`（llms 示例，`#region example` / `#region test`，用 `test/fixtures/spineboy` 的 ess 版本）、`packages/spine/README.md`（含许可证提示）。
- `llms.template.md`：入口表、"Spine 骨骼动画"一节（放在"帧动画与图集"之后）、节点清单、dump 表、插件一节、微信一节（包体积）、常见陷阱（版本 4.3、许可证、PMA 两种都行、JSON 不是 .skel）；`pnpm llms`。
- `CONTEXT.md`：**SpineSkeleton / spineSkeleton()**、**SpineSprite**、**SpineBoneNode**、**Resource**、**Render plugin / registerNodeContent** 词条；Entry points 加 `sapling2d/render` 和 `@sapling2d/spine`。
- 三个 README 的入口表；`templates/game/AGENTS.md` 的插件一条。

**Blocked by:** 03

**Status:** done（2026-10-31）

- [x] `pnpm --filter example-spine test` 绿；`pnpm check` 全绿；`llms.test.ts` 不过期
- [x] `examples/spine` 浏览器截图：spineboy idle，点击后 jump
- [x] `pnpm --filter example-spine build:wechat` 成功，打印的主包 / 分包大小记录在工单里

## Comments

**实现（2026-10-31）：** `examples/spine`（5 个无头用例：idle / 跳 / 走 + 翻转 + 枪口骨骼 / footstep 计数 / 轨道 1 开枪 + 闪光）、`packages/spine/docs/examples/spine.test.ts`（llms 示例）、README、`llms.template.md`（入口表、Spine 一节、节点清单、dump 表、插件一节、常见陷阱）、`CONTEXT.md`、三个 README、模板 AGENTS.md；`pnpm llms` 已重新生成，`pnpm check` 全绿（engine 492 / spine 36 / example-spine 5）。

- 浏览器（Chrome，`pnpm dev`）：spineboy idle / walk / jump / shoot 正常，头部的 clipping 正确，枪口闪光跟着 gun-tip、翻转后镜像（截图已看，未存盘）。控制台没有 Pixi 警告。
- 小游戏发布构建（`WX_APPID` 用假 id）：主包 0.97 MB（game.js，gzip 279 KB），资源分包 0.49 MB（spineboy JSON 256 KB + PNG 243 KB + touch 皮肤）；同一引擎的 sprite 示例（重新构建）主包 0.81 MB（gzip 234 KB），即 spine-core + 本插件 + touch 皮肤约 +0.16 MB（gzip +45 KB）。
- 示例用了 `@sapling2d/touch` 的屏幕按钮（左右走、开枪），点空白处跳。
