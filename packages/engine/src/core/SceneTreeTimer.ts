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
  private _timeLeft: number

  /** @internal */
  constructor(seconds: number, processAlways: boolean, ignoreTimeScale = false) {
    this._timeLeft = seconds
    this.processAlways = processAlways
    this.ignoreTimeScale = ignoreTimeScale
  }

  get timeLeft(): number {
    return Math.max(0, this._timeLeft)
  }

  /** @internal 返回 false 表示已触发，可以移除。 */
  _advance(dt: number, paused: boolean): boolean {
    if (paused && !this.processAlways) return true
    this._timeLeft -= dt
    if (this._timeLeft > 1e-9) return true
    this.timeout.emit()
    return false
  }
}
