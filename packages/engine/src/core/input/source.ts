import type { InputBinding } from './bindings'
import type { RawInputEvent } from './events'

/**
 * 输入来源：`Input` 的唯一扩展点。键盘、屏幕控件、传感器、手柄都通过它接入，`Input` 自己只认识指针。
 * 用 `tree.input.addSource(source)` 登记。每个成员都可选，只实现用到的。
 *
 * 力度规则：动作的力度是所有来源给出的最大值（0–1）；力度 ≥ 0.5 算按下。
 */
export interface InputSource {
  /** 认领的绑定类型（`InputBinding.type`）。定义动作时没有来源认领的绑定会打印警告，提示安装插件。 */
  readonly bindingTypes?: readonly string[]
  /** 订阅的事件类型（`RawInputEvent.type`）。可以是自己的事件，也可以是核心的指针事件（手势识别）。 */
  readonly eventTypes?: readonly string[]
  /** 订阅的事件按队列顺序到达（帧首处理）。指针事件先给节点，再给订阅它的来源。 */
  handle?(event: RawInputEvent): void
  /** 帧首、动作状态更新之前：轮询型设备在这里取状态。 */
  beginFrame?(): void
  /** 给动作 `action`（绑定是 `bindings`）的力度 0–1。按绑定驱动（键盘）和按动作名驱动（屏幕按钮）的来源都走这里。 */
  strength?(action: string, bindings: readonly InputBinding[]): number
  /** 切到后台：把按着的东西 push 进 `queue` 成松开事件（`queue` 里还没处理的按下也算，它们的松开在后台收不到）。 */
  releaseAll?(queue: RawInputEvent[]): void
}
