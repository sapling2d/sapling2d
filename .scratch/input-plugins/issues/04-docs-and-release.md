# 04 — 文档、模板和 0.3.0

**What to build:** 让 agent 从 `llms.txt`、`CONTEXT.md` 和游戏模板里学到新的边界和用法；确认 hero-guard 不受影响；发 0.3.0。

- `CONTEXT.md`：
  - 新词条：**Plugin**（`plugins: [...]`、`install` / `provide`、`tree.get(Token)`、三平台 mock 规则）、**platform.kind**、**InputSource**（唯一扩展点、`bindingTypes` / `eventTypes` / `handle` / `beginFrame` / `strength`、按类型路由）、**Keyboard**（默认安装的内置插件，`key()`、`tree.get(Keyboard)`、小游戏入口不装）、**MotionInput / tilt()**。
  - 改词条：**Input**（只剩动作、指针状态、扩展点；"不再增长"）、**Platform**（加 `kind`，`onInput` 只产指针，插件自己挂监听）、**TouchScreenButton**（去掉 passby，"按公开 API 实现、不进核心"）、**TouchJoystick**、**Pointer picking**（加"被捕获的节点不可命中时收到 pointerUp"）。
- `packages/engine/docs/llms.template.md`：
  - "入口"一节：`sapling2d/motion`。
  - "输入"一节：`key` 来自键盘插件（默认装好）、`isKeyPressed` → `tree.get(Keyboard).isPressed`。
  - 新小节 **插件**：`plugins: [motion()]`、`tree.get`、"浏览器里没有的能力是 mock，游戏照常跑"。
  - 新小节 **倾斜（运动传感器）**：引用 `docs/examples/motion.test.ts`。
  - "屏幕按钮"和"摇杆"小节：去掉 passby。
  - "测试"一节：`g.inject`、`plugins`。
  - "微信小游戏"一节：没有键盘插件；传感器要在真机验证；`wx.stopAccelerometer` 由插件处理。
  - "常见陷阱"：忘装插件的警告长什么样；iOS 的权限要在手势里。
  - 重新生成 `llms.txt`（`pnpm --filter sapling2d llms`）。
- `templates/game/AGENTS.md`：加一条"平台差异化能力（键盘以外的设备、小游戏能力）用 `plugins`，游戏代码只读动作或 `tree.get(...)`"。模板若有 `isKeyPressed` 或 `passbyPress` 一并改。
- hero-guard（`~/Projects/hero-guard`，链接到本地引擎）：`pnpm check` 通过；它只用动作和指针信号，预期零改动，有出入记在工单评论里。
- ADR 0001 不变；ADR 0010 已是 Accepted。
- `packages/engine` 版本 0.3.0，`chore(release)` 提交；发布用 `pnpm publish`（见 AGENTS.md）。发布前 `pnpm pack` 装到仓库外验证 `sapling2d`、`sapling2d/motion`、`sapling2d/testing` 三个入口。

**Blocked by:** 02, 03

**Status:** done（2026-10-20；`pnpm publish` 等用户确认后执行）

- [x] `CONTEXT.md` 新增 / 修改的词条齐全，用词和 ADR 0010 一致（Plugin、InputSource、kind、mock）；`platform.kind` 并进了 Platform 和 Plugin 两条，没有单独成条
- [x] `llms.txt` 过期检查通过；新示例 `docs/examples/motion.test.ts` 被"倾斜"一节引用；新增顶级"## 插件"一节（安装、默认插件、mock 规则、自己写一个的要点）
- [x] `templates/game` 的 `pnpm check` 通过；模板里没有 `isKeyPressed` / `passbyPress`，AGENTS.md 加了插件那条
- [x] hero-guard `pnpm check` 通过（31 个测试文件、345 个用例），零改动
- [x] `pnpm pack` 外部安装验证三个入口（03 里做过：`tsc` 过、运行正常）
- [x] 三个 README（根、`packages/engine`、中文）加了插件那条特性和 `sapling2d/motion` 入口行
- [ ] 0.3.0 发布（`pnpm publish` 在 `packages/engine`，需要用户确认）；发布后把各工单状态同步

## Comments

**实现（2026-10-20）：** `pnpm check` 全部 workspace 包通过（engine 499），`pnpm --filter sapling2d build` 通过，版本号已改成 0.3.0（单独的 `chore(release)` 提交）。

- `CONTEXT.md` 的 Input 词条现在直接写出边界："只管事件队列、动作、指针路由；此外不再增加任何公开成员，新设备一律走 InputSource"。
- llms 模板的"插件"一节放在"测试"之后、"微信小游戏"之前，和"倾斜"小节（03 加的）互相引用。
- README 的 "Status: 0.1, an early MVP" 这行是旧的，这次没动——不属于这个工单。
