import { ColorRect, NineSliceSprite, Rect2, Signal, Vector2, type NineSliceMargins, type Texture } from 'sapling2d'
import { Control, type ControlOptions } from './Control'
import { _ensureSkin, UI_SKIN } from './theme'

/** 填充方向。 */
export type FillMode = 'leftToRight' | 'rightToLeft' | 'bottomToTop' | 'topToBottom'

/** 填充相对底图的内缩（像素）；一个数字表示四边相同。 */
export type FillPadding = number | { left: number; top: number; right: number; bottom: number }

export interface ProgressBarOptions extends ControlOptions {
  /** 当前值，默认 0；夹在 `[minValue, maxValue]` 内。 */
  value?: number
  /** 范围，默认 0..1。血条可以直接用 `maxValue: 100`。 */
  minValue?: number
  maxValue?: number
  /** 默认 'leftToRight'。 */
  fillMode?: FillMode
  /** 底图（九宫格）。不传用默认皮肤；`null` 为纯色（`backgroundColor`）。 */
  textureBackground?: Texture | null
  /** 填充（九宫格）。不传用默认皮肤（纯白，用 `fillColor` 染色）；`null` 为纯色。 */
  textureFill?: Texture | null
  marginsBackground?: NineSliceMargins | number
  marginsFill?: NineSliceMargins | number
  /** 纯色底的颜色，默认 0x202028。 */
  backgroundColor?: number
  /** 填充的颜色：贴图填充用它染色（`selfModulate`），纯色填充就是这个颜色。默认 0x5ad26a。 */
  fillColor?: number
  /** 填充相对底图的内缩。默认皮肤 6，自己的贴图 / 纯色 0。 */
  fillPadding?: FillPadding
}

/**
 * 进度条：底图 + 按比例显示的填充。填充节点始终铺满整条，用它的 `clipRect` 裁掉未填充的部分，
 * 所以九宫格填充不会变形（圆角、高光在半满时还是原样）。
 *
 * ```ts
 * // 启动参数：plugins: [ui()]
 * const hp = hud.add(new ProgressBar({ size: v(400, 36), maxValue: 100, value: 100, anchor: { left: 24, top: 24 } }))
 * hp.createTween().to(hp, { value: 30 }, 0.2) // value 可以补间
 * ```
 *
 * - 原点在**左上角**；`value` 夹在范围内，`ratio` 是 0–1；`valueChanged` 只在值真的变化时发。
 * - 四个方向：`leftToRight`（默认）、`rightToLeft`、`bottomToTop`、`topToBottom`。
 * - 值为 0 时填充不显示，为满时不裁剪（没有遮罩开销）。
 */
export class ProgressBar extends Control {
  /** 底图（默认皮肤 / 自己的贴图是 `NineSliceSprite`，纯色是 `ColorRect`）。 */
  readonly background: NineSliceSprite | ColorRect
  /** 填充节点：始终铺满整条（减去 `fillPadding`），由 `clipRect` 裁出已填充的部分。 */
  readonly fill: NineSliceSprite | ColorRect
  /** 值变化时触发（夹紧后真的变了才发）。 */
  readonly valueChanged = new Signal<[value: number]>()

  private _value: number
  private _min: number
  private _max: number
  private _fillMode: FillMode
  private _fillColor: number
  private _padding: FillPadding
  private readonly _defaultSkin: boolean

  constructor(options: ProgressBarOptions = {}) {
    super({ size: new Vector2(300, 32), ...options })
    const defaultBackground = options.textureBackground === undefined
    const defaultFill = options.textureFill === undefined
    this._defaultSkin = defaultBackground || defaultFill
    this._min = options.minValue ?? 0
    this._max = options.maxValue ?? 1
    this._value = clamp(options.value ?? 0, this._min, this._max)
    this._fillMode = options.fillMode ?? 'leftToRight'
    this._fillColor = options.fillColor ?? 0x5ad26a
    this._padding = options.fillPadding ?? (defaultBackground ? 6 : 0)

    const bgTexture = defaultBackground ? UI_SKIN.panel.texture : options.textureBackground!
    this.background = this.add(
      bgTexture
        ? new NineSliceSprite({ name: 'Background', texture: bgTexture, margins: options.marginsBackground ?? (defaultBackground ? UI_SKIN.panel.margins : 0) })
        : new ColorRect({ name: 'Background', color: options.backgroundColor ?? 0x202028 }),
    )
    const fillTexture = defaultFill ? UI_SKIN.barFill.texture : options.textureFill!
    this.fill = this.add(
      fillTexture
        ? new NineSliceSprite({ name: 'Fill', texture: fillTexture, margins: options.marginsFill ?? (defaultFill ? UI_SKIN.barFill.margins : 0) })
        : new ColorRect({ name: 'Fill' }),
    )
    this._applyFillColor()
    this._layout()
  }

  get value(): number {
    return this._value
  }

  set value(v: number) {
    const next = clamp(v, this._min, this._max)
    if (next === this._value) return
    this._value = next
    this._updateClip()
    this.valueChanged.emit(next)
  }

  get minValue(): number {
    return this._min
  }

  set minValue(v: number) {
    this._min = v
    this.value = this._value // 重新夹紧
    this._updateClip()
  }

  get maxValue(): number {
    return this._max
  }

  set maxValue(v: number) {
    this._max = v
    this.value = this._value
    this._updateClip()
  }

  /** 已填充的比例 0–1（范围为空时是 0）。 */
  get ratio(): number {
    const span = this._max - this._min
    return span > 0 ? (this._value - this._min) / span : 0
  }

  get fillMode(): FillMode {
    return this._fillMode
  }

  set fillMode(mode: FillMode) {
    if (mode === this._fillMode) return
    this._fillMode = mode
    this._updateClip()
  }

  /** 填充颜色：贴图填充的染色 / 纯色填充的颜色。 */
  get fillColor(): number {
    return this._fillColor
  }

  set fillColor(color: number) {
    this._fillColor = color
    this._applyFillColor()
  }

  get fillPadding(): FillPadding {
    return this._padding
  }

  set fillPadding(p: FillPadding) {
    this._padding = p
    this._layout()
  }

  override _onEnterTree(): void {
    super._onEnterTree()
    if (this._defaultSkin) _ensureSkin(this.tree, `ProgressBar "${this.name}"`)
  }

  protected override sizeChanged(): void {
    this._layout()
  }

  private _applyFillColor(): void {
    if (this.fill instanceof ColorRect) this.fill.color = this._fillColor
    else this.fill.selfModulate = this._fillColor
  }

  private _layout(): void {
    const s = this.size
    this.background.position = Vector2.ZERO
    this.background.size = s
    const p = this._padding
    const pad = typeof p === 'number' ? { left: p, top: p, right: p, bottom: p } : p
    this.fill.position = new Vector2(pad.left, pad.top)
    this.fill.size = new Vector2(Math.max(0, s.x - pad.left - pad.right), Math.max(0, s.y - pad.top - pad.bottom))
    this._updateClip()
  }

  /** 填充始终铺满，按 `ratio` 用 clipRect 裁出已填充的部分：0 不显示，1 不裁剪。 */
  private _updateClip(): void {
    const r = this.ratio
    const fill = this.fill
    if (r <= 0) {
      fill.visible = false
      fill.clipRect = null
      return
    }
    fill.visible = true
    if (r >= 1) {
      fill.clipRect = null
      return
    }
    const w = fill.size.x
    const h = fill.size.y
    switch (this._fillMode) {
      case 'leftToRight':
        fill.clipRect = new Rect2(0, 0, w * r, h)
        break
      case 'rightToLeft':
        fill.clipRect = new Rect2(w * (1 - r), 0, w * r, h)
        break
      case 'bottomToTop':
        fill.clipRect = new Rect2(0, h * (1 - r), w, h * r)
        break
      case 'topToBottom':
        fill.clipRect = new Rect2(0, 0, w, h * r)
        break
    }
  }

  protected override dumpProps(): Record<string, unknown> {
    return { ...super.dumpProps(), value: this._value, fillMode: this._fillMode !== 'leftToRight' ? this._fillMode : undefined }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, Math.min(min, max)), Math.max(min, max))
}
