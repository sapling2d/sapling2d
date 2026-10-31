import { AnimationState, AnimationStateData, Physics, Skeleton, type Event as SpineCoreEvent, type TrackEntry } from '@esotericsoftware/spine-core'
import { Node2D, Rect2, Signal, Vector2, type Node2DOptions } from 'sapling2d'
import type { SpineSkeleton } from './resource'
import { SpineRuntime } from './runtime'

/** Spine 的用户事件（在编辑器里打在时间轴上的 key，如脚步声、出手帧）。 */
export interface SpineEvent {
  readonly name: string
  readonly int: number
  readonly float: number
  readonly string: string | null
  /** 事件在动画里的时间点（秒）。 */
  readonly time: number
}

export interface SpinePlayOptions {
  /** 循环，默认 true。 */
  loop?: boolean
  /** 轨道，默认 0。高轨道的动画叠在低轨道上（上半身开枪 + 下半身跑）。 */
  track?: number
}

export interface SpineQueueOptions extends SpinePlayOptions {
  /** 在前一个动画之后多少秒开始（可以为负：提前混入），默认 0。 */
  delay?: number
}

/** 物理约束（4.2+ 的头发、布料）：`update` 每帧模拟（默认），`pose` 只应用不模拟，`none` 不应用。 */
export type SpinePhysicsMode = 'update' | 'pose' | 'none'

export interface SpineSpriteOptions extends Node2DOptions {
  /** 骨架资源（`spineSkeleton()`），必须已经加载（放在场景的 `static assets` 里）。 */
  skeleton: SpineSkeleton
  /** 一开始就在轨道 0 播放的动画。 */
  animation?: string
  /** `animation` 是否循环，默认 true。 */
  loop?: boolean
  /** 初始皮肤。 */
  skin?: string
  /** 两个动画之间默认的混合时长（秒），默认 0（Spine 的默认，切换动作时直接跳）。角色一般设 0.1–0.3。 */
  defaultMix?: number
  /** 播放倍速，默认 1。 */
  speedScale?: number
  flipH?: boolean
  flipV?: boolean
  physics?: SpinePhysicsMode
}

const PHYSICS: Record<SpinePhysicsMode, Physics> = { update: Physics.update, pose: Physics.pose, none: Physics.none }

/**
 * 显示并播放一个 Spine 骨架。继承 Node2D：`position`、`scale`、`alpha`、`modulate`、`blendMode`、`zIndex`、指针事件都照常。
 *
 * ```ts
 * const hero = this.add(new SpineSprite({ skeleton: Arena.assets.hero, animation: 'idle', defaultMix: 0.2 }))
 * hero.play('jump', { loop: false })     // 轨道 0
 * hero.queue('idle')                     // 播完接 idle
 * hero.animationEvent.connect((name) => { if (name === 'footstep') this.tree.audio.play(STEP) }, this)
 * hero.skin = 'red'                      // 换装
 * hero.flipH = true                      // 朝左
 * hero.bonePosition('hand')              // 骨骼在节点局部坐标里的位置
 * ```
 *
 * 常用操作是轨道 0 的糖；进阶直接用 spine-core 的对象：`state`（`AnimationState`：多轨道、混合、`TrackEntry`）和 `spine`（`Skeleton`：骨骼、slot、附件、颜色）。
 * 动画在 `process` 之前推进（暂停时停止，受 `tree.timeScale` 影响），信号在推进时触发。需要安装 `spine()` 插件。
 */
export class SpineSprite extends Node2D {
  /** 骨架资源。 */
  readonly skeleton: SpineSkeleton
  /** spine-core 的运行时骨架（进阶）：`findBone` / `findSlot` / `setAttachment` / `color` ……改完姿势相关的东西调用 `refreshPose()`。 */
  readonly spine: Skeleton
  /** spine-core 的动画状态（进阶）：多轨道、`setMix`、`TrackEntry.timeScale` …… */
  readonly state: AnimationState
  /** 一个动画成为轨道上的当前动画（`play` / `queue` 轮到它）。参数：动画名、轨道。 */
  readonly animationStarted = new Signal<[animation: string, track: number]>()
  /** 动画播到末尾：不循环的播完一次，循环的每圈一次（Spine 的 complete）。参数：动画名、轨道。 */
  readonly animationFinished = new Signal<[animation: string, track: number]>()
  /** 时间轴上的用户事件（脚步、出手帧）。参数：事件名、事件（int / float / string）、轨道。 */
  readonly animationEvent = new Signal<[name: string, event: SpineEvent, track: number]>()
  /** @internal 姿势变化的计数：渲染层据此决定要不要重新算顶点。 */
  _poseVersion = 0
  private _flipH: boolean
  private _flipV: boolean
  private _physics: SpinePhysicsMode
  /** 下一次推进时无论如何都算作姿势变了（play / stop 之后第一帧）。 */
  private _dirty = false

  constructor(options: SpineSpriteOptions) {
    super(options)
    this.skeleton = options.skeleton
    const data = options.skeleton.data
    this.spine = new Skeleton(data)
    this.state = new AnimationState(new AnimationStateData(data))
    this.state.data.defaultMix = options.defaultMix ?? 0
    this.state.timeScale = Math.max(0, options.speedScale ?? 1)
    this._flipH = options.flipH ?? false
    this._flipV = options.flipV ?? false
    this._physics = options.physics ?? 'update'
    this._applyFlip()
    this.state.addListener({
      start: (entry) => this.animationStarted.emit(entry.animation!.name, entry.trackIndex),
      complete: (entry) => this.animationFinished.emit(entry.animation!.name, entry.trackIndex),
      event: (entry, event: SpineCoreEvent) =>
        this.animationEvent.emit(event.data.name, { name: event.data.name, int: event.intValue, float: event.floatValue, string: event.stringValue, time: event.time }, entry.trackIndex),
    })
    if (options.skin !== undefined) this.skin = options.skin
    if (options.animation !== undefined) this.play(options.animation, { loop: options.loop ?? true })
    // 第一帧之前就有姿势：没播动画时是设置姿势
    this.spine.updateWorldTransform(Physics.pose)
  }

  /** 播放：成为轨道上的当前动画（丢弃排队的），从头开始；和前一个动画按 `defaultMix` / `mix()` 混合。返回 spine 的 `TrackEntry`。 */
  play(name: string, options: SpinePlayOptions = {}): TrackEntry {
    this._checkAnimation(name)
    const entry = this.state.setAnimation(options.track ?? 0, name, options.loop ?? true)
    this._dirty = true
    return entry
  }

  /** 排队：在轨道上当前（或最后排队的）动画之后播放；轨道空着时等于 `play`。 */
  queue(name: string, options: SpineQueueOptions = {}): TrackEntry {
    this._checkAnimation(name)
    const entry = this.state.addAnimation(options.track ?? 0, name, options.loop ?? true, options.delay ?? 0)
    this._dirty = true
    return entry
  }

  /** 停止一条轨道：在 `mixDuration` 秒内混回设置姿势（低轨道的动画继续）。 */
  stop(track = 0, mixDuration = 0): void {
    this.state.setEmptyAnimation(track, mixDuration)
    this._dirty = true
  }

  /** 轨道 0 当前的动画名；没有时为 null。 */
  get animation(): string | null {
    const entry = this.state.getTrack(0)
    const anim = entry?.animation
    return anim && anim !== AnimationState.emptyAnimation ? anim.name : null
  }

  /** 轨道 0 有动画，并且在循环或还没播完。 */
  get isPlaying(): boolean {
    const entry = this.state.getTrack(0)
    return !!entry && entry.animation !== AnimationState.emptyAnimation && (entry.loop || !entry.isComplete())
  }

  /** 播放倍速（≥ 0），作用于所有轨道；和 `tree.timeScale` 叠加。 */
  get speedScale(): number {
    return this.state.timeScale
  }

  set speedScale(value: number) {
    this.state.timeScale = Math.max(0, value)
  }

  /** 两个动画之间默认的混合时长（秒）。 */
  get defaultMix(): number {
    return this.state.data.defaultMix
  }

  set defaultMix(value: number) {
    this.state.data.defaultMix = Math.max(0, value)
  }

  /** 从 `from` 切到 `to` 时的混合时长（秒），覆盖 `defaultMix`。 */
  mix(from: string, to: string, seconds: number): void {
    this._checkAnimation(from)
    this._checkAnimation(to)
    this.state.data.setMix(from, to, Math.max(0, seconds))
  }

  /** 当前皮肤的名字（null 是没设皮肤：只用默认皮肤里的附件）。赋值换装：显示新皮肤里的附件（设置姿势的那些）。 */
  get skin(): string | null {
    return this.spine.skin?.name ?? null
  }

  set skin(name: string | null) {
    if (name === null) {
      this.spine.setSkin(null)
    } else {
      const skin = this.skeleton.data.findSkin(name)
      if (!skin) throw new Error(`SpineSprite: unknown skin "${name}" in ${this.skeleton.path}. Skins: ${this.skeleton.skinNames.join(', ')}.`)
      this.spine.setSkin(skin)
    }
    this.spine.setupPoseSlots()
    this.refreshPose()
  }

  /** 给 slot 换附件（换武器、换表情）；`null` 清空。附件在当前皮肤或默认皮肤里按名字找。 */
  setAttachment(slot: string, attachment: string | null): void {
    if (!this.spine.findSlot(slot)) throw new Error(`SpineSprite: unknown slot "${slot}" in ${this.skeleton.path}. Slots: ${this.skeleton.slotNames.join(', ')}.`)
    try {
      this.spine.setAttachment(slot, attachment)
    } catch (err) {
      throw new Error(`SpineSprite: ${err instanceof Error ? err.message : String(err)} (${this.skeleton.path}${this.skin ? `, skin "${this.skin}"` : ''}).`)
    }
    this.refreshPose()
  }

  /** 清掉所有轨道，回到设置姿势。 */
  setupPose(): void {
    this.state.clearTracks()
    this.spine.setupPose()
    this.refreshPose()
  }

  /** 直接改了 `spine`（骨骼位置、附件、颜色）之后调用：重算世界变换，让渲染层在本帧更新。 */
  refreshPose(): void {
    this.spine.updateWorldTransform(Physics.pose)
    this._poseVersion++
  }

  /** 水平翻转（骨架的 scaleX 取负）：朝左走。 */
  get flipH(): boolean {
    return this._flipH
  }

  set flipH(value: boolean) {
    if (value === this._flipH) return
    this._flipH = value
    this._applyFlip()
    this.refreshPose()
  }

  get flipV(): boolean {
    return this._flipV
  }

  set flipV(value: boolean) {
    if (value === this._flipV) return
    this._flipV = value
    this._applyFlip()
    this.refreshPose()
  }

  get physics(): SpinePhysicsMode {
    return this._physics
  }

  set physics(value: SpinePhysicsMode) {
    if (!(value in PHYSICS)) throw new Error(`SpineSprite: unknown physics mode "${String(value)}". Expected: update, pose, none.`)
    this._physics = value
  }

  /** 骨骼当前在节点局部坐标里的位置（y 向下）。 */
  bonePosition(bone: string): Vector2 {
    const pose = this._bone(bone).appliedPose
    return new Vector2(pose.worldX, pose.worldY)
  }

  /** 骨骼当前的朝向（弧度，节点局部坐标，和 `rotation` 同一种约定）。 */
  boneRotation(bone: string): number {
    const pose = this._bone(bone).appliedPose
    return Math.atan2(pose.c, pose.a)
  }

  /** 设置姿势的包围盒（局部坐标，按翻转镜像）。没设 `hitArea` 时的点击区域。 */
  get rect(): Rect2 {
    const r = this.skeleton.rect
    return new Rect2(this._flipH ? -r.x - r.width : r.x, this._flipV ? -r.y - r.height : r.y, r.width, r.height)
  }

  override hitTest(localPoint: Vector2): boolean {
    if (this.hitArea) return super.hitTest(localPoint)
    return this.rect.contains(localPoint)
  }

  /** @internal 没装 `spine()` 就报错：内容登记不上，节点画不出来。 */
  override _onEnterTree(): void {
    try {
      this.tree.get(SpineRuntime)
    } catch {
      throw new Error(`SpineSprite requires the spine plugin: add plugins: [spine()] (from '@sapling2d/spine') to the game options.`)
    }
  }

  /** @internal 动画放在引擎内部钩子里：子类覆写 process() 不会影响播放。 */
  override _internalProcess(dt: number): void {
    const state = this.state
    const skeleton = this.spine
    state.update(dt)
    skeleton.update(dt)
    const applied = state.apply(skeleton)
    skeleton.updateWorldTransform(PHYSICS[this._physics])
    if (applied || this._dirty || (this._physics === 'update' && skeleton.physics.length > 0)) {
      this._dirty = false
      this._poseVersion++
    }
  }

  private _applyFlip(): void {
    const sk = this.spine
    sk.scaleX = this._flipH ? -1 : 1
    sk.scaleY = this._flipV ? -1 : 1 // yDown 下 spine 自己再乘 -1（见 resource.ts）
  }

  private _checkAnimation(name: string): void {
    if (!this.skeleton.data.findAnimation(name)) {
      throw new Error(`SpineSprite: unknown animation "${name}" in ${this.skeleton.path}. Animations: ${this.skeleton.animationNames.join(', ')}.`)
    }
  }

  private _bone(name: string) {
    const bone = this.spine.findBone(name)
    if (!bone) throw new Error(`SpineSprite: unknown bone "${name}" in ${this.skeleton.path}. Bones: ${this.skeleton.boneNames.join(', ')}.`)
    return bone
  }

  protected override dumpProps(): Record<string, unknown> {
    return {
      ...super.dumpProps(),
      skeleton: this.skeleton.path,
      animation: this.animation ?? undefined,
      playing: this.isPlaying || undefined,
      skin: this.skin ?? undefined,
      speedScale: this.speedScale !== 1 ? this.speedScale : undefined,
      flipH: this._flipH || undefined,
      flipV: this._flipV || undefined,
    }
  }
}