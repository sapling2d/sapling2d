import type { BonePose } from '@esotericsoftware/spine-core'
import { Node2D, Vector2, type Node2DOptions } from 'sapling2d'
import { SpineSprite } from './SpineSprite'

export interface SpineBoneNodeOptions extends Node2DOptions {
  /** 跟随的骨骼名。 */
  bone: string
}

/**
 * 跟随一根骨骼的节点：放在 `SpineSprite` 的直接子节点，每帧把自己的 `position` / `rotation` / `scale` 设成骨骼的世界变换
 * （父节点推进骨架之后），子节点就挂在骨骼上——枪口的粒子、手里的武器、头顶的血条。
 *
 * ```ts
 * hero.add(new SpineBoneNode({ bone: 'gun-tip' })).add(new Particles2D({ texture: SPARK, emitting: false }))
 * ```
 *
 * 只跟随（Spine 的"follow"模式）：改这个节点的变换不会反过来驱动骨骼。
 */
export class SpineBoneNode extends Node2D {
  readonly bone: string
  private _pose: BonePose | null = null

  constructor(options: SpineBoneNodeOptions) {
    super(options)
    this.bone = options.bone
  }

  /** @internal */
  override _onEnterTree(): void {
    const parent = this.parent
    if (!(parent instanceof SpineSprite)) throw new Error(`SpineBoneNode "${this.bone}" must be a direct child of a SpineSprite.`)
    const bone = parent.spine.findBone(this.bone)
    if (!bone) throw new Error(`SpineBoneNode: unknown bone "${this.bone}" in ${parent.skeleton.path}. Bones: ${parent.skeleton.boneNames.join(', ')}.`)
    this._pose = bone.appliedPose
    this._follow()
  }

  /** @internal */
  override _onExitTree(): void {
    this._pose = null
  }

  /** @internal 父节点（SpineSprite）在快照里排在前面，它的骨架已经更新到本帧。 */
  override _internalProcess(): void {
    this._follow()
  }

  private _follow(): void {
    const p = this._pose
    if (!p) return
    // 骨骼的世界矩阵 [a b][c d]：x 轴是 (a, c)，y 轴是 (b, d)。spine 的局部 y 朝上（yDown 只翻转世界坐标），
    // 引擎的局部 y 朝下：y 轴取反，挂在骨骼上的子节点才不会上下颠倒。然后按 旋转 + 带符号的缩放 分解（骨架翻转时 scaleY 为负）
    const a = p.a
    const b = -p.b
    const c = p.c
    const d = -p.d
    const sx = Math.sqrt(a * a + c * c)
    const sy = sx === 0 ? 0 : (a * d - b * c) / sx
    this.x = p.worldX
    this.y = p.worldY
    this.rotation = Math.atan2(c, a)
    const scale = this.scale
    if (scale.x !== sx || scale.y !== sy) this.scale = new Vector2(sx, sy)
  }

  protected override dumpProps(): Record<string, unknown> {
    return { ...super.dumpProps(), bone: this.bone }
  }
}
