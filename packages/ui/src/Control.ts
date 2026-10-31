import { CanvasLayer, Node2D, Rect2, Vector2, type Node2DOptions } from 'sapling2d'

/**
 * 锚点：到 `safeRect`（或 `visibleRect`）各边 / 中心的距离，设计像素。
 * 横向给 `left` / `right` / `centerX` 之一；同时给 `left` 和 `right` 时拉伸宽度。纵向同理。
 */
export interface Anchor {
  left?: number
  right?: number
  centerX?: number
  top?: number
  bottom?: number
  centerY?: number
}

export interface ControlOptions extends Node2DOptions {
  /** 宽和高（像素）。默认 (0, 0)。 */
  size?: Vector2
  /** 进树时和屏幕变化时按它重新摆放（只对 CanvasLayer 里的控件有意义）。默认不锚定。 */
  anchor?: Anchor | null
  /** 锚定的基准：安全区（默认）或整个可见区域。 */
  anchorTo?: 'safe' | 'visible'
}

/**
 * 界面控件的基类：有 `size`（原点在左上角，和 `ColorRect` 一样）、`rect`，点击区域默认就是这个矩形；
 * 可以按 `anchor` 贴着安全区的边或中心摆放，屏幕变化时自动重排。
 * 自己不画任何东西：直接实例化就是一个布局盒子（一组按钮、弹窗的内容区），子类（`Button`、`ProgressBar`）往里放节点。
 *
 * ```ts
 * const hud = this.add(new CanvasLayer())
 * hud.add(new Button({ text: '开始', size: v(300, 100), anchor: { centerX: 0, bottom: 200 } }))
 * hud.add(new Control({ size: v(200, 80), anchor: { right: 24, top: 24 } })) // 右上角的盒子
 * ```
 */
export class Control extends Node2D {
  anchorTo: 'safe' | 'visible'
  private _size: Vector2
  private _anchor: Anchor | null
  private _onResized: (() => void) | null = null
  private _warnedAnchor = false

  constructor(options: ControlOptions = {}) {
    super(options)
    this._size = options.size ?? Vector2.ZERO
    this._anchor = options.anchor ?? null
    this.anchorTo = options.anchorTo ?? 'safe'
  }

  /** 宽和高（像素）。改了之后子类重新摆放内部节点；有锚点时重新贴边。 */
  get size(): Vector2 {
    return this._size
  }

  set size(value: Vector2) {
    if (value.equals(this._size)) return
    this._size = value
    this._version++
    this.sizeChanged()
    if (this._anchor && this.isInsideTree) this._applyAnchor()
  }

  /** 局部坐标的矩形 `(0, 0, width, height)`。 */
  get rect(): Rect2 {
    return new Rect2(0, 0, this._size.x, this._size.y)
  }

  get anchor(): Anchor | null {
    return this._anchor
  }

  set anchor(value: Anchor | null) {
    this._anchor = value
    if (value && this.isInsideTree) this._applyAnchor()
  }

  /** 设了 `hitArea` 用它，否则点击区域就是 `rect`。 */
  override hitTest(localPoint: Vector2): boolean {
    if (this.hitArea) return super.hitTest(localPoint)
    return localPoint.x >= 0 && localPoint.y >= 0 && localPoint.x < this._size.x && localPoint.y < this._size.y
  }

  override _onEnterTree(): void {
    if (this._anchor) this._applyAnchor()
    this._onResized = () => {
      if (this._anchor) this._applyAnchor()
    }
    this.tree.viewport.resized.connect(this._onResized, this)
  }

  override _onExitTree(): void {
    if (this._onResized) {
      this.tree.viewport.resized.disconnect(this._onResized)
      this._onResized = null
    }
  }

  /** `size` 变化后调用（也包括锚点拉伸）。子类覆写来重新摆放内部节点。 */
  protected sizeChanged(): void {}

  private _applyAnchor(): void {
    const a = this._anchor!
    const vp = this.tree.viewport
    const r = this.anchorTo === 'visible' ? vp.visibleRect : vp.safeRect
    if (!this._warnedAnchor && !this._inCanvasLayer()) {
      this._warnedAnchor = true
      console.warn(`${this.constructor.name} "${this.name}": anchor is set but the control is not inside a CanvasLayer. Anchors are screen positions (design coordinates); in the scene they follow the camera and the result is not what you expect.`)
    }
    let w = this._size.x
    let h = this._size.y
    let x = this.x
    let y = this.y
    if (a.left !== undefined && a.right !== undefined) {
      x = r.left + a.left
      w = r.width - a.left - a.right
    } else if (a.left !== undefined) x = r.left + a.left
    else if (a.right !== undefined) x = r.right - a.right - w
    else if (a.centerX !== undefined) x = r.left + r.width / 2 + a.centerX - w / 2
    if (a.top !== undefined && a.bottom !== undefined) {
      y = r.top + a.top
      h = r.height - a.top - a.bottom
    } else if (a.top !== undefined) y = r.top + a.top
    else if (a.bottom !== undefined) y = r.bottom - a.bottom - h
    else if (a.centerY !== undefined) y = r.top + r.height / 2 + a.centerY - h / 2
    if (w !== this._size.x || h !== this._size.y) {
      this._size = new Vector2(w, h)
      this._version++
      this.sizeChanged()
    }
    if (x !== this.x || y !== this.y) this.position = new Vector2(x, y)
  }

  private _inCanvasLayer(): boolean {
    for (let p = this.parent; p; p = p.parent) if (p instanceof CanvasLayer) return true
    return false
  }

  protected override dumpProps(): Record<string, unknown> {
    const a = this._anchor
    return {
      ...super.dumpProps(),
      size: this._size,
      anchor: a
        ? Object.entries(a)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}:${v}`)
            .join(',')
        : undefined,
    }
  }
}
