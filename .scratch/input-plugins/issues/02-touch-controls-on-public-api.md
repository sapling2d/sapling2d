# 02 — 屏幕控件按公开 API 重写，VirtualControls 离开核心

**What to build:** `TouchScreenButton` 和 `TouchJoystick` 只用节点拾取的公开能力（`inputPickable`、覆写 `hitTest`、`pointerDown` / `pointerMove` / `pointerUp`、指针捕获）加 `InputSource` 重写；核心补"被捕获的节点变得不可命中时取消"这一个通用能力；删掉 `VirtualControls` 和它在 `PointerRouter` / `Input` 里的所有分支。规格见 `../spec.md`"屏幕控件"一节。

- `PointerRouter.cancelUnhittable()`：帧首（`beginFrame` 之后、来源 `beginFrame` 之前）检查每个被捕获的指针，目标 `!canHit`（`isQueuedForDeletion` / 不可见 / 不能处理）或已离开树 / 已销毁 → 用最后位置发 `pointerUp`（不发 `clicked`），删掉这根指针的记录（之后它的 move / up 忽略）。`canHit` / `hitsAt` 继续留在 `core/input/hit.ts`。
- `PointerRouter` 去掉 `controls` 构造参数、`_pick` 里的控件分支、`handle` 里的 `ownsPointer` / `drag` / `move` 调用；`Input` 去掉 `_addButton` / `_removeButton` / `_addStick` / `_removeStick` 和 01 里临时登记的 `VirtualControls` 来源；删除 `core/input/VirtualControls.ts`。
- `TouchScreenButton`：构造时 `inputPickable = true`，连接自己的 `pointerDown` / `pointerMove` / `pointerUp`；`_pointerIds` 变私有；实现 `InputSource.strength`；`_onEnterTree` / `_onExitTree` 里 `addSource` / `removeSource`（出树时若有手指按着，先松开并发 `released`）。**删除 `passbyPress` 选项和字段**。
- `TouchJoystick`：覆写 `hitTest`（`fixed` 用 `hitArea`；`dynamic` 没按着时判断 `region` 包含 `globalTransform.apply(local)`，按着时 false）；连接自己的指针信号驱动 `_press` / `_drag` / `_release`；实现 `strength`；进出树登记。
- 测试：`test/touch-button.test.ts`（17）、`test/touch-joystick.test.ts`（15）、`docs/examples/touch-buttons.test.ts`、`docs/examples/touch-joystick.test.ts` 改到新行为；删掉 passby 和"一个手指按两个重叠按钮"的用例，加"滑回来不再按下"和"最上层的按钮赢"。
- 文档注释：两个节点和 `Input` 的 JSDoc 去掉 passby 和 `VirtualControls` 的说法；`CONTEXT.md` 的词条留给 04 统一改。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `grep -rn 'nodes/' packages/engine/src/core/input` 为空；`grep -rn 'VirtualControls\|VirtualButton\|VirtualStick\|passbyPress' packages/engine/src` 为空
- [ ] 按钮：按下 / 抬起 / 取消 / 多个手指按同一个按钮（最后一个离开才松开）/ 滑出松开 / 滑回来不再按下 / 画在上面的节点先收到 / 按着的手指不触发 `pointerPress()` / 未知动作警告
- [ ] 按钮：隐藏、`processMode` 暂停、`queueFree`、移出树、切后台时在下一帧帧首松开，`released` 恰好发一次，动作 `isActionJustReleased` 为 true
- [ ] 摇杆：`dynamic` 出现位置和死区换算、`fixed`、斜向、`g.drag`、区域外不响应、按着时第二个手指不归它（落到下面的节点或 `pointerPress()`）、自定义 `region`、和按钮同时用、上层按钮优先、和键盘取最大、后台 / 隐藏 / 移出树松开、暂停、贴图显示和摇杆头限位、相机不影响
- [ ] 通用捕获取消：一个普通 `inputPickable` 节点被拖着时 `visible = false`，下一帧收到 `pointerUp`、不收到 `clicked`，之后这根手指的 `pointerup` 不再触发任何信号；`queueFree` 同样
- [ ] 同帧按下又抬起：`pressed` 和 `released` 都发出，动作 just-pressed 和 just-released 同帧都为 true（和现在一致）
- [ ] 每帧热路径不分配：没有手指按着时 `cancelUnhittable` 只是一次 Map 遍历；节点没有每帧代码
- [ ] platformer 的方向键用了 `passbyPress`（`examples/platformer/src/nodes/Controls.ts:9-10`，左右滑动不用抬手）：改成一个 `fixed` 的 `TouchJoystick`（只配 `left` / `right`，`hitArea` 覆盖原来两个按钮的区域，不设贴图），两张按钮贴图留作装饰、按 `vectorX` 的符号切换高亮；手感和原来一致（滑过去就换方向）。spinblade 不受影响。两个示例的测试通过
- [ ] `pnpm check` 绿，`llms.txt` 重新生成

**实现提示**

- 今天的"抬起时还在区域内才算 `clicked`"由核心判断；按钮的"滑出就松开"由节点在 `pointerMove` 里用 `hitTest(ev.localPosition)` 判断，核心不变。
- `TouchJoystick.hitTest` 里 `globalTransform.apply` 只在按下拾取时调用一次，不是每帧。
- 节点把自己当 `InputSource` 传给 `addSource`，`strength(action)` 直接比较字符串即可（按钮一个、摇杆四个），不要为此建 Map。
- 捕获取消用最后一次记录的位置生成 `PointerEvent2D`，`PointerRouter` 已经为每个指针保存了设计坐标（`_pointersDesign`）。
