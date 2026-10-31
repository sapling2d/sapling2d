import { ColorRect, Label, NineSliceSprite, Node2D, Signal, Vector2, type AudioStream, type LabelStroke, type NineSliceMargins, type PointerEvent2D, type Texture, type Tween } from 'sapling2d'
import { Control, type ControlOptions } from './Control'
import { _ensureSkin, _themeOf, DEFAULT_PRESS_EFFECT, UI_SKIN, type PressEffect, type UiTheme } from './theme'

export interface ButtonOptions extends ControlOptions {
  text?: string
  /** 字号，默认 36。 */
  fontSize?: number
  fontFamily?: string
  /** 默认 'bold'。 */
  fontWeight?: 'normal' | 'bold'
  /** 文字颜色。默认：默认皮肤上是深色，自己的贴图 / 纯色模式上是白色。 */
  color?: number
  stroke?: LabelStroke | null
  /** 底图（九宫格）。不传用默认皮肤；`null` 为纯色模式（`backgroundColor`）。 */
  texture?: Texture | null
  /** 底图的九宫格边距。默认皮肤自带；自己的贴图默认 0（整张拉伸）。 */
  margins?: NineSliceMargins | number
  /** 按下时换的底图。默认皮肤自带；传 `null` 不换图。 */
  texturePressed?: Texture | null
  /** 纯色模式的底色，默认 0x4a6cf7。 */
  backgroundColor?: number
  /** 按下反馈。不传用 `ui()` 的全局默认；`false` 关闭。 */
  pressEffect?: PressEffect | false
  /** 点击音效（放进场景的 `static assets` 预加载）。不传用 `ui()` 的全局默认；`null` 关闭。 */
  clickSound?: AudioStream | null
  disabled?: boolean
  /** 禁用时的透明度，默认 0.5。 */
  disabledAlpha?: number
}

/**
 * 按钮：九宫格底图（或纯色）+ 居中的文字，`clicked` 信号（继承自 Node2D：按下并在按钮内抬起）。
 *
 * ```ts
 * // 启动参数：plugins: [ui()]
 * const start = hud.add(new Button({ text: '开始', size: v(300, 100), anchor: { centerX: 0, bottom: 200 } }))
 * start.clicked.connect(() => this.tree.changeScene(Battle))
 * ```
 *
 * - 原点在**左上角**（和 `ColorRect` 一样）。按下反馈作用在内部的视觉主体 `body` 上（原点在中心），所以缩放围绕按钮中心，
 *   节点自身的 `scale`、`rect` 不变。要往按钮上加图标，加到 `body` 下（坐标以中心为原点）。
 * - 手指路径：按下 → 视觉按下（`pressed`）；滑出 → 视觉恢复（仍持有这根手指）；滑回 → 再按下；在按钮内抬起 → `clicked`；
 *   抬起在外、切后台、被隐藏或盖住、途中 `disabled` → 只恢复（`released`），不 `clicked`。只认第一根手指。
 * - `disabled`：半透明且点不到；`clickSound` 在 `clicked` 时播放（`SFX` 总线）。
 * - 只用引擎的公开 API 实现，可以照着写自己的控件。
 */
export class Button extends Control {
  /** 视觉主体：原点在按钮中心，按下反馈缩放它。图标等装饰加在它下面。 */
  readonly body: Node2D
  /** 底图（默认皮肤 / 自己的贴图是 `NineSliceSprite`，纯色模式是 `ColorRect`）。 */
  readonly background: NineSliceSprite | ColorRect
  readonly label: Label
  /** 按下（手指按在按钮上）时触发。 */
  readonly pressed = new Signal()
  /** 松开时触发：抬起、切后台、被盖住、途中禁用都算；`clicked` 另发。 */
  readonly released = new Signal()
  /** 按下反馈；`undefined` 用 `ui()` 的全局默认。 */
  pressEffect: PressEffect | false | undefined
  /** 点击音效；`undefined` 用 `ui()` 的全局默认，`null` 不播。 */
  clickSound: AudioStream | null | undefined
  disabledAlpha: number

  private readonly _texture: Texture | null
  private readonly _texturePressed: Texture | null
  private readonly _defaultSkin: boolean
  private _disabled: boolean
  private _pointerId: number | null = null
  private _visualPressed = false
  private _tween: Tween | null = null
  private _theme: UiTheme | null = null

  constructor(options: ButtonOptions = {}) {
    const disabled = options.disabled ?? false
    const defaultSkin = options.texture === undefined
    super({ size: new Vector2(300, 100), ...options, inputPickable: !disabled })
    this._defaultSkin = defaultSkin
    this._disabled = disabled
    this.disabledAlpha = options.disabledAlpha ?? 0.5
    if (disabled) this.alpha = this.disabledAlpha
    this.pressEffect = options.pressEffect
    this.clickSound = options.clickSound
    this._texture = defaultSkin ? UI_SKIN.button.texture : options.texture!
    this._texturePressed = options.texturePressed === undefined ? (defaultSkin ? UI_SKIN.buttonPressed.texture : null) : options.texturePressed

    this.body = this.add(new Node2D({ name: 'Body' }))
    if (this._texture) {
      this.background = this.body.add(new NineSliceSprite({ name: 'Background', texture: this._texture, margins: options.margins ?? (defaultSkin ? UI_SKIN.button.margins : 0) }))
    } else {
      this.background = this.body.add(new ColorRect({ name: 'Background', color: options.backgroundColor ?? 0x4a6cf7 }))
    }
    this.label = this.body.add(
      new Label({
        name: 'Label',
        text: options.text ?? '',
        fontSize: options.fontSize ?? 36,
        fontWeight: options.fontWeight ?? 'bold',
        color: options.color ?? (defaultSkin ? 0x2b2b33 : 0xffffff),
        align: 'center',
        verticalAlign: 'center',
        ...(options.fontFamily ? { fontFamily: options.fontFamily } : {}),
        ...(options.stroke ? { stroke: options.stroke } : {}),
      }),
    )
    this._layout()

    this.pointerDown.connect((e) => this._onDown(e), this)
    this.pointerMove.connect((e) => this._onMove(e), this)
    this.pointerUp.connect((e) => this._onUp(e), this)
    this.clicked.connect(() => this._onClicked(), this)
  }

  get text(): string {
    return this.label.text
  }

  set text(value: string) {
    this.label.text = value
  }

  /** 手指正按在按钮上（按下且没滑出）。 */
  get isPressed(): boolean {
    return this._visualPressed
  }

  get disabled(): boolean {
    return this._disabled
  }

  /** 禁用：半透明（`disabledAlpha`）、点不到；正按着时视为取消。 */
  set disabled(value: boolean) {
    if (value === this._disabled) return
    this._disabled = value
    this.inputPickable = !value
    this.alpha = value ? this.disabledAlpha : 1
    if (value && this._pointerId !== null) {
      this._pointerId = null
      this._setVisualPressed(false)
      this.released.emit()
    }
  }

  /** 禁用时整个按钮都点不到（路由器在抬起时也用它判断 `clicked`）。 */
  override hitTest(localPoint: Vector2): boolean {
    return !this._disabled && super.hitTest(localPoint)
  }

  override _onEnterTree(): void {
    super._onEnterTree()
    this._theme = _themeOf(this.tree)
    if (this._defaultSkin) _ensureSkin(this.tree, `Button "${this.name}"`)
  }

  override _onExitTree(): void {
    super._onExitTree()
    // 离开树时还按着：当作松开
    if (this._pointerId !== null) {
      this._pointerId = null
      this._visualPressed = false
      this._tween?.kill()
      this._tween = null
      this.body.scale = Vector2.ONE
      this.background.selfModulate = 0xffffff
      this.released.emit()
    }
  }

  protected override sizeChanged(): void {
    this._layout()
  }

  private _layout(): void {
    const s = this.size
    this.body.position = new Vector2(s.x / 2, s.y / 2)
    this.background.position = new Vector2(-s.x / 2, -s.y / 2)
    this.background.size = s
  }

  private _onDown(e: PointerEvent2D): void {
    if (this._pointerId !== null) return // 只认第一根手指
    this._pointerId = e.pointerId
    this._setVisualPressed(true)
    this.pressed.emit()
  }

  private _onMove(e: PointerEvent2D): void {
    if (e.pointerId !== this._pointerId) return
    this._setVisualPressed(this.hitTest(e.localPosition))
  }

  private _onUp(e: PointerEvent2D): void {
    if (e.pointerId !== this._pointerId) return
    this._pointerId = null
    this._setVisualPressed(false)
    this.released.emit()
  }

  private _onClicked(): void {
    const sound = this.clickSound !== undefined ? this.clickSound : (this._theme?.clickSound ?? null)
    if (sound) this.tree.audio.play(sound, { bus: 'SFX' })
  }

  private _setVisualPressed(on: boolean): void {
    if (on === this._visualPressed) return
    this._visualPressed = on
    if (this._texturePressed && this.background instanceof NineSliceSprite) this.background.texture = on ? this._texturePressed : this._texture
    const effect = this.pressEffect !== undefined ? this.pressEffect : this._theme ? this._theme.pressEffect : DEFAULT_PRESS_EFFECT
    if (!effect) return
    this._tween?.kill()
    this._tween = null
    const duration = effect.duration ?? DEFAULT_PRESS_EFFECT.duration
    const scale = on ? (effect.scale ?? 1) : 1
    const tint = on ? (effect.tint ?? 0xffffff) : 0xffffff
    if (duration <= 0) {
      // 立刻生效，不补间（想要"按下就变"的硬反馈）
      this.body.scale = new Vector2(scale, scale)
      this.background.selfModulate = tint
      return
    }
    this._tween = this.body
      .createTween()
      .to(this.body, { scale: new Vector2(scale, scale) }, duration)
      .parallel()
      .to(this.background, { selfModulate: tint }, duration)
  }

  protected override dumpProps(): Record<string, unknown> {
    return { ...super.dumpProps(), pressed: this._visualPressed || undefined, disabled: this._disabled || undefined }
  }
}
