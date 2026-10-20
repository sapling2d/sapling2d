import type { InputBindingRegistry } from '../../index'

/** 指针按下绑定（见 `pointerPress()`）。 */
export type PointerBinding = { readonly type: 'pointer' }

/** 动作绑定（见 `InputBindingRegistry`）。`type` 决定由哪个输入来源给力度。 */
export type InputBinding = InputBindingRegistry[keyof InputBindingRegistry]
