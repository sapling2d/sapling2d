import type { PointerBinding } from '../input/bindings'
import type { RawPointerEvent } from '../input/events'
import type { KeyBinding, RawKeyEvent } from '../input/keyboard'

/*
 * 用声明合并扩展的注册表。游戏和插件写 `declare module 'sapling2d' { interface XxxRegistry { … } }`，
 * 主入口按名字 re-export 这里的接口，合并会落到这里。
 */

/**
 * 原始输入事件注册表。核心只有指针事件；内置的键盘插件直接登记在这里，外部插件用声明合并加入自己的事件。
 * 每种事件都要有 `type` 字段（字符串字面量），`Input` 按它把事件路由给订阅了该类型的 `InputSource`：
 *
 * ```ts
 * declare module 'sapling2d' {
 *   interface InputEventRegistry { motion: { type: 'motion'; x: number; y: number; z: number } }
 * }
 * ```
 */
export interface InputEventRegistry {
  pointer: RawPointerEvent
  key: RawKeyEvent
}

/**
 * 动作绑定注册表。核心只有 `pointerPress()`；内置的键盘插件直接登记在这里，外部插件用声明合并加入自己的绑定。
 * 每种绑定都要有 `type` 字段，和认领它的 `InputSource.bindingTypes` 对应：
 *
 * ```ts
 * declare module 'sapling2d' {
 *   interface InputBindingRegistry { tilt: { type: 'tilt'; dir: 'left' | 'right' } }
 * }
 * ```
 */
export interface InputBindingRegistry {
  pointer: PointerBinding
  key: KeyBinding
}

/**
 * 组名注册表。用声明合并给组名加类型（见 GroupName）：
 *
 * ```ts
 * declare module 'sapling2d' {
 *   interface GroupRegistry { fruits: Fruit }
 * }
 * ```
 */
export interface GroupRegistry {}

/**
 * 输入动作注册表。用声明合并给动作名加类型（见 ActionName）：
 *
 * ```ts
 * declare module 'sapling2d' {
 *   interface ActionRegistry { drop: true }
 * }
 * ```
 */
export interface ActionRegistry {}

/**
 * 存储注册表。用声明合并给存储的 key 和值加类型：
 *
 * ```ts
 * declare module 'sapling2d' {
 *   interface StorageRegistry { highScore: number }
 * }
 * ```
 */
export interface StorageRegistry {}
