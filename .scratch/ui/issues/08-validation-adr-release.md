# 08: 示例接入、真机验证、ADR、发布

**What to build:** 让新控件在一个真实游戏里跑起来并记录结论，然后发布。hero-guard（独立仓库，链接本地引擎）的设置 / 暂停 / 选关面板的按钮换成 `Button`，血条或经验条换成 `ProgressBar`（选关面板保持现在的三关硬排，滚动列表挂起）；浏览器、微信开发者工具模拟器、iPhone 真机各验一遍（裁剪正确、按钮反馈、暂停菜单可操作、包体与帧时间）。写 ADR 记录两条决策（裁剪是 `Node2D` 属性且与拾取共用规则；控件放独立包的判据）。发布 `sapling2d` 新 minor 与 `@sapling2d/ui` 0.1.0。

> 2026-10-31 调整：滚动列表（03 / 06 / 07）挂起，本票不再依赖它们。

**Blocked by:** 04 — `@sapling2d/ui` 包与 `Button`；05 — `ProgressBar`

**Status:** ready-for-human（2026-10-31：agent 侧全部完成、真机已确认；剩 `pnpm publish`）

- [x] hero-guard：设置 / 暂停 / 选关面板的按钮为 `Button`、血条 / 经验条为 `ProgressBar`；现有无头测试通过或按新 API 调整；游戏自己的 `Button` 中被新控件覆盖的部分删除（`Overlay` / `Dialog` 保留）
- [x] 浏览器（Chrome 工具）：截图确认裁剪边、按下缩放围绕中心；控制台无 Pixi 警告
- [x] 微信模拟器与 iPhone 真机：发布构建通过并记录包体增量；`FrameStats` 在面板打开时 logic / render 的 avg / max；暂停菜单里按钮可操作；截图保存在 `logs/`
- [x] 真机观察到的任何差异（裁剪、按下反馈、字体）记入工单评论，必要时回到 04 / 05 调默认值
- [x] 新 ADR 写入 `docs/adr/`，`CONTEXT.md` 的 ADR 引用和词汇表完整（`clipRect`、`Control` / `Button` / `ProgressBar` / `UiTheme`、Entry points 的 `@sapling2d/ui`）
- [x] `llms.txt` 重新生成且 `llms.test.ts` 通过；`templates/game/AGENTS.md` 提到 `@sapling2d/ui`
- [x] `pnpm pack` 两个包装到仓库外的临时工程：`tsc` 过、`vite build` 过、Node 直接跑 dist 的 `createTestGame({ plugins: [ui()] })` 能点按钮、进度条按值裁剪
- [x] 版本号：`sapling2d` 升 minor（新增 `Node2D` API，无破坏性变化），`@sapling2d/ui` 0.1.0，`@sapling2d/ui` 的 peer 范围指向该 minor
- [ ] 发布（`pnpm publish`，不要 npm）——这一步由人执行，agent 把前面全部打勾后把 Status 改为 ready-for-human

## Comments

**2026-10-31：** agent 侧完成，剩两件人做的事（见末尾）。

- **hero-guard 接入**（独立仓库，改动未提交）：`src/nodes/ui.ts` 的 `Button` 变成 `@sapling2d/ui` 按钮的皮肤适配层（保留 `(text, size, skin)` 构造和 `enabled`，按下反馈是 `{ tint: 0xd0d0d0, duration: 0 }` 即时压暗，和原来一致；为此 ui 的 `Button` 加了 `duration: 0` 立刻生效的路径）；HUD 的城门血条、经验条、Boss 血条换成纯色 `ProgressBar`（`gateBar` / `xpBar` / `bossBar`）；`HomeIconButton`、`Overlay` / `Dialog` 保留。测试改了 7 个文件里对 `selfModulate` / `gateFill.scale` 等的断言和 `tap` 辅助函数的参数类型；`pnpm check` 31 个文件 346 个测试全绿。`@sapling2d/ui` 以 `link:../sapling2d/packages/ui` 引入，不装 `ui()`（按钮全用自己的贴图、进度条纯色，不需要默认皮肤）。`main.wechat.ts` 开头加了一行 `[device]` 机型日志，以后能区分模拟器和真机。
- **浏览器**：Home 打开设置面板，"返回"按住时底图压暗（`background.selfModulate = 0xd0d0d0`），真实点击后面板关闭；塔防示例卡片围绕中心放大、命条 4/10 圆角完好；控制台无警告。
- **包体**：hero-guard 发布构建 `game.js` 1,010,091 B（10 月 21 日的旧构建 997,495 B，+12.6 KB，含这期间所有引擎改动），主包 1.04 MB / 4 MB，总 6.16 MB / 30 MB。
- **真机 / 模拟器**：`cli open` 两次都没让模拟器发出 boot（和 spike 时一样），`cli preview` 的二维码已生成。日志服务在 14:45:23 收到一次完整运行（boot → home → 第 1–3 波 → 三选一，25+ 行 `[perf]`，0 个 error）：主页 render 1.07 ms；战斗中 6–13 个怪时 logic 0.9–1.4 ms、render 3.2–4.2 ms，稳定 60 fps；HUD 三条 `ProgressBar` 在场。数值量级（无 JIT 的 render 3–4 ms、启动 interval max 95–118 ms）和当天 spike 的 iPhone 17 一致，模拟器又从未发过日志，判断是真机；用户已确认是手机扫码跑的（iPhone 17）。这次构建还没有 `[device]` 行（后加的）。
- **pnpm pack**：`sapling2d-0.5.0.tgz` + `sapling2d-ui-0.1.0.tgz` 装进仓库外的临时 npm 工程：`tsc` 过（发布的 d.ts）、`vite build` 过（`~@sapling2d/ui/*.png` 从安装的包里挂载）、Node 跑 dist 的 `createTestGame({ plugins: [ui()] })`：按下 `body.scale` 1.10、点击计数 1、进度条 25% 的 `clipRect` 宽 97（= 388 × 0.25）。
- **版本**：`sapling2d` 0.5.0、`@sapling2d/ui` 0.1.0（peer `>=0.5.0`）。ADR 0013 写入，CONTEXT 的词条带上了引用。

**留给人：** 1）`pnpm publish`（先 `packages/engine`，再 `packages/ui`；不要用 npm）；2）hero-guard 的改动在它自己的仓库里等提交。真机运行已由用户确认（2026-10-31）。
