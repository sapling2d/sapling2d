import type { InputEventRegistry } from '../../index'

/** 指针事件。坐标是窗口逻辑像素（与 ScreenInfo 一致），由引擎换算成设计坐标。平台只产这一种事件。 */
export type RawPointerEvent = { type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'; pointerId: number; x: number; y: number }

/** 平台和插件产出的原始输入事件（见 `InputEventRegistry`）。每种事件都有 `type` 字段，`Input` 按它路由给订阅的来源。 */
export type RawInputEvent = InputEventRegistry[keyof InputEventRegistry]

export function isPointerEvent(e: RawInputEvent): e is RawPointerEvent {
  const t = e.type
  return t === 'pointerdown' || t === 'pointermove' || t === 'pointerup' || t === 'pointercancel'
}
