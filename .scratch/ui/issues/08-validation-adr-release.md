# 08: 示例接入、真机验证、ADR、发布

**What to build:** 让新控件在一个真实游戏里跑起来并记录结论，然后发布。hero-guard（独立仓库，链接本地引擎）的选关面板改用 `ScrollContainer` + `Button`，设置 / 暂停面板的按钮换成 `Button`，血条或经验条换成 `ProgressBar`；浏览器、微信开发者工具模拟器、iPhone 真机各验一遍（裁剪正确、滚动手感、按钮反馈、暂停菜单可操作、包体与帧时间）。写 ADR 记录三条决策（裁剪是 `Node2D` 属性且与拾取共用规则；捕获可转移、取消统一表现为不带 `clicked` 的抬起；控件放独立包的判据）。发布 `sapling2d` 新 minor 与 `@sapling2d/ui` 0.1.0。

**Blocked by:** 05 — `ProgressBar`；07 — `ScrollContainer` 手感

**Status:** ready-for-agent

- [ ] hero-guard：选关面板用 `ScrollContainer` 列出全部关卡（≥ 6 项以体现滚动）、按钮为 `Button`、血条 / 经验条为 `ProgressBar`；现有无头测试通过或按新 API 调整；游戏自己的 `Button` / `Overlay` 中被新控件覆盖的部分删除
- [ ] 浏览器（Chrome 工具）：截图确认裁剪边、按下缩放围绕中心、滚动透传；控制台无 Pixi 警告
- [ ] 微信模拟器与 iPhone 真机：发布构建通过并记录包体增量；`FrameStats` 在选关面板打开时 logic / render 的 avg / max；暂停菜单里按钮与列表可操作；截图保存在 `logs/`
- [ ] 真机观察到的任何差异（裁剪、手感、字体）记入工单评论，必要时回到 06 / 07 调默认值
- [ ] 新 ADR 写入 `docs/adr/`，`CONTEXT.md` 的 ADR 引用和词汇表完整（`clipRect`、捕获转移、`Control` / `Button` / `ProgressBar` / `ScrollContainer` / `UiTheme`、Entry points 的 `@sapling2d/ui`）
- [ ] `llms.txt` 重新生成且 `llms.test.ts` 通过；`templates/game/AGENTS.md` 提到 `@sapling2d/ui`
- [ ] `pnpm pack` 两个包装到仓库外的临时工程：`tsc` 过、`vite build` 过、Node 直接跑 dist 的 `createTestGame({ plugins: [ui()] })` 能点按钮和滚动
- [ ] 版本号：`sapling2d` 升 minor（新增 `Node2D` API，无破坏性变化），`@sapling2d/ui` 0.1.0，`@sapling2d/ui` 的 peer 范围指向该 minor
- [ ] 发布（`pnpm publish`，不要 npm）——这一步由人执行，agent 把前面全部打勾后把 Status 改为 ready-for-human
