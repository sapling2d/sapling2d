# 03: `Node2D.capturePointer(pointerId)` —— 指针捕获转移

**What to build:** 一个节点可以把当前按着的某根指针从别的节点手里接过来：原捕获节点收到一次 `pointerUp`（不发 `clicked`，和隐藏 / 暂停 / 切后台的取消完全相同），之后这根指针的 `pointerMove` / `pointerUp` / `clicked` 按普通捕获规则发给新节点；原本没被任何节点处理、正在触发 `pointerPress()` 的指针被接管后，对应动作在本帧松开。指针不存在、调用方不在树里或不可命中时返回 `false` 且什么都不改；自己已是捕获者返回 `true` 无副作用。`Input` 的公开面不增长，转移通过路由器的内部方法实现。这是 `ScrollContainer` 抢手势的原语，也供自定义控件使用。

**Blocked by:** None (can start immediately)

**Status:** needs-triage（2026-10-31 挂起：先不做滚动列表，等滚动列表 / 翻页器立项时和 06、07 一起做；唯一消费者是 `ScrollContainer`，见 spec 顶部的调整说明）

- [ ] 子节点捕获中，父节点 `capturePointer(id)` 返回 `true`：子节点收到 `pointerUp`（位置为指针最近位置）且无 `clicked`；之后 `g.pointerMove` 只到父节点的 `pointerMove`；`g.pointerUp` 在父节点内 → 父节点 `clicked`
- [ ] 指针按在空处（未处理，`pointerPress()` 动作为按下）→ 某节点 `capturePointer` 后，下一次 `step` 该动作 `isActionJustReleased` 为 true，`input.isPointerPressed` 仍为 true
- [ ] 指针未按下 / 调用方未进树 / 调用方 `visible = false` 或 `processMode` 使其 `canHit` 为 false → 返回 `false`，原捕获与未处理集合不变
- [ ] 调用方已是捕获者 → 返回 `true`，不发任何信号
- [ ] 转移后原节点被销毁、隐藏不影响新节点继续收事件；新节点被隐藏时走现有帧首取消路径
- [ ] 切后台（`g.setFocus(false)`）时被转移过的指针与普通捕获一样收到一次抬起
- [ ] `Input` 公开成员列表与插件机制规格一致（测试或类型层面有断言，例如现有 input 测试里对公开面的检查）；路由器新增方法带下划线前缀
- [ ] 热路径不分配：转移只在调用时做一次 Map 操作
- [ ] `CONTEXT.md` 的 Pointer picking 词条补"捕获可转移、取消统一表现为不带 clicked 的抬起"；`llms.template.md` 输入一节加一段说明；`pnpm check` 绿
