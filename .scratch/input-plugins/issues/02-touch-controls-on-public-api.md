# 02 — 屏幕控件按公开 API 重写，VirtualControls 离开核心

**What to build:** `TouchScreenButton` 和 `TouchJoystick` 只用节点拾取的公开能力（`inputPickable`、覆写 `hitTest`、`pointerDown` / `pointerMove` / `pointerUp`、指针捕获）加 `InputSource` 重写；核心补"被捕获的节点变得不可命中时取消"这一个通用能力；删掉 `VirtualControls` 和它在 `PointerRouter` / `Input` 里的所有分支。规格见 `../spec.md`"屏幕控件"一节。

- `PointerRouter.cancelUnhittable()`：帧首（`beginFrame` 之后、来源 `beginFrame` 之前）检查每个被捕获的指针，目标 `!canHit`（`isQueuedForDeletion` / 不可见 / 不能处理）或已离开树 / 已销毁 → 用最后位置发 `pointerUp`（不发 `clicked`），删掉这根指针的记录（之后它的 move / up 忽略）。`canHit` / `hitsAt` 继续留在 `core/input/hit.ts`。
- `PointerRouter` 去掉 `controls` 构造参数、`_pick` 里的控件分支、`handle` 里的 `ownsPointer` / `drag` / `move` 调用；`Input` 去掉 `_addButton` / `_removeButton` / `_addStick` / `_removeStick` 和 01 里临时登记的 `VirtualControls` 来源；删除 `core/input/VirtualControls.ts`。
- `TouchScreenButton`：构造时 `inputPickable = true`，连接自己的 `pointerDown` / `pointerMove` / `pointerUp`；`_pointerIds` 变私有；实现 `InputSource.strength`；`_onEnterTree` / `_onExitTree` 里 `addSource` / `removeSource`（出树时若有手指按着，先松开并发 `released`）。**删除 `passbyPress` 选项和字段**。
- `TouchJoystick`：覆写 `hitTest`（`fixed` 用 `hitArea`；`dynamic` 没按着时判断 `region` 包含 `globalTransform.apply(local)`，按着时 false）；连接自己的指针信号驱动 `_press` / `_drag` / `_release`；实现 `strength`；进出树登记。
- 测试：`test/touch-button.test.ts`（17）、`test/touch-joystick.test.ts`（15）、`docs/examples/touch-buttons.test.ts`、`docs/examples/touch-joystick.test.ts` 改到新行为；删掉 passby 和"一个手指按两个重叠按钮"的用例，加"滑回来不再按下"和"最上层的按钮赢"。
- 文档注释：两个节点和 `Input` 的 JSDoc 去掉 passby 和 `VirtualControls` 的说法；`CONTEXT.md` 的词条留给 04 统一改。

**Blocked by:** 01

**Status:** done（2026-10-20）

- [x] `grep -rn 'nodes/' packages/engine/src/core/input` 为空；`grep -rn 'VirtualControls\|VirtualButton\|VirtualStick\|passbyPress' packages/engine/src` 为空
- [x] 按钮：按下 / 抬起 / 取消 / 多个手指按同一个按钮（最后一个离开才松开）/ 滑出松开 / 滑回来不再按下 / 画在上面的节点先收到 / 按着的手指不触发 `pointerPress()` / 未知动作警告
- [x] 按钮：隐藏、`processMode` 暂停、`queueFree`、移出树、切后台时在下一帧帧首松开，`released` 恰好发一次，动作 `isActionJustReleased` 为 true
- [x] 摇杆：`dynamic` 出现位置和死区换算、`fixed`、斜向、`g.drag`、区域外不响应、按着时第二个手指不归它（落到下面的节点或 `pointerPress()`）、自定义 `region`、和按钮同时用、上层按钮优先、和键盘取最大、后台 / 隐藏 / 移出树松开、暂停、贴图显示和摇杆头限位、相机不影响
- [x] 通用捕获取消：一个普通 `inputPickable` 节点被拖着时 `visible = false`，下一帧收到 `pointerUp`、不收到 `clicked`，之后这根手指的 `pointerup` 不再触发任何信号；`queueFree`、暂停、离开树同样（`test/input.test.ts` 三个用例）
- [x] 同帧按下又抬起：`pressed` 和 `released` 都发出，动作 just-pressed 和 just-released 同帧都为 true
- [x] 每帧热路径不分配：没有手指按着时 `cancelUnhittable` 看一眼 `_captures.size` 就返回；节点没有每帧代码
- [x] platformer 的方向键用了 `passbyPress`（`examples/platformer/src/nodes/Controls.ts`）：改成一个 `fixed` 的 `TouchJoystick`（只配 `left` / `right`，半径 20、死区 0，`hitArea` 覆盖原来两个按钮的区域，不设贴图），两张按钮图改成 `Sprite2D` 留作装饰、按 `vectorX` 的符号切换透明度；手感和原来一致（滑过去就换方向）。`level.test.ts` 按右键图中心（偏移 30 > 半径）照常成立。spinblade 不受影响。两个示例的测试通过
- [x] `pnpm check` 绿，`llms.txt` 重新生成

## Comments

**实现（2026-10-20）：** `pnpm check` 全部 workspace 包通过（engine 483，比 01 多 4：按钮 +3、摇杆 +1、指针 +2、删 passby 相关 2）。

- `PointerRouter` 只剩节点拾取和捕获，`handle` 的 move 分支从 20 行缩到 5 行。`cancelUnhittable` 直接复用 `_end(id, up = false)`：节点在树里就收到 `pointerUp`，不在树里（`remove` 掉的）只是忘掉指针——节点自己在 `_onExitTree` 里松开。
- 两个节点进树时 `addSource(this)`，自己就是 `InputSource`，`strength(action)` 直接比较字符串。拾取时序没变：指针信号在 `_flush` 处理事件时同步触发，紧接着 `actions.update` 就读到，同帧按下又抬起仍然两个边沿都有。
- `TouchJoystick.hitTest` 覆写：按着时 false（第二个手指不归它）；`dynamic` 把局部点用 `globalTransform.apply` 换回摇杆所在坐标系再查 `region`，只在按下拾取时调用一次。
- 行为变化（spec 里已写）：`passbyPress` 删除；一个手指只按最上层的按钮；被拖着的节点隐藏 / 暂停 / 排队销毁时收到 `pointerUp`（以前静默丢掉，现在任何拖拽都能正确收尾）；拖着的节点离开树后这根手指被忘掉（`isPointerPressed` 变 false）。
- `llms.template.md` 的屏幕按钮 / 摇杆小节和节点清单去掉了 passby，加了"fixed 摇杆当方向键"和"控件只用公开 API 实现，可以照着写"两句；`docs/examples/touch-buttons.test.ts` 相应改掉滑动换方向的演示。`CONTEXT.md` 留给 04。
- 要做滑入按下（passby）的话，核心需要 `pointerEnter` / `pointerExit` 和显式捕获 API，见 spec "不在范围内"。
