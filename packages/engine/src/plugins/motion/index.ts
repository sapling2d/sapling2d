import type { InputBinding } from '../../core/input/bindings'
import type { RawInputEvent } from '../../core/input/events'
import type { InputSource } from '../../core/input/source'
import type { Plugin } from '../../core/plugin'
import { createBrowserMotion } from './browser'
import type { MotionProducer, MotionStatus } from './producer'
import { createWechatMotion } from './wechat'

export type { MotionPermission } from './producer'

/**
 * 运动传感器的采样：含重力的加速度，单位 g（重力 = 1），设备坐标——屏幕向右 +x、向上 +y、朝外 +z。
 * 平放时 z ≈ 1；左边压低时 x > 0（传感器量的是“向上”的反作用力）。测试里用 `g.inject` 注入。
 */
export type RawMotionEvent = { type: 'motion'; x: number; y: number; z: number }

/** 倾斜方向：`left` / `right` 绕屏幕纵轴（左右压低），`forward` / `back` 绕横轴（上边压低 / 下边压低）。 */
export type TiltDirection = 'left' | 'right' | 'forward' | 'back'

/** 倾斜绑定（见 `tilt()`）。 */
export type TiltBinding = { readonly type: 'tilt'; readonly dir: TiltDirection; readonly deadzone: number; readonly full: number }

declare module 'sapling2d' {
  interface InputEventRegistry {
    motion: RawMotionEvent
  }
  interface InputBindingRegistry {
    tilt: TiltBinding
  }
}

/**
 * 倾斜绑定：把倾斜角换成 0–1 的力度——`deadzone`（度，默认 5）以内是 0，到 `full`（度，默认 30）线性增加到 1。
 * 和键盘绑定共用动作：`actions: { steerLeft: [key('KeyA'), tilt('left')] }`，游戏只读 `getAxis`。
 * 以竖屏持机为准；`forward` / `back` 的基线是手机平放，手持时一般有几十度的初始倾斜，多数游戏只用 `left` / `right`。
 */
export function tilt(dir: TiltDirection, options: { deadzone?: number; full?: number } = {}): InputBinding {
  const deadzone = Math.max(0, options.deadzone ?? 5)
  return { type: 'tilt', dir, deadzone, full: Math.max(deadzone + 1, options.full ?? 30) }
}

export interface MotionOptions {
  /** 指数平滑系数 0–0.99：每个采样向目标走 (1 − smoothing)。0 不平滑，默认 0.2。第一个采样直接到位。 */
  smoothing?: number
}

const RAD_TO_DEG = 180 / Math.PI

/**
 * 运动传感器的状态，通过 `this.tree.get(MotionInput)` 访问。多数游戏不直接读它，而是用 `tilt()` 绑定动作。
 */
export class MotionInput implements InputSource, MotionStatus {
  readonly bindingTypes = ['tilt']
  readonly eventTypes = ['motion']
  readonly smoothing: number
  private _x = 0
  private _y = 0
  private _z = 0
  private _sampled = false
  private _available = false
  private _permission: 'granted' | 'denied' | 'prompt' | 'unsupported' = 'unsupported'

  /** @internal 由 `motion()` 创建。 */
  constructor(options: MotionOptions = {}) {
    this.smoothing = Math.min(0.99, Math.max(0, options.smoothing ?? 0.2))
  }

  /** 含重力的加速度（单位 g，设备坐标，平滑后）。 */
  get x(): number {
    return this._x
  }
  get y(): number {
    return this._y
  }
  get z(): number {
    return this._z
  }

  /** 左右倾斜角（度）：左边压低为正。 */
  get roll(): number {
    return Math.asin(clamp(this._x, -1, 1)) * RAD_TO_DEG
  }

  /** 前后倾斜角（度）：上边压低（向前倒）为正。 */
  get pitch(): number {
    return Math.asin(clamp(this._y, -1, 1)) * RAD_TO_DEG
  }

  /** 这个平台有没有传感器（无头平台当作有，靠注入）。 */
  get available(): boolean {
    return this._available
  }

  /**
   * 权限：iOS 浏览器要在第一次触摸时申请，`prompt` 期间游戏可以提示“点击屏幕开启重力感应”；
   * 小游戏和无头平台直接是 `granted`；没有传感器是 `unsupported`。
   */
  get permission(): 'granted' | 'denied' | 'prompt' | 'unsupported' {
    return this._permission
  }

  /** @internal 生产者汇报状态。 */
  setStatus(available: boolean, permission: 'granted' | 'denied' | 'prompt' | 'unsupported'): void {
    this._available = available
    this._permission = permission
  }

  /** @internal */
  handle(event: RawInputEvent): void {
    if (event.type !== 'motion') return
    if (!this._sampled) {
      this._sampled = true
      this._x = event.x
      this._y = event.y
      this._z = event.z
      return
    }
    const k = 1 - this.smoothing
    this._x += (event.x - this._x) * k
    this._y += (event.y - this._y) * k
    this._z += (event.z - this._z) * k
  }

  /** @internal 每个 tilt 绑定按倾斜角给力度，取最大。 */
  strength(_action: string, bindings: readonly InputBinding[]): number {
    let strength = 0
    for (let i = 0; strength < 1 && i < bindings.length; i++) {
      const b = bindings[i]!
      if (b.type !== 'tilt') continue
      const s = this._tilt(b)
      if (s > strength) strength = s
    }
    return strength
  }

  private _tilt(b: TiltBinding): number {
    let angle: number
    switch (b.dir) {
      case 'left':
        angle = this.roll
        break
      case 'right':
        angle = -this.roll
        break
      case 'forward':
        angle = this.pitch
        break
      case 'back':
        angle = -this.pitch
        break
    }
    if (angle <= b.deadzone) return 0
    return Math.min(1, (angle - b.deadzone) / (b.full - b.deadzone))
  }
}

/**
 * 运动传感器插件：`startGame({ main, plugins: [motion()] })`。
 *
 * - 浏览器：`devicemotion`。iOS 13+ 要在用户手势里申请权限，插件在第一次触摸时自动申请（`MotionInput.permission`）。
 *   桌面浏览器没有传感器：`available` 为 false，倾斜绑定一直是 0，键盘照常。
 * - 小游戏：`wx.startAccelerometer`（20 ms 一次）；切到后台停掉，回到前台重新开。
 * - 无头：没有生产者，`g.inject({ type: 'motion', x, y, z })` 注入采样。
 */
export function motion(options: MotionOptions = {}): Plugin {
  return {
    install(ctx) {
      const sensor = new MotionInput(options)
      ctx.provide(MotionInput, sensor)
      const input = ctx.tree.input
      input.addSource(sensor)
      const emit = (event: RawMotionEvent) => input.enqueue(event)
      let producer: MotionProducer | null = null
      if (ctx.platform.kind === 'browser') producer = createBrowserMotion(emit, sensor)
      else if (ctx.platform.kind === 'wechat') producer = createWechatMotion(emit, sensor)
      else sensor.setStatus(true, 'granted')
      if (!producer && ctx.platform.kind !== 'headless') {
        sensor.setStatus(false, 'unsupported')
        console.info('[sapling2d] motion: this platform has no motion sensor; tilt bindings stay at 0.')
      }
      const offFocus = ctx.tree.focusChanged.connect((focused) => (focused ? producer?.start() : producer?.stop()))
      producer?.start()
      return () => {
        offFocus()
        producer?.dispose()
        input.removeSource(sensor)
      }
    },
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
