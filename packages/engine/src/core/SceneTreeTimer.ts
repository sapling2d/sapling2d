import { Signal } from './Signal'

/**
 * 一次性计时器（对应 Godot 的 SceneTreeTimer），由 `tree.createTimer(seconds)` 创建，不是节点。
 * 常用写法：`await this.tree.createTimer(1).timeout`。
 */
export class SceneTreeTimer {
  readonly timeout = new Signal()
  /** 暂停时是否继续计时。 */
  readonly processAlways: boolean
  /** 按真实时间计时，不受 `tree.timeScale` 影响（打击停顿时用它来恢复时间）。 */
  readonly ignoreTimeScale: boolean
  /** 按物理步推进（每步 1/60 秒的游戏时间）而不是按帧：倍速下触发的物理步和 1 倍速一样。 */
  readonly processInPhysics: boolean
  private _timeLeft: number

  /** @internal */
  constructor(seconds: number, processAlways: boolean, ignoreTimeScale = false, processInPhysics = false) {
    this._timeLeft = seconds
    this.processAlways = processAlways
    this.ignoreTimeScale = ignoreTimeScale
    this.processInPhysics = processInPhysics
  }

  get timeLeft(): number {
    return Math.max(0, this._timeLeft)
  }

  /** @internal 由 SceneTree 每帧（或每个物理步）调用；返回 false 表示已触发，可以移除。 */
  _advance(dt: number, paused: boolean): boolean {
    if (paused && !this.processAlways) return true
    this._timeLeft -= dt
    if (this._timeLeft > 1e-9) return true
    this.timeout.emit()
    return false
  }
}
