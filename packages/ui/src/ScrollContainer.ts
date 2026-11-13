import { CanvasLayer, Node2D, Signal, Vector2, type InputSource, type PointerEvent2D, type RawInputEvent } from 'sapling2d'
import { Control, type ControlOptions } from './Control'

export interface ScrollContainerOptions extends ControlOptions {
  /** 内容的宽和高（游戏自己给：引擎没有通用的包围盒）。默认 (0, 0)。 */
  contentSize?: Vector2
  /** 横向滚动，默认 false。 */
  horizontal?: boolean
  /** 竖向滚动，默认 true。 */
  vertical?: boolean
  /** 手指移动超过这个距离（设计像素，只看开启的轴）才算拖动、从子节点手里接管手势。默认 12。 */
  dragThreshold?: number
  /** 松手后按最近的速度继续滚动，默认 true。 */
  inertia?: boolean
  /** 惯性滚动时每秒损失的速度比例（0–1），越大停得越快。默认 0.87（和 iOS 原生列表接近）。 */
  deceleration?: number
  /** 拖过边界时带阻尼越界、松手回弹；关闭时拖动和惯性都夹在边界内。默认 true。 */
  bounce?: boolean
}

export interface ScrollToOptions {
  /** 平滑滚动过去（约 0.3 秒，缓出）。默认 false：立即跳到。 */
  animate?: boolean
}

/** 惯性速度低于它（像素 / 秒）时停下。 */
const MIN_VELOCITY = 8
/** 松手时按下滚动中的速度高于它（像素 / 秒）：这次按下只是“按停”，直接接管、不给子节点点击。 */
const CATCH_VELOCITY = 60
/** 回弹弹簧的角频率（临界阻尼）：越界后约 0.3 秒回到边界。 */
const SPRING = 14
/** 回弹积分的最大子步长（秒）：帧时间长时也稳定、结果只取决于 dt。 */
const SPRING_STEP = 1 / 120
/** 越界阻尼系数（iOS 的橡皮筋公式）。 */
const RUBBER = 0.55
const ANIMATE_DURATION = 0.3

/**
 * 滚动容器：把条目加到 `content` 下、告诉它 `contentSize`，单指拖动就能滚动（默认只开竖向），带惯性和到边回弹。
 * 容器用自己的 `clipRect`（= `rect`）裁掉可见区以外的内容，滚出去的条目看不见也点不到。
 *
 * ```ts
 * const list = hud.add(new ScrollContainer({ size: v(600, 800), position: v(60, 200) }))
 * for (let i = 0; i < 30; i++) {
 *   const row = list.content.add(new Button({ text: `第 ${i + 1} 关`, size: v(600, 100), position: v(0, i * 120) }))
 *   row.clicked.connect(() => this.startLevel(i))
 * }
 * list.contentSize = v(600, 30 * 120 - 20)
 * list.scrollTo(v(0, current * 120), { animate: true })
 * ```
 *
 * - 手势：按在条目（按钮）上，先由条目捕获；手指移动超过 `dragThreshold` 后容器用 `capturePointer` 接管，
 *   按钮收到抬起、不发 `clicked`；阈值内抬起就是普通的点击。按在空白处由容器自己捕获。只认一根手指。
 *   惯性滚动中按下只是把列表按停，不点到条目。
 * - `scrollOffset`：内容向左 / 向上移动的量，夹在 `0 .. contentSize - size`（内容比容器小时为 0），回弹期间可以短暂越界。
 * - 惯性、回弹、`scrollTo` 动画在 `process(dt)` 里推进（跟着 `timeScale`）；暂停菜单里的列表要 `processMode: 'always'`。
 * - 不画滚动条、不处理鼠标滚轮。
 */
export class ScrollContainer extends Control {
  /** 内容节点：条目都加到它下面。滚动就是移动它。 */
  readonly content: Node2D
  /** 滚动位置变化时触发（拖动、惯性、回弹、`scrollTo`）。 */
  readonly scrolled = new Signal<[offset: Vector2]>()
  horizontal: boolean
  vertical: boolean
  dragThreshold: number
  inertia: boolean
  deceleration: number
  bounce: boolean

  private _contentSize: Vector2
  private _ox = 0
  private _oy = 0
  private _vx = 0
  private _vy = 0
  /** 跟踪中的指针（按在容器或条目上），没有时 null。 */
  private _pointerId: number | null = null
  /** 已经超过阈值、由容器捕获并滚动。 */
  private _dragging = false
  /** 拖动刚结束、还没确认是真的抬起（`pointerup`）的指针：取消（隐藏、暂停、切后台）时不给惯性。 */
  private _releasedId: number | null = null
  /** 按下时的窗口坐标：阈值按它算，不分配。 */
  private _startX = 0
  private _startY = 0
  /** 开始拖动时手指的局部坐标和那时的（未阻尼的）滚动位置。 */
  private _anchorX = 0
  private _anchorY = 0
  private _anchorOX = 0
  private _anchorOY = 0
  /** 上一帧的滚动位置：拖动中按它估计速度。 */
  private _prevOX = 0
  private _prevOY = 0
  /** `scrollTo` 动画：进行中时 `_animT` < `ANIMATE_DURATION`。 */
  private _animating = false
  private _animT = 0
  private _fromX = 0
  private _fromY = 0
  private _toX = 0
  private _toY = 0
  private _inLayer = false
  private readonly _source: InputSource

  constructor(options: ScrollContainerOptions = {}) {
    super({ ...options, inputPickable: true })
    this._contentSize = options.contentSize ?? Vector2.ZERO
    this.horizontal = options.horizontal ?? false
    this.vertical = options.vertical ?? true
    this.dragThreshold = options.dragThreshold ?? 12
    this.inertia = options.inertia ?? true
    this.deceleration = options.deceleration ?? 0.87
    this.bounce = options.bounce ?? true
    this.content = this.add(new Node2D({ name: 'Content' }))
    this.clipRect = this.rect
    this._source = {
      eventTypes: ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'],
      handle: (e) => this._onRaw(e),
      releaseAll: () => this._onBackground(),
    }
    this.pointerMove.connect((e) => this._onMove(e), this)
    this.pointerUp.connect((e) => this._onUp(e), this)
  }

  /** 内容的宽和高。改了之后滚动位置重新夹紧。 */
  get contentSize(): Vector2 {
    return this._contentSize
  }

  set contentSize(value: Vector2) {
    if (value.equals(this._contentSize)) return
    this._contentSize = value
    this._version++
    this._reclamp()
  }

  /** 滚动位置（内容向左 / 向上移动的量）。赋值等于 `scrollTo(value)`。 */
  get scrollOffset(): Vector2 {
    return new Vector2(this._ox, this._oy)
  }

  set scrollOffset(value: Vector2) {
    this.scrollTo(value)
  }

  get scrollX(): number {
    return this._ox
  }

  set scrollX(value: number) {
    this.scrollTo(new Vector2(value, this._oy))
  }

  get scrollY(): number {
    return this._oy
  }

  set scrollY(value: number) {
    this.scrollTo(new Vector2(this._ox, value))
  }

  /** 最大滚动位置：`contentSize - size`，不小于 0。 */
  get maxScroll(): Vector2 {
    return new Vector2(this._maxX(), this._maxY())
  }

  /** 正在拖动、惯性滚动、回弹或 `scrollTo` 动画中。 */
  get isScrolling(): boolean {
    return this._dragging || this._animating || this._vx !== 0 || this._vy !== 0 || this._outOfBounds()
  }

  /** 滚到 `offset`（夹在 `0 .. maxScroll` 内）。停止惯性；正在拖动时不生效。 */
  scrollTo(offset: Vector2, options: ScrollToOptions = {}): void {
    if (this._dragging) return
    const x = clamp(offset.x, 0, this._maxX())
    const y = clamp(offset.y, 0, this._maxY())
    this._vx = 0
    this._vy = 0
    if (options.animate && (x !== this._ox || y !== this._oy)) {
      this._animating = true
      this._animT = 0
      this._fromX = this._ox
      this._fromY = this._oy
      this._toX = x
      this._toY = y
      return
    }
    this._animating = false
    this._setOffset(x, y)
  }

  override _onEnterTree(): void {
    super._onEnterTree()
    this._inLayer = false
    for (let p = this.parent; p; p = p.parent) {
      if (p instanceof CanvasLayer) {
        this._inLayer = true
        break
      }
    }
    this.tree.input.addSource(this._source)
  }

  override _onExitTree(): void {
    super._onExitTree()
    this.tree.input.removeSource(this._source)
    this._pointerId = null
    this._releasedId = null
    this._dragging = false
    this._settle()
  }

  protected override sizeChanged(): void {
    this.clipRect = this.rect
    this._reclamp()
  }

  override process(dt: number): void {
    if (this._dragging) {
      // 拖动中：按每帧的位移估计速度（偏向最近一帧，手指停住时速度很快归零）
      if (dt > 0) {
        this._vx = this._vx * 0.2 + ((this._ox - this._prevOX) / dt) * 0.8
        this._vy = this._vy * 0.2 + ((this._oy - this._prevOY) / dt) * 0.8
      }
      this._prevOX = this._ox
      this._prevOY = this._oy
      return
    }
    if (this._releasedId !== null) {
      // 拖动结束了，却没有对应的 pointerup：被取消的（容器隐藏 / 暂停），不给惯性
      this._releasedId = null
      this._vx = 0
      this._vy = 0
    }
    if (this._pointerId !== null || dt <= 0) return // 手指按着（还没超过阈值）：不动
    if (this._animating) {
      this._animT += dt
      const t = Math.min(1, this._animT / ANIMATE_DURATION)
      const k = 1 - (1 - t) ** 3
      if (t >= 1) this._animating = false
      this._setOffset(this._fromX + (this._toX - this._fromX) * k, this._fromY + (this._toY - this._fromY) * k)
      return
    }
    if (this._vx === 0 && this._vy === 0 && !this._outOfBounds()) return
    const x = this._stepAxis(this._ox, this._vx, this._maxX(), dt)
    const vx = _velocity
    const y = this._stepAxis(this._oy, this._vy, this._maxY(), dt)
    this._vx = vx
    this._vy = _velocity
    this._setOffset(x, y)
  }

  /** 一个轴的惯性 / 回弹推进一帧：返回新位置，新速度写进 `_velocity`（不分配）。 */
  private _stepAxis(o: number, v: number, max: number, dt: number): number {
    if (o < 0 || o > max) {
      if (!this.bounce) {
        _velocity = 0
        return clamp(o, 0, max)
      }
      // 越界：临界阻尼弹簧拉回边界（惯性冲出去的速度在这里被吃掉）
      const bound = o < 0 ? 0 : max
      let x = o - bound
      for (let left = dt; left > 0; left -= SPRING_STEP) {
        const h = Math.min(left, SPRING_STEP)
        v += (-SPRING * SPRING * x - 2 * SPRING * v) * h
        x += v * h
      }
      if (Math.abs(x) < 0.5 && Math.abs(v) < 20) {
        _velocity = 0
        return bound
      }
      _velocity = v
      return bound + x
    }
    if (v === 0) {
      _velocity = 0
      return o
    }
    o += v * dt
    v *= (1 - this.deceleration) ** dt
    if (Math.abs(v) < MIN_VELOCITY) v = 0
    if (o < 0 || o > max) {
      if (!this.bounce) {
        _velocity = 0
        return clamp(o, 0, max)
      }
    }
    _velocity = v
    return o
  }

  /** 原始指针事件（`InputSource`）：路由器已经把它发给节点之后才到这里。 */
  private _onRaw(e: RawInputEvent): void {
    if (e.type !== 'pointerdown' && e.type !== 'pointermove' && e.type !== 'pointerup' && e.type !== 'pointercancel') return
    const id = e.pointerId
    if (id === this._releasedId) {
      // 拖动结束的那根指针：真的抬起才有惯性，取消（切后台、丢了抬起）就停下
      this._releasedId = null
      if (e.type !== 'pointerup') {
        this._vx = 0
        this._vy = 0
      }
    }
    if (e.type === 'pointerdown') {
      if (this._pointerId !== null) return // 只认一根手指
      // 按在容器或它的条目上（被上层的弹窗挡住时捕获者不在子树里，不管）
      if (!this.hasPointerCapture(id, true)) return
      const fast = Math.abs(this._vx) > CATCH_VELOCITY || Math.abs(this._vy) > CATCH_VELOCITY
      this._pointerId = id
      this._dragging = false
      this._animating = false
      this._vx = 0
      this._vy = 0
      this._startX = e.x
      this._startY = e.y
      // 惯性滚动中按下：只是按停，直接接管（条目收到抬起、不点击）；回弹中按下也从当前位置接着拖
      if (fast || this._outOfBounds()) this._beginDrag(id)
      return
    }
    if (id !== this._pointerId || this._dragging) return // 拖动中的移动和抬起走容器自己的指针信号
    if (e.type !== 'pointermove') {
      this._pointerId = null // 阈值内抬起：条目照常 clicked
      return
    }
    // 条目被隐藏 / 暂停 / 销毁，指针被取消了：不再跟踪
    if (!this.hasPointerCapture(id, true)) {
      this._pointerId = null
      return
    }
    const scale = this.tree.viewport.scale
    const dx = (e.x - this._startX) / scale
    const dy = (e.y - this._startY) / scale
    const t = this.dragThreshold
    if ((this.horizontal && Math.abs(dx) > t) || (this.vertical && Math.abs(dy) > t)) this._beginDrag(id)
  }

  /** 超过阈值：从条目手里接管这根指针，记下起点（从当前位置开始算位移，不跳）。 */
  private _beginDrag(id: number): void {
    if (!this.capturePointer(id)) {
      this._pointerId = null
      return
    }
    const p = this.tree.input.pressedPointers.get(id)!
    const local = this.toLocal(this._inLayer ? this.tree.viewport.worldToDesign(p) : p)
    this._dragging = true
    this._anchorX = local.x
    this._anchorY = local.y
    this._anchorOX = this._unrubber(this._ox, this._maxX(), this.size.x)
    this._anchorOY = this._unrubber(this._oy, this._maxY(), this.size.y)
    this._prevOX = this._ox
    this._prevOY = this._oy
  }

  private _onMove(e: PointerEvent2D): void {
    if (!this._dragging || e.pointerId !== this._pointerId) return
    const p = e.localPosition
    const x = this.horizontal ? this._rubber(this._anchorOX + this._anchorX - p.x, this._maxX(), this.size.x) : this._ox
    const y = this.vertical ? this._rubber(this._anchorOY + this._anchorY - p.y, this._maxY(), this.size.y) : this._oy
    this._setOffset(x, y)
  }

  /** 容器捕获的指针抬起或被取消（隐藏、暂停、切后台）：开始惯性 / 回弹。 */
  private _onUp(e: PointerEvent2D): void {
    if (e.pointerId !== this._pointerId) return
    this._pointerId = null
    if (!this._dragging) return
    this._dragging = false
    this._releasedId = e.pointerId
    if (!this.inertia) {
      this._vx = 0
      this._vy = 0
    }
    if (!this.canProcess()) this._settle() // 被暂停：process 不会推进，直接停在边界内
  }

  /** 切到后台：停下并夹紧（指针的取消另外经路由器发来）。 */
  private _onBackground(): void {
    this._settle()
  }

  /** 停止一切运动，位置夹回边界内。 */
  private _settle(): void {
    this._vx = 0
    this._vy = 0
    this._animating = false
    this._setOffset(clamp(this._ox, 0, this._maxX()), clamp(this._oy, 0, this._maxY()))
  }

  /** 尺寸或内容大小变了：不在拖动时把位置夹回边界内。 */
  private _reclamp(): void {
    if (this._dragging) return
    this._animating = false
    this._setOffset(clamp(this._ox, 0, this._maxX()), clamp(this._oy, 0, this._maxY()))
  }

  /** 拖动时的位置：越界部分按橡皮筋阻尼缩小（`bounce` 关时夹紧）。 */
  private _rubber(o: number, max: number, extent: number): number {
    if (o >= 0 && o <= max) return o
    if (!this.bounce || extent <= 0) return clamp(o, 0, max)
    const over = o < 0 ? -o : o - max
    const d = (1 - 1 / ((over * RUBBER) / extent + 1)) * extent
    return o < 0 ? -d : max + d
  }

  /** `_rubber` 的逆：回弹中按下时，从显示位置还原出手指对应的位置。 */
  private _unrubber(o: number, max: number, extent: number): number {
    if (o >= 0 && o <= max) return o
    if (extent <= 0) return clamp(o, 0, max)
    const d = o < 0 ? -o : o - max
    const over = (1 / (1 - Math.min(d / extent, 0.99)) - 1) * (extent / RUBBER)
    return o < 0 ? -over : max + over
  }

  private _outOfBounds(): boolean {
    return this._ox < 0 || this._oy < 0 || this._ox > this._maxX() || this._oy > this._maxY()
  }

  private _maxX(): number {
    return Math.max(0, this._contentSize.x - this.size.x)
  }

  private _maxY(): number {
    return Math.max(0, this._contentSize.y - this.size.y)
  }

  private _setOffset(x: number, y: number): void {
    if (x === this._ox && y === this._oy) return
    this._ox = x
    this._oy = y
    this.content.position = new Vector2(0 - x, 0 - y) // 0 - 0 是 +0，-0 会让 dump / 比较出现 -0
    this._version++
    this.scrolled.emit(new Vector2(x, y))
  }

  protected override dumpProps(): Record<string, unknown> {
    return {
      ...super.dumpProps(),
      contentSize: this._contentSize,
      scrollOffset: this._ox !== 0 || this._oy !== 0 ? new Vector2(round(this._ox), round(this._oy)) : undefined,
    }
  }
}

/** `_stepAxis` 的第二个返回值（模块级，避免每帧分配）。 */
let _velocity = 0

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}
