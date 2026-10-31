import type { Container, Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { CanvasLayer, ColorRect, Node, Node2D, rect, Scene, v } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import type { SceneTree } from '../src/core/SceneTree'
import { collectDrawOrder } from '../src/core/drawOrder'
import { hitsAt } from '../src/input/hit'
import { PixiRenderer } from '../src/render/PixiRenderer'

/**
 * Pixi 实际的绘制顺序：场景容器的子对象依次画；每个容器的子对象按 zIndex 稳定排序（sortableChildren）后依次画。
 * 节点自己的内容层（第 0 个子对象）代表节点本身；没有内容层的节点放在 zIndex 0、最前面的位置（和内容层一样）。
 */
function renderOrder(r: PixiRenderer, tree: SceneTree): string[] {
  const byView = new Map<unknown, Node2D>()
  const index = (nodes: readonly Node[]) => {
    for (const n of nodes) {
      if (n instanceof Node2D && n.unsafePixi) byView.set(n.unsafePixi, n)
      index(n.children)
    }
  }
  index(tree._topLevel())
  const out: string[] = []
  const walk = (c: Container, self: Node2D | null) => {
    const kids = c.children.filter((k) => k.label !== '__clip').map((k, i) => ({ k: k as Container | null, i, z: k.zIndex }))
    const hasContent = kids[0]?.k?.label === '__content'
    if (self && !hasContent) kids.unshift({ k: null, i: -1, z: 0 })
    kids.sort((a, b) => a.z - b.z || a.i - b.i)
    for (const { k, i } of kids) {
      if (k === null || (hasContent && i === 0)) out.push(self!.name)
      else walk(k, byView.get(k) ?? null)
    }
  }
  for (const c of r._stage.parent!.children) walk(c as Container, null)
  return out
}

function pickOrder(tree: SceneTree): string[] {
  const out: Node2D[] = []
  collectDrawOrder(tree._topLevel(), out)
  return out.map((n) => n.name)
}

/** 随机场景树：Node2D、带内容的 ColorRect、不显示的 Node、各种 layer 的 CanvasLayer，zIndex 有正有负。 */
function randomTree(scene: Scene, seed: number): void {
  let s = seed
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!
  let id = 0
  const grow = (parent: Node, depth: number) => {
    const count = depth === 0 ? 4 : Math.floor(rnd() * 4)
    for (let i = 0; i < count; i++) {
      const name = `n${id++}`
      const r = rnd()
      const zIndex = pick([0, 0, 0, 1, 2, -1])
      const child: Node =
        r < 0.15 ? new Node({ name }) : r < 0.3 ? new CanvasLayer({ name, layer: pick([-1, 0, 1]) }) : r < 0.65 ? new ColorRect({ name, size: v(10, 10), zIndex, clipRect: pick([null, null, rect(0, 0, 8, 8)]) }) : new Node2D({ name, zIndex, clipRect: pick([null, null, rect(-5, -5, 10, 10)]) })
      parent.add(child)
      if (depth < 3) grow(child, depth + 1)
    }
  }
  grow(scene, 0)
}

describe('绘制顺序', () => {
  it('拾取顺序（collectDrawOrder）和 Pixi 的渲染顺序一致', async () => {
    for (let seed = 1; seed <= 300; seed++) {
      class Main extends Scene {
        override ready() {
          randomTree(this, seed)
        }
      }
      const g = await createTestGame({ main: Main })
      g.step()
      const r = PixiRenderer._createForSyncTests()
      r.sync(g.tree)
      expect(pickOrder(g.tree), `seed ${seed}`).toEqual(renderOrder(r, g.tree))
    }
  })

  it('zIndex 为负的子节点画在父节点下面：父节点盖住它的地方，点中的是父节点', async () => {
    const g = await createTestGame({ main: Scene })
    g.step()
    const log: string[] = []
    const pickable = (name: string, zIndex: number) => {
      const n = new ColorRect({ name, size: v(100, 100), zIndex, inputPickable: true, hitArea: rect(0, 0, 100, 100) })
      n.pointerDown.connect(() => log.push(name))
      return n
    }
    const parent = g.scene.add(pickable('Parent', 0))
    parent.position = v(100, 100)
    parent.add(pickable('Below', -1))
    parent.add(pickable('Above', 1)).position = v(50, 50)
    g.step()
    g.tap(120, 120) // 只有 Parent 和 Below 重叠：Below 在父节点下面
    g.tap(170, 170) // 三个都重叠：Above 在最上面
    expect(log).toEqual(['Parent', 'Above'])
  })

  it('裁剪：渲染同步里被遮罩挡住的位置，拾取也点不到（以 Pixi 容器上的 mask 为准交叉验证）', async () => {
    class Main extends Scene {
      override ready() {
        // 旋转、缩放的裁剪容器嵌套，里面的可点击矩形比裁剪区大；还有一个不受裁剪的 CanvasLayer
        const a = this.add(new Node2D({ name: 'A', position: v(150, 150), rotation: 0.4, clipRect: rect(0, 0, 300, 200) }))
        const b = a.add(new Node2D({ name: 'B', position: v(120, 80), scale: v(1.5, 0.8), clipRect: rect(-60, -60, 160, 120) }))
        b.add(new ColorRect({ name: 'C', position: v(-200, -200), size: v(400, 400), inputPickable: true }))
        a.add(new ColorRect({ name: 'D', position: v(-100, -100), size: v(600, 500), inputPickable: true }))
        const layer = a.add(new CanvasLayer({ name: 'L' }))
        layer.add(new ColorRect({ name: 'E', position: v(0, 0), size: v(600, 600), inputPickable: true }))
      }
    }
    const g = await createTestGame({ main: Main })
    g.step()
    const r = PixiRenderer._createForSyncTests()
    r.sync(g.tree)

    // Pixi 一侧的判定：沿容器链向上，每个带 mask 的容器都要包含该点（mask 是容器的子对象，用容器所属节点的局部坐标比较）
    const byView = new Map<unknown, Node2D>()
    const index = (nodes: readonly Node[]) => {
      for (const n of nodes) {
        if (n instanceof Node2D && n.unsafePixi) byView.set(n.unsafePixi, n)
        index(n.children)
      }
    }
    index(g.tree._topLevel())
    const visibleInPixi = (n: Node2D, point: ReturnType<typeof v>): boolean => {
      for (let c = n.unsafePixi as Container | null; c; c = c.parent) {
        const owner = byView.get(c)
        if (!owner) break // 到了世界容器或层容器
        const mask = c.mask as Graphics | null | undefined
        if (!mask) continue
        const b = mask.getLocalBounds()
        const local = owner.toLocal(point)
        if (local.x < b.minX || local.x >= b.maxX || local.y < b.minY || local.y >= b.maxY) return false
      }
      return true
    }

    const nodes: Node2D[] = []
    const collect = (list: readonly Node[]) => {
      for (const n of list) {
        if (n instanceof Node2D && n.inputPickable) nodes.push(n)
        collect(n.children)
      }
    }
    collect(g.tree._topLevel())
    expect(nodes.map((n) => n.name).sort()).toEqual(['C', 'D', 'E'])

    let checked = 0
    let clippedAway = 0
    for (let x = -50; x <= 650; x += 20) {
      for (let y = -50; y <= 650; y += 20) {
        const p = v(x, y)
        for (const n of nodes) {
          const inArea = n.hitTest(n.toLocal(p))
          if (!inArea) continue
          const picked = hitsAt(n, p, p, n._canvasLayer !== null)
          expect(picked, `${n.name} at ${p}`).toBe(visibleInPixi(n, p))
          checked++
          if (!picked) clippedAway++
        }
      }
    }
    expect(checked).toBeGreaterThan(500)
    expect(clippedAway).toBeGreaterThan(100) // 确实有被裁掉的点，测试不是空转
  })
})
