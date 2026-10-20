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

**Status:** ready-for-agent

- [ ] `CONTEXT.md` 新增 / 修改的词条齐全，用词和 ADR 0010 一致（Plugin、InputSource、kind、mock）
- [ ] `llms.txt` 过期检查通过；新示例 `docs/examples/motion.test.ts` 被引用
- [ ] `templates/game` 的 `pnpm check` 通过
- [ ] hero-guard `pnpm check` 通过
- [ ] `pnpm pack` 外部安装验证三个入口
- [ ] 0.3.0 发布，`.scratch/input-plugins/` 各工单状态更新为 done
