import { Node, type NodeOptions } from '../core/Node'
import { Signal } from '../core/Signal'

export interface TimerOptions extends NodeOptions {
  /** 计时时长（秒），默认 1。 */
  waitTime?: number
  /** 只触发一次，默认 false（循环触发）。 */
  oneShot?: boolean
  /** 进入树时自动开始，默认 false。 */
  autostart?: boolean
  /**
   * 按物理步推进（每步 1/60 秒的游戏时间，在 `physicsProcess` 之前）而不是按帧，默认 false。
   * 驱动玩法的计时器（刷怪、技能冷却）用它：倍速下触发的物理步和 1 倍速完全一样。进树后不能改。
   */
  processInPhysics?: boolean
}

/**
 * 计时器节点：倒计时结束时触发 `timeout`。由帧循环驱动，无头测试里随 `step()` 推进。
 *
 * ```ts
 * const spawn = this.add(new Timer({ waitTime: 2, autostart: true }))
 * spawn.timeout.connect(() => this.spawnEnemy(), this)
 *
 * await this.tree.createTimer(0.5).timeout // 一次性的等待，不需要节点
 * ```
 *
 * 每帧（`processInPhysics` 时每个物理步）最多触发一次；循环模式下超出的时间会计入下一轮，所以长期来看不会漂移。
 */
export class Timer extends Node {
  readonly timeout = new Signal()
  waitTime: number
  oneShot: boolean
  autostart: boolean
  /** 按物理步推进（见 `TimerOptions`）。 */
  readonly processInPhysics: boolean
  private _timeLeft = 0
  private _running = false
  private _autostarted = false

  constructor(options: TimerOptions = {}) {
    super(options)
    this.waitTime = options.waitTime ?? 1
    this.oneShot = options.oneShot ?? false
    this.autostart = options.autostart ?? false
    this.processInPhysics = options.processInPhysics ?? false
  }

  /** 剩余时间（秒）；停止时为 0。 */
  get timeLeft(): number {
    return this._running ? Math.max(0, this._timeLeft) : 0
  }

  get isStopped(): boolean {
    return !this._running
  }

  /** 开始（或重新开始）计时。传入 `time` 时同时修改 waitTime。 */
  start(time?: number): void {
    if (time !== undefined) this.waitTime = time
    if (!(this.waitTime > 0)) throw new Error(`Timer waitTime must be > 0, got ${this.waitTime}`)
    this._timeLeft = this.waitTime
    this._running = true
  }

  stop(): void {
    this._running = false
    this._timeLeft = 0
  }

  /** @internal */
  override _onEnterTree(): void {
    if (this.autostart && !this._autostarted) {
      this._autostarted = true
      this.start()
    }
  }

  /** @internal 按物理步的计时器要在每个物理步被调到（即使没有覆写 physicsProcess）。 */
  override get _needsPhysicsStep(): boolean {
    return this.processInPhysics
  }

  /** @internal 计时放在引擎内部钩子里：子类覆写 process() / physicsProcess() 不会影响计时。 */
  override _internalProcess(dt: number): void {
    if (!this.processInPhysics) this._tick(dt)
  }

  /** @internal */
  override _internalPhysicsProcess(dt: number): void {
    if (this.processInPhysics) this._tick(dt)
  }

  private _tick(dt: number): void {
    if (!this._running) return
    this._timeLeft -= dt
    if (this._timeLeft > 1e-9) return
    if (this.oneShot) {
      this._running = false
      this._timeLeft = 0
    } else {
      this._timeLeft += this.waitTime
    }
    this.timeout.emit()
  }

  protected override dumpProps(): Record<string, unknown> {
    return {
      waitTime: this.waitTime,
      oneShot: this.oneShot || undefined,
      timeLeft: this._running ? Math.round(this.timeLeft * 1000) / 1000 : undefined,
      stopped: this._running ? undefined : true,
      physics: this.processInPhysics || undefined,
    }
  }
}
