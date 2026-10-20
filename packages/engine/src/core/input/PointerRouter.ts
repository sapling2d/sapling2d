import { Vector2 } from '../../math/Vector2'
import { collectDrawOrder } from '../drawOrder'
import type { Node } from '../Node'
import type { Node2D } from '../Node2D'
import type { PointerEvent2D } from '../pointer'
import type { Viewport } from '../Viewport'
import type { RawInputEvent, RawPointerEvent } from './events'
import { canHit, hitsAt } from './hit'

/**
 * 指针：记录按下的指针和最近的位置，把每个指针事件分发给它的目标——
 * 按下时拾取绘制顺序最上层、命中的可点击节点（`inputPickable`），由它捕获这个指针（之后的移动、抬起都发给它）；
 * 没有命中任何节点就算没有被处理（会触发 `pointerPress()` 绑定）。屏幕按钮和摇杆也只是普通的可点击节点。
 */
export class PointerRouter {
  private readonly _viewport: Viewport
  private readonly _topLevel: () => readonly Node[]
  /** 当前按下的指针（世界坐标）。 */
  private readonly _pointers = new Map<number, Vector2>()
  /** 同一批指针在屏幕上的位置（设计坐标）：相机移动后，按它重新算出世界坐标。 */
  private readonly _pointersDesign = new Map<number, Vector2>()
  /** 当前按下、且没有被任何节点处理的指针；只有它们会触发 pointer 绑定。 */
  private readonly _unhandled = new Set<number>()
  /** 指针 → 按下时点中的节点：之后的移动、抬起都发给它。 */
  private readonly _captures = new Map<number, Node2D>()
  /** 最近一次指针事件的位置（世界坐标 / 设计坐标）。 */
  private _position: Vector2 | null = null
  private _positionDesign: Vector2 | null = null
  private _justPressed = false
  private _justReleased = false

  constructor(viewport: Viewport, topLevel: () => readonly Node[]) {
    this._viewport = viewport
    this._topLevel = topLevel
  }

  /** 当前按下的指针：id → 位置（世界坐标）。 */
  get pointers(): ReadonlyMap<number, Vector2> {
    return this._pointers
  }

  /** 最近一次指针事件的位置（世界坐标）；还没有任何指针事件时为 null。 */
  get position(): Vector2 | null {
    return this._position
  }

  /** 本帧是否有指针按下。 */
  get justPressed(): boolean {
    return this._justPressed
  }

  /** 本帧是否有指针抬起。 */
  get justReleased(): boolean {
    return this._justReleased
  }

  /** 是否有没被处理的按下的指针。 */
  get hasUnhandled(): boolean {
    return this._unhandled.size > 0
  }

  /** 每帧开始时：清掉刚按下 / 刚抬起；相机在上一帧末尾可能移动了，手指没动，它下面的世界坐标也变了。 */
  beginFrame(): void {
    this._justPressed = false
    this._justReleased = false
    const vp = this._viewport
    for (const [id, design] of this._pointersDesign) this._pointers.set(id, vp.designToWorld(design))
    if (this._positionDesign) this._position = vp.designToWorld(this._positionDesign)
  }

  /**
   * 帧首：被捕获的节点变得不可命中（隐藏、暂停、排队销毁、离开树、已销毁）时，用最后的位置给它发一次 pointerUp（不发 clicked），
   * 并忘掉这根指针（之后它的移动和抬起忽略）。对任何被拖着的节点都成立：屏幕按钮和摇杆靠它在隐藏 / 暂停时松开。
   */
  cancelUnhittable(): void {
    if (this._captures.size === 0) return
    for (const [id, node] of this._captures) {
      if (node.isInsideTree && !node.isFreed && canHit(node)) continue
      this._end(id, false, this._pointers.get(id)!, this._pointersDesign.get(id)!)
    }
  }

  /**
   * 游戏切到后台：给每个按下的指针排队一个取消事件（下一帧开始时按顺序处理）。
   * 还在队列里、没处理的按下也算：它们的抬起在后台收不到。
   */
  releaseAll(queue: RawInputEvent[]): void {
    const pointers = new Map<number, { x: number; y: number }>()
    for (const [id, design] of this._pointersDesign) pointers.set(id, this._viewport.designToScreen(design))
    for (const e of queue) if (e.type === 'pointerdown') pointers.set(e.pointerId, { x: e.x, y: e.y })
    for (const [id, p] of pointers) queue.push({ type: 'pointercancel', pointerId: id, x: p.x, y: p.y })
  }

  handle(e: RawPointerEvent): void {
    // 世界坐标：和节点的全局坐标相同（有相机时随相机平移）
    const design = this._viewport.screenToDesign(new Vector2(e.x, e.y))
    const position = this._viewport.designToWorld(design)
    this._position = position
    this._positionDesign = design
    const id = e.pointerId

    if (e.type === 'pointerdown') {
      this._pointers.set(id, position)
      this._pointersDesign.set(id, design)
      this._justPressed = true
      const node = this._pick(position, design)
      if (node) {
        this._captures.set(id, node)
        node.pointerDown.emit(event(id, position, design, node))
      } else {
        this._unhandled.add(id)
      }
      return
    }

    // 没按着（或已经被取消）的指针：只记下位置
    if (!this._pointers.has(id)) return
    if (e.type !== 'pointermove') {
      this._end(id, e.type === 'pointerup', position, design)
      return
    }
    this._pointers.set(id, position)
    this._pointersDesign.set(id, design)
    const capture = this._captures.get(id)
    if (capture && capture.isInsideTree && !capture.isFreed) capture.pointerMove.emit(event(id, position, design, capture))
  }

  /**
   * 指针 `id` 还按着时又收到它的按下：上一次的抬起丢了（真机偶尔丢 touchend，浏览器失去焦点时也可能丢 pointerup）。
   * 把上一次的按下当作在最后的位置取消（捕获它的节点收到 pointerUp）。返回是否取消了。
   * 由 `Input` 在处理按下之前调用，这样动作先松开、再按下，新的按下照常有“刚按下”。
   */
  cancelStale(id: number): boolean {
    const position = this._pointers.get(id)
    if (!position) return false
    this._end(id, false, position, this._pointersDesign.get(id)!)
    return true
  }

  /** 指针抬起（`up`）或取消：捕获它的节点收到 pointerUp（抬起时还在节点里才算 clicked）。 */
  private _end(id: number, up: boolean, position: Vector2, design: Vector2): void {
    const capture = this._captures.get(id)
    const target = capture && capture.isInsideTree && !capture.isFreed ? capture : null
    this._pointers.delete(id)
    this._pointersDesign.delete(id)
    this._unhandled.delete(id)
    this._captures.delete(id)
    this._justReleased = true
    if (target) {
      const ev = event(id, position, design, target)
      target.pointerUp.emit(ev)
      if (up && target.hitTest(ev.localPosition)) target.clicked.emit(ev)
    }
  }

  /**
   * 绘制顺序最上层、命中的可点击节点（`inputPickable`）。
   * CanvasLayer 里的节点按设计坐标（`design`）判断，场景里的按世界坐标。
   */
  private _pick(world: Vector2, design: Vector2): Node2D | null {
    const order: Node2D[] = []
    const inLayer: boolean[] = []
    collectDrawOrder(this._topLevel(), order, inLayer)
    for (let i = order.length - 1; i >= 0; i--) {
      const n = order[i]!
      if (n.inputPickable && hitsAt(n, world, design, inLayer[i])) return n
    }
    return null
  }
}

/** 节点收到的事件：CanvasLayer 里的节点拿到设计坐标，场景里的拿到世界坐标。 */
function event(pointerId: number, world: Vector2, design: Vector2, node: Node2D): PointerEvent2D {
  const position = node._canvasLayer ? design : world
  return { pointerId, position, localPosition: node.toLocal(position) }
}
