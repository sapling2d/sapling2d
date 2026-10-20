import { Vector2 } from '../math/Vector2'
import type { ActionName } from './actions'
import { ActionMap, type ActionSource } from './input/ActionMap'
import type { InputBinding } from './input/bindings'
import { isPointerEvent, type RawInputEvent } from './input/events'
import { PointerRouter } from './input/PointerRouter'
import type { InputSource } from './input/source'
import type { Node } from './Node'
import type { Viewport } from './Viewport'

export type { InputBinding, PointerBinding } from './input/bindings'
export type { RawInputEvent, RawPointerEvent } from './input/events'
export type { InputSource } from './input/source'

/** 指针按下绑定：屏幕上任意位置的按下（被 inputPickable 节点处理掉的不算）。 */
export function pointerPress(): InputBinding {
  return { type: 'pointer' }
}

/**
 * 输入系统，通过 `this.tree.input` 访问。
 *
 * 平台事件先进入队列，在每帧开始时（物理和 process 之前）统一处理，所以输入的效果是确定的：
 * 节点的指针信号在这时触发，`isActionJustPressed` 在这一整帧内为 true。
 * 在 `physicsProcess` 里，`isActionJustPressed` / `isActionJustReleased` 按物理帧算（和 Godot 一样）：
 * 上一个物理步之后按下的，在下一个物理步里为 true，一次按下只在一个物理步里为 true。
 * 屏幕刷新率高于 60Hz 时有的帧没有物理步，这样按键也不会丢。
 *
 * ```ts
 * // 启动参数：actions: { drop: [pointerPress(), key('Space')] }
 * override process() {
 *   if (this.tree.input.isActionJustPressed('drop')) this.drop()
 * }
 * ```
 *
 * 核心只认识指针和动作：`ActionMap`（动作状态）、`PointerRouter`（指针分发给节点）。
 * 键盘、屏幕控件、传感器等都是 `InputSource`（`addSource`），由插件和节点登记；它们的事件走同一个队列（`enqueue`）。
 */
export class Input {
  private _queue: RawInputEvent[] = []
  /** 处理中的队列。和 `_queue` 轮换使用：处理期间入队的事件进另一个数组、下一帧处理，每帧不分配。 */
  private _spare: RawInputEvent[] = []
  private readonly _actions = new ActionMap()
  private readonly _pointer: PointerRouter
  private readonly _sources: InputSource[] = []
  private readonly _strengthSources: InputSource[] = []
  private readonly _frameSources: InputSource[] = []
  /** 事件类型 → 订阅它的来源。 */
  private readonly _routes = new Map<string, InputSource[]>()
  /** 遍历来源时用的副本（复用）：回调里可能增删来源。帧首和事件分发各一个，互不覆盖。 */
  private readonly _frameScratch: InputSource[] = []
  private readonly _dispatchScratch: InputSource[] = []
  /** 已经警告过的、没有来源认领的绑定类型。 */
  private readonly _warnedTypes = new Set<string>()
  /** 给 `ActionMap` 的力度来源（构造时建一次）。 */
  private readonly _source: ActionSource = { strength: (action, bindings) => this._strength(action, bindings) }

  /** @internal */
  constructor(viewport: Viewport, topLevel: () => readonly Node[]) {
    this._pointer = new PointerRouter(viewport, topLevel)
  }

  // ---------------------------------------------------------------- 动作

  /** 定义（或覆盖）一个动作。也可以在启动参数 `actions` 里一次性定义。绑定的类型没有来源认领时打印警告。 */
  addAction(name: ActionName, bindings: InputBinding[]): void {
    for (const b of bindings) {
      if (b.type === 'pointer' || this._warnedTypes.has(b.type) || this._claims(b.type)) continue
      this._warnedTypes.add(b.type)
      console.warn(`Input action "${name}": binding type "${b.type}" has no input source, so it will never press the action. Install its plugin in the game options (plugins: [...]).`)
    }
    this._actions.add(name, bindings)
  }

  removeAction(name: ActionName): void {
    this._actions.remove(name)
  }

  hasAction(name: ActionName): boolean {
    return this._actions.has(name)
  }

  /** 动作当前是否处于按下状态：任意一个绑定按下，或者力度 ≥ 0.5（摇杆推过一半）。 */
  isActionPressed(name: ActionName): boolean {
    return this._actions.isPressed(name)
  }

  /** 动作是否在本帧刚被按下（在 `physicsProcess` 里：是否在上一个物理步之后刚被按下）。 */
  isActionJustPressed(name: ActionName): boolean {
    return this._actions.isJustPressed(name)
  }

  /** 动作是否在本帧刚被松开（在 `physicsProcess` 里：是否在上一个物理步之后刚被松开）。 */
  isActionJustReleased(name: ActionName): boolean {
    return this._actions.isJustReleased(name)
  }

  /**
   * 动作的力度，0–1：按键、`pointerPress()`、屏幕按钮按下时是 1；摇杆按推动的程度给出 0–1（已经扣掉死区）。
   * 几个来源同时作用时取最大的。力度 ≥ 0.5 时动作算按下（`isActionPressed`）。
   */
  getActionStrength(name: ActionName): number {
    return this._actions.strength(name)
  }

  /** 一条轴：`positive` 的力度减去 `negative` 的力度，-1 到 1。不分配内存。 */
  getAxis(negative: ActionName, positive: ActionName): number {
    return this.getActionStrength(positive) - this.getActionStrength(negative)
  }

  /**
   * 方向向量：x 是 `getAxis(negX, posX)`，y 是 `getAxis(negY, posY)`（y 向下为正），长度超过 1 时缩到 1
   * （键盘斜着按不会更快）。摇杆和键盘都走这里，游戏不用区分。
   * 每次调用分配一个 Vector2：每帧调用一次没有问题，热循环里用 `getAxis`。
   *
   * ```ts
   * const dir = this.tree.input.getVector('left', 'right', 'up', 'down')
   * this.setVelocity(dir.x * SPEED, dir.y * SPEED)
   * ```
   */
  getVector(negX: ActionName, posX: ActionName, negY: ActionName, posY: ActionName): Vector2 {
    let x = this.getAxis(negX, posX)
    let y = this.getAxis(negY, posY)
    const len = Math.sqrt(x * x + y * y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return new Vector2(x, y)
  }

  /** @internal 物理步开始时由 SceneTree 调用：物理步期间（physicsProcess 和刚体的接触信号）刚按下 / 刚松开按物理步算。 */
  _beginPhysicsStep(): void {
    this._actions.beginPhysicsStep()
  }

  /** @internal 每个物理步结束时由 SceneTree 调用。 */
  _endPhysicsStep(): void {
    this._actions.endPhysicsStep()
  }

  /** 动作 `action` 当前的力度：`pointerPress()` 绑定和所有来源里最大的。 */
  private _strength(action: string, bindings: readonly InputBinding[]): number {
    let strength = 0
    if (this._pointer.hasUnhandled) {
      for (let i = 0; i < bindings.length; i++) {
        if (bindings[i]!.type === 'pointer') {
          strength = 1
          break
        }
      }
    }
    const sources = this._strengthSources
    for (let i = 0; strength < 1 && i < sources.length; i++) {
      const s = sources[i]!.strength!(action, bindings)
      if (s > strength) strength = s
    }
    return strength
  }

  /** 是否有来源认领绑定类型 `type`。 */
  private _claims(type: string): boolean {
    for (let i = 0; i < this._sources.length; i++) {
      const types = this._sources[i]!.bindingTypes
      if (types && types.includes(type)) return true
    }
    return false
  }

  // ---------------------------------------------------------------- 指针状态

  /** 最近一次指针事件的位置（世界坐标，没有相机时就是设计坐标）；还没有任何指针事件时为 null。 */
  get pointerPosition(): Vector2 | null {
    return this._pointer.position
  }

  /** 是否有指针处于按下状态。 */
  get isPointerPressed(): boolean {
    return this._pointer.pointers.size > 0
  }

  /** 本帧是否有指针按下。 */
  get isPointerJustPressed(): boolean {
    return this._pointer.justPressed
  }

  /** 本帧是否有指针抬起。 */
  get isPointerJustReleased(): boolean {
    return this._pointer.justReleased
  }

  /** 当前按下的所有指针：id → 位置（世界坐标，没有相机时就是设计坐标）。 */
  get pressedPointers(): ReadonlyMap<number, Vector2> {
    return this._pointer.pointers
  }

  // ---------------------------------------------------------------- 扩展点

  /** 登记一个输入来源（插件、屏幕控件）。重复登记只算一次。 */
  addSource(source: InputSource): void {
    if (this._sources.includes(source)) return
    this._sources.push(source)
    if (source.strength) this._strengthSources.push(source)
    if (source.beginFrame) this._frameSources.push(source)
    if (source.eventTypes) {
      for (const type of source.eventTypes) {
        const list = this._routes.get(type)
        if (list) list.push(source)
        else this._routes.set(type, [source])
      }
    }
  }

  removeSource(source: InputSource): void {
    remove(this._sources, source)
    remove(this._strengthSources, source)
    remove(this._frameSources, source)
    for (const list of this._routes.values()) remove(list, source)
  }

  /** 原始输入事件入队，下一帧开始时按顺序处理。平台的指针事件和插件的事件都走这里。 */
  enqueue(event: RawInputEvent): void {
    this._queue.push(event)
  }

  // ---------------------------------------------------------------- 内部

  /** @internal 每帧开始时由 SceneTree 调用：清掉上一帧的 just 状态，来源的帧首处理，然后按顺序处理队列。 */
  _flush(): void {
    this._actions.beginFrame()
    this._pointer.beginFrame()
    // 被拖着的节点变得不可命中（隐藏、暂停、销毁）时收到 pointerUp；来源的帧首处理（轮询手柄）。
    // 动作状态在这里统一更新，所有节点在同一帧看到变化
    this._pointer.cancelUnhittable()
    const frameSources = snapshot(this._frameSources, this._frameScratch)
    for (let i = 0; i < frameSources.length; i++) frameSources[i]!.beginFrame!()
    this._actions.update(this._source)
    const queue = this._queue
    if (queue.length === 0) return
    this._queue = this._spare
    this._spare = queue
    for (let i = 0; i < queue.length; i++) {
      const e = queue[i]!
      if (isPointerEvent(e)) {
        // 同一个指针还按着又收到按下：上一次的抬起丢了。先按取消处理并更新动作（先松开再按下），新的按下才有“刚按下”
        if (e.type === 'pointerdown' && this._pointer.cancelStale(e.pointerId)) this._actions.update(this._source)
        this._pointer.handle(e)
      }
      const subscribers = this._routes.get(e.type)
      if (subscribers) {
        const sources = snapshot(subscribers, this._dispatchScratch)
        for (let j = 0; j < sources.length; j++) sources[j]!.handle!(e)
      }
      this._actions.update(this._source)
    }
    queue.length = 0
  }

  /**
   * @internal 游戏切到后台：松开所有按下的指针，并让每个来源松开自己按着的东西（排队成取消 / 松开事件，下一帧开始时按顺序处理）。
   * 还在队列里、没处理的按下也算：它们的抬起在后台收不到。
   */
  _releaseAll(): void {
    this._pointer.releaseAll(this._queue)
    const sources = this._sources.slice() // 切后台很少发生，直接复制
    for (let i = 0; i < sources.length; i++) sources[i]!.releaseAll?.(this._queue)
  }
}

function remove<T>(list: T[], item: T): void {
  const i = list.indexOf(item)
  if (i >= 0) list.splice(i, 1)
}

/** `list` 的副本（写进复用的 `out`）：遍历时回调增删来源也不会漏掉或多算。 */
function snapshot(list: readonly InputSource[], out: InputSource[]): InputSource[] {
  out.length = 0
  for (let i = 0; i < list.length; i++) out.push(list[i]!)
  return out
}
