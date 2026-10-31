/**
 * spike 用的裁剪：引擎还没有 clipRect，这里用 `unsafePixi` 给节点的 Pixi 容器挂 stencil mask。
 *
 * mask 的 Graphics 不能放进节点自己的容器——渲染层每帧按子节点顺序对账，会把陌生的子对象移掉——
 * 所以放在 Pixi 根容器（和 `keep` 模式的全屏 mask 同级）上，每帧末（`frameEnd`，渲染之前）
 * 把它的变换设成节点在屏幕上的变换：屏幕 = 视口缩放 / 偏移 ∘ 相机偏移 ∘ 节点全局变换。
 * 正式实现会把 mask 放进节点容器（ticket 02），这里只验证 Pixi/WebGL1 的 stencil 行为和开销。
 */
import { Graphics, type Container } from 'pixi.js'
import type { Node2D, Rect2, SceneTree, TreeSystem } from 'sapling2d'

interface Entry {
  node: Node2D
  rect: Rect2
  mask: Graphics | null
}

export class ClipMasks implements TreeSystem {
  private readonly _tree: SceneTree
  private readonly _entries: Entry[] = []

  constructor(tree: SceneTree) {
    this._tree = tree
  }

  /** 给节点加裁剪（本地坐标矩形）。节点离开树时自动移除。 */
  add(node: Node2D, rect: Rect2): void {
    this._entries.push({ node, rect, mask: null })
  }

  get count(): number {
    return this._entries.length
  }

  frameEnd(): void {
    const vp = this._tree.viewport
    const s = vp.scale
    const ox = vp.offset.x
    const oy = vp.offset.y
    const cx = vp.canvasOffsetX
    const cy = vp.canvasOffsetY
    const entries = this._entries
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!
      const container = e.node.unsafePixi as Container | null
      if (!e.node.isInsideTree) {
        // 节点走了：拆掉 mask
        if (e.mask) {
          if (container) container.mask = null
          e.mask.removeFromParent()
          e.mask.destroy()
        }
        entries.splice(i, 1)
        continue
      }
      if (!container) continue // 还没被渲染过
      if (!e.mask) {
        let root: Container = container
        while (root.parent) root = root.parent
        const g = new Graphics().rect(e.rect.x, e.rect.y, e.rect.width, e.rect.height).fill(0xffffff)
        root.addChild(g)
        container.mask = g
        e.mask = g
      }
      const p = e.node.globalPosition
      e.mask.position.set(ox + s * (cx + p.x), oy + s * (cy + p.y))
      e.mask.rotation = e.node.globalRotation
      e.mask.scale.set(s)
    }
  }
}
