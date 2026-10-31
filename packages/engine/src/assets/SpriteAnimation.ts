import type { Texture } from './Texture'

/** 一套帧动画：`AnimatedSprite2D` 播放它，`aseprite()` 的 tag 也产出它。 */
export interface SpriteAnimation {
  /** 帧序列，至少一帧。通常来自 `sheet().frames()` 或 `atlas().frames(prefix)`。 */
  frames: readonly Texture[]
  /** 每秒帧数，默认 10。与 `durations` 二选一。 */
  fps?: number
  /** 每一帧显示的秒数（长度和 `frames` 相同，都 > 0），让帧长短不一，例如攻击的前摇停得久、出手帧很短。与 `fps` 二选一。 */
  durations?: readonly number[]
  /** 播到最后一帧后从头循环，默认 true。不循环时停在最后一帧并触发 `animationFinished`。 */
  loop?: boolean
}
