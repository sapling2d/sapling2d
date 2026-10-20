import type { ActionName } from '../core/actions'
import type { Texture } from '../core/assets'
import type { InputSource } from '../core/input/source'
import { Node2D, type Node2DOptions } from '../core/Node2D'
import { Signal } from '../core/Signal'
import { Rect2 } from '../math/Rect2'
import { Vector2 } from '../math/Vector2'
import { Sprite2D } from './Sprite2D'

/** 摇杆推向四个方向时写入的动作。不需要的方向可以不填。 */
export interface JoystickActions {
  left?: ActionName
  right?: ActionName
  up?: ActionName
  down?: ActionName
}

export interface TouchJoystickOptions extends Node2DOptions {
  /**
   * - `dynamic`（默认）：手指在 `region` 里按下的地方出现，松手后隐藏（手游的主流做法）；
   * - `fixed`：固定在 `position`，在触摸区域（`hitArea`，默认是半径 1.5 × `radius` 的圆）里按下才算。
   */
  mode?: 'dynamic' | 'fixed'
  /** 推向各个方向时写入的动作（力度 0–1）。不设置时只能读 `vectorX` / `vectorY`。 */
  actions?: JoystickActions
  /** 摇杆头最多离开中心多远（像素），推到这里力度是 1。默认 100。 */
  radius?: number
  /** 死区：推动距离小于 `radius` 的这个比例时力度为 0，超过后从 0 开始线性增加。默认 0.2。 */
  deadzone?: number
  /** `dynamic` 模式下能按出摇杆的区域（和指针同一个坐标系：CanvasLayer 里是设计坐标）。默认是可见区域的左半边。 */
  region?: Rect2 | null
  /** 底座和摇杆头的贴图，都以中心对齐。不设置就不显示（只做输入）。 */
  texture?: Texture | null
  textureKnob?: Texture | null
}

/**
 * 虚拟摇杆：手指拖动时给出方向和力度，写进四个方向的输入动作，游戏用 `input.getVector(...)` 读取，
 * 和键盘共用同一组动作。
 *
 * ```ts
 * // 启动参数：actions: { left: [key('KeyA')], right: [key('KeyD')], up: [key('KeyW')], down: [key('KeyS')] }
 * const hud = this.add(new CanvasLayer())
 * hud.add(new TouchJoystick({ actions: { left: 'left', right: 'right', up: 'up', down: 'down' }, texture: base, textureKnob: knob }))
 * // 每个物理步：
 * const dir = this.tree.input.getVector('left', 'right', 'up', 'down')
 * ```
 *
 * - 只认一个手指：按着摇杆的手指不触发 `pointerPress()`、不点中下面的节点、也不会按到屏幕按钮；另一个手指可以同时按屏幕按钮。
 * - 手指抬起、触摸取消、游戏切到后台、摇杆被隐藏 / 暂停 / 移出树时松开，力度归零。
 * - 放在 CanvasLayer 里（固定在屏幕上）。按绘制顺序参与拾取：`dynamic` 的区域里，画在它上面的按钮和可点击节点先收到指针。
 * - 摇杆自己不要旋转、缩放（方向按它的局部坐标算）。
 * - 只配 `left` / `right` 的 `fixed` 摇杆可以当方向键用：手指在两边之间滑动不用抬起。
 *
 * 只用节点拾取的公开能力（`inputPickable`、覆写 `hitTest`、指针信号）和 `InputSource` 实现，不依赖引擎内部。
 */
export class TouchJoystick extends Node2D implements InputSource {
  readonly mode: 'dynamic' | 'fixed'
  actions: JoystickActions
  radius: number
  deadzone: number
  region: Rect2 | null
  /** 第一个手指按住时触发。 */
  readonly pressed = new Signal()
  /** 松开时触发。 */
  readonly released = new Signal()
  /** 摇杆的输出（已经扣掉死区，长度不超过 1）。没按着时是 0。 */
  vectorX = 0
  vectorY = 0
  /** @internal 按着它的指针，没有按着时为 null。 */
  _pointerId: number | null = null
  private readonly _base: Sprite2D | null
  private readonly _knob: Sprite2D | null

  constructor(options: TouchJoystickOptions = {}) {
    super({ ...options, inputPickable: true })
    this.mode = options.mode ?? 'dynamic'
    this.actions = options.actions ?? {}
    this.radius = options.radius ?? 100
    this.deadzone = options.deadzone ?? 0.2
    this.region = options.region ?? null
    if (this.mode === 'fixed' && !options.hitArea) this.hitArea = { radius: this.radius * 1.5 }
    this._base = options.texture ? this.add(new Sprite2D({ name: 'Base', texture: options.texture })) : null
    this._knob = options.textureKnob ? this.add(new Sprite2D({ name: 'Knob', texture: options.textureKnob })) : null
    this._showVisuals(this.mode === 'fixed')
    // 坐标和节点拾取一致：CanvasLayer 里是设计坐标，否则是世界坐标
    this.pointerDown.connect((e) => this._press(e.pointerId, e.position), this)
    this.pointerMove.connect((e) => {
      if (e.pointerId === this._pointerId) this._drag(e.position)
    }, this)
    this.pointerUp.connect((e) => {
      if (e.pointerId === this._pointerId) this._release()
    }, this)
  }

  /** 摇杆的输出（新的 Vector2）。每帧读的话用 `vectorX` / `vectorY`，不分配内存。 */
  get vector(): Vector2 {
    return new Vector2(this.vectorX, this.vectorY)
  }

  /** 是否有手指正按着它。 */
  get isPressed(): boolean {
    return this._pointerId !== null
  }

  override _onEnterTree(): void {
    const input = this.tree.input
    for (const action of [this.actions.left, this.actions.right, this.actions.up, this.actions.down]) {
      // 不在这里抛错：进入树的过程中抛错会让节点停在“一半在树里”的状态
      if (action !== undefined && !input.hasAction(action)) {
        console.warn(`TouchJoystick "${this.name}": unknown input action "${action}"; it will not be driven. Define it in the game options (actions: { ${action}: [] }) or with tree.input.addAction().`)
      }
    }
    input.addSource(this)
  }

  /** 离开树：按着的话松开（动作状态在下一帧开始时更新）。 */
  override _onExitTree(): void {
    this.tree.input.removeSource(this)
    this._release()
  }

  /**
   * 这个位置的按下归不归它：已经被按着时第二个手指不归它；`fixed` 看 `hitArea`；
   * `dynamic` 看 `region` 包不包含这个点（局部坐标换回摇杆所在的坐标系）。
   */
  override hitTest(localPoint: Vector2): boolean {
    if (this._pointerId !== null) return false
    if (this.mode === 'fixed') return super.hitTest(localPoint)
    const region = this.region ?? this._defaultRegion()
    return region.contains(this.globalTransform.apply(localPoint))
  }

  /** @internal InputSource：推向 `action` 对应方向的分量（0–1），和它无关的动作是 0。 */
  strength(action: string): number {
    const a = this.actions
    if (this._pointerId === null) return 0
    let s = 0
    if (action === a.right && this.vectorX > s) s = this.vectorX
    if (action === a.left && -this.vectorX > s) s = -this.vectorX
    if (action === a.down && this.vectorY > s) s = this.vectorY
    if (action === a.up && -this.vectorY > s) s = -this.vectorY
    return s
  }

  private _press(pointerId: number, point: Vector2): void {
    this._pointerId = pointerId
    if (this.mode === 'dynamic') {
      const parent = this.parent
      this.position = parent instanceof Node2D ? parent.toLocal(point) : point
    }
    this._showVisuals(true)
    this._drag(point)
    this.pressed.emit()
  }

  private _drag(point: Vector2): void {
    const local = this.toLocal(point)
    const len = local.length()
    const r = this.radius
    // 摇杆头跟着手指，最远到 radius
    const k = len > r ? r / len : 1
    if (this._knob) this._knob.position = new Vector2(local.x * k, local.y * k)
    const amount = Math.min(len, r) / r
    const dz = this.deadzone
    if (len === 0 || amount <= dz) {
      this.vectorX = 0
      this.vectorY = 0
      return
    }
    const strength = (amount - dz) / (1 - dz)
    this.vectorX = (local.x / len) * strength
    this.vectorY = (local.y / len) * strength
  }

  private _release(): void {
    if (this._pointerId === null) return
    this._pointerId = null
    this.vectorX = 0
    this.vectorY = 0
    if (this._knob) this._knob.position = Vector2.ZERO
    this._showVisuals(this.mode === 'fixed')
    this.released.emit()
  }

  /** 默认的按压区域：可见区域的左半边（CanvasLayer 里按屏幕，否则按看得到的世界范围）。 */
  private _defaultRegion(): Rect2 {
    const vp = this.tree.viewport
    const r = this._canvasLayer ? vp.visibleRect : vp.visibleWorldRect
    return new Rect2(r.x, r.y, r.width / 2, r.height)
  }

  private _showVisuals(visible: boolean): void {
    if (this._base) this._base.visible = visible
    if (this._knob) this._knob.visible = visible
  }

  protected override dumpProps(): Record<string, unknown> {
    return {
      ...super.dumpProps(),
      mode: this.mode === 'fixed' ? 'fixed' : undefined,
      pressed: this.isPressed || undefined,
      vector: this.isPressed ? `(${this.vectorX.toFixed(2)}, ${this.vectorY.toFixed(2)})` : undefined,
    }
  }
}
