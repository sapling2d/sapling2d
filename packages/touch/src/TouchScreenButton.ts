import { Signal, Sprite2D, type ActionName, type InputSource, type PointerEvent2D, type Sprite2DOptions, type Texture } from 'sapling2d'
import { _ensureSkin, TOUCH_SKIN } from './skin'

export interface TouchScreenButtonOptions extends Sprite2DOptions {
  /** 按住时处于按下状态的输入动作（和键盘绑定共用同一个动作名）。不设置时只发信号。 */
  action?: ActionName
  /** 按下时显示的贴图。不设置时按下也显示 `texture`。 */
  texturePressed?: Texture | null
}

/**
 * 屏幕按钮（虚拟按键）：手指按住时 `action` 处于按下状态，和键盘绑定同一个动作时两者都能触发。名字照搬 Godot。
 *
 * ```ts
 * // 启动参数：actions: { jump: [key('Space')] }, plugins: [touch()]
 * const hud = this.add(new CanvasLayer())
 * hud.add(new TouchScreenButton({ action: 'jump', position: v(680, 1200) })) // 默认皮肤
 * hud.add(new TouchScreenButton({ texture: Main.assets.jump, action: 'jump', position: v(680, 1200), hitArea: new Rect2(-80, -80, 160, 160) }))
 * ```
 *
 * - 贴图：不传 `texture` 用默认皮肤（`touch()` 插件预加载），传 `null` 只做输入不显示。
 * - 触摸区域：设置了 `hitArea` 就用它（可以比贴图大），否则用贴图的范围。
 * - 多点触控：每个手指独立；同一个按钮被几个手指按住时，最后一个手指离开才松开。一个手指只按最上层的那个按钮。
 * - 手指滑出按钮、抬起、触摸取消、游戏切到后台时都会松开；滑出后滑回来不再按下，从别处滑进来也不算按下
 *   （需要滑动换方向的方向键，用只配 `left` / `right` 的 `fixed` 模式 `TouchJoystick`）。
 * - 按在按钮上的手指不再触发 `pointerPress()` 绑定，也不会点中下面的节点。
 * - 按绘制顺序参与拾取：画在它上面的可点击节点（例如更高 CanvasLayer 里的对话框）先收到指针。
 * - 通常放在 CanvasLayer 里（固定在屏幕上）；隐藏、不能处理（暂停）时不能按下，按着的会在下一帧松开。
 *
 * 只用节点拾取的公开能力（`inputPickable`、指针信号）和 `InputSource` 实现，不依赖引擎内部：可以照着写自己的控件。
 */
export class TouchScreenButton extends Sprite2D implements InputSource {
  readonly action: ActionName | null
  texturePressed: Texture | null
  /** 按下（第一个手指按住）时触发。 */
  readonly pressed = new Signal()
  /** 松开（最后一个手指离开）时触发。 */
  readonly released = new Signal()
  /** 正按住它的指针 id。 */
  private readonly _pointerIds = new Set<number>()
  private _normalTexture: Texture | null = null
  /** 用了默认皮肤（没传 `texture`）。 */
  private readonly _defaultSkin: boolean

  constructor(options: TouchScreenButtonOptions = {}) {
    const defaultSkin = options.texture === undefined
    super({ ...options, texture: defaultSkin ? TOUCH_SKIN.button : options.texture, inputPickable: true })
    this._defaultSkin = defaultSkin
    this.action = options.action ?? null
    this.texturePressed = options.texturePressed ?? null
    this.pointerDown.connect((e) => this._onDown(e), this)
    this.pointerMove.connect((e) => this._onMove(e), this)
    this.pointerUp.connect((e) => this._release(e.pointerId), this)
  }

  /** 是否有手指正按着它。 */
  get isPressed(): boolean {
    return this._pointerIds.size > 0
  }

  override _onEnterTree(): void {
    const input = this.tree.input
    // 不在这里抛错：进入树的过程中抛错会让节点停在“一半在树里”的状态
    if (this.action !== null && !input.hasAction(this.action)) {
      console.warn(`TouchScreenButton "${this.name}": unknown input action "${this.action}"; pressing it changes no action. Define it in the game options (actions: { ${this.action}: [] }) or with tree.input.addAction().`)
    }
    if (this._defaultSkin) _ensureSkin(this.tree, `TouchScreenButton "${this.name}"`)
    input.addSource(this)
  }

  /** 离开树：按着的话松开（动作状态在下一帧开始时更新）。 */
  override _onExitTree(): void {
    this.tree.input.removeSource(this)
    if (this._pointerIds.size > 0) {
      this._pointerIds.clear()
      this._setPressed(false)
    }
  }

  /** @internal InputSource：按着时给 `action` 的力度是 1。 */
  strength(action: string): number {
    return action === this.action && this._pointerIds.size > 0 ? 1 : 0
  }

  private _onDown(e: PointerEvent2D): void {
    if (this._pointerIds.has(e.pointerId)) return
    this._pointerIds.add(e.pointerId)
    if (this._pointerIds.size === 1) this._setPressed(true)
  }

  /** 滑出按钮就松开。这根手指仍被捕获着（移动和抬起还会发过来），但按钮不再认它：滑回来也不按下。 */
  private _onMove(e: PointerEvent2D): void {
    if (this._pointerIds.has(e.pointerId) && !this.hitTest(e.localPosition)) this._release(e.pointerId)
  }

  private _release(pointerId: number): void {
    if (!this._pointerIds.delete(pointerId)) return
    if (this._pointerIds.size === 0) this._setPressed(false)
  }

  private _setPressed(pressed: boolean): void {
    if (pressed) {
      if (this.texturePressed) {
        this._normalTexture = this.texture
        this.texture = this.texturePressed
      }
      this.pressed.emit()
    } else {
      if (this.texturePressed && this.texture === this.texturePressed) this.texture = this._normalTexture
      this._normalTexture = null
      this.released.emit()
    }
  }

  protected override dumpProps(): Record<string, unknown> {
    return { ...super.dumpProps(), action: this.action ?? undefined, pressed: this.isPressed || undefined }
  }
}
