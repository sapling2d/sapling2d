import type { Container, Graphics } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { Camera2D, CanvasLayer, ColorRect, Node2D, pointerPress, rect, Scene, v, type PointerEvent2D } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import { PixiRenderer } from '../src/render/PixiRenderer'

declare module 'sapling2d' {
  interface ActionRegistry {
    clipTap: true
  }
}

/** 一个 100×100、以原点为中心的可点击方块，记录收到的事件类型。 */
class Button extends Node2D {
  log: string[] = []
  constructor(opts: ConstructorParameters<typeof Node2D>[0] = {}) {
    super({ inputPickable: true, hitArea: rect(-50, -50, 100, 100), ...opts })
  }
  override ready() {
    const on = (kind: string) => (e: PointerEvent2D) => this.log.push(`${kind} ${e.position}`)
    this.pointerDown.connect(on('down'))
    this.pointerMove.connect(on('move'))
    this.pointerUp.connect(on('up'))
    this.clicked.connect(on('click'))
  }
  get kinds(): string[] {
    return this.log.map((l) => l.split(' ')[0]!)
  }
}

const view = (n: Node2D) => n.unsafePixi as Container | null
const bounds = (g: Graphics) => {
  const b = g.getLocalBounds()
  return [b.minX, b.minY, b.width, b.height]
}

describe('clipRect 属性与 dump', () => {
  it('默认 null；赋新矩形触发 _version，同一引用不触发；dump 显示 (x, y, w, h)', async () => {
    const g = await createTestGame({ main: Scene })
    const plain = g.scene.add(new Node2D({ name: 'Plain' }))
    const win = g.scene.add(new Node2D({ name: 'Win', clipRect: rect(0, 0, 200, 100.5) }))
    expect(plain.clipRect).toBeNull()
    expect(win.clipRect).toEqual(rect(0, 0, 200, 100.5))
    expect(g.dump()).toContain('Win (Node2D) position=(0, 0) clipRect=(0, 0, 200, 100.5)')
    expect(g.dump()).toContain('Plain (Node2D) position=(0, 0)\n')

    const version = win._version
    win.clipRect = win.clipRect
    expect(win._version).toBe(version)
    win.clipRect = rect(10, 10, 50, 50)
    expect(win._version).toBe(version + 1)
    win.clipRect = null
    expect(win._version).toBe(version + 2)
    expect(g.dump()).not.toContain('clipRect')
  })
})

describe('渲染同步', () => {
  async function setup() {
    const g = await createTestGame({ main: Scene })
    const r = PixiRenderer._createForSyncTests()
    return { g, r, sync: () => r.sync(g.tree) }
  }

  it('遮罩是容器的第 0 个子对象、同时是容器的 mask，几何等于矩形；改矩形后更新；置 null 后移除并销毁', async () => {
    const { g, sync } = await setup()
    const n = g.scene.add(new Node2D({ clipRect: rect(10, 20, 300, 100) }))
    const child = n.add(new Node2D())
    sync()
    const c = view(n)!
    const mask = c.children[0] as Graphics
    expect(mask.label).toBe('__clip')
    expect(c.mask).toBe(mask)
    expect(bounds(mask)).toEqual([10, 20, 300, 100])
    expect(c.children[1]).toBe(view(child))
    expect(c.children.length).toBe(2)

    n.clipRect = rect(0, 0, 50, 60)
    sync()
    expect(c.children[0]).toBe(mask) // 复用同一个 Graphics
    expect(bounds(mask)).toEqual([0, 0, 50, 60])

    n.clipRect = null
    sync()
    expect(c.mask == null).toBe(true)
    expect(c.children.length).toBe(1)
    expect(c.children[0]).toBe(view(child))
    expect(mask.destroyed).toBe(true)
  })

  it('clipRect 没变时不重建几何（其它外观变化不触发 clear）', async () => {
    const { g, sync } = await setup()
    const n = g.scene.add(new Node2D({ clipRect: rect(0, 0, 10, 10) }))
    sync()
    const mask = view(n)!.children[0] as Graphics
    const clear = vi.spyOn(mask, 'clear')
    n.alpha = 0.5
    n.visible = false
    n.x = 100
    sync()
    sync()
    expect(clear).not.toHaveBeenCalled()
  })

  it('带内容的节点：顺序是遮罩、内容层、子节点', async () => {
    const { g, sync } = await setup()
    const bar = g.scene.add(new ColorRect({ size: v(100, 20), clipRect: rect(0, 0, 50, 20) }))
    const child = bar.add(new Node2D())
    sync()
    const c = view(bar)!
    expect(c.children.map((x) => x.label)).toEqual(['__clip', '__content', child.name])
    // 子节点换了顺序后重排仍然保持遮罩在最前
    const second = bar.add(new Node2D({ name: 'Second', zIndex: -1 }))
    sync()
    expect(c.children.map((x) => x.label)).toEqual(['__clip', '__content', child.name, 'Second'])
  })

  it('节点离开树：遮罩随显示对象销毁', async () => {
    const { g, sync } = await setup()
    const n = g.scene.add(new Node2D({ clipRect: rect(0, 0, 10, 10) }))
    sync()
    const mask = view(n)!.children[0] as Graphics
    n.queueFree()
    g.step()
    sync()
    expect(mask.destroyed).toBe(true)
    expect(view(n)).toBeNull()
  })

  it('子树里的 CanvasLayer 自成一层，不带祖先的遮罩', async () => {
    const { g, r, sync } = await setup()
    const n = g.scene.add(new Node2D({ clipRect: rect(0, 0, 10, 10) }))
    const layer = n.add(new CanvasLayer())
    const inLayer = layer.add(new Node2D())
    sync()
    const layerContainer = view(inLayer)!.parent!
    expect(layerContainer).not.toBe(view(n))
    expect(layerContainer.mask == null).toBe(true)
    expect(layerContainer.parent).toBe(r._stage.parent) // 场景容器（世界容器的父级），不在 n 的容器下面
  })
})

describe('拾取遵守裁剪', () => {
  it('裁剪外的子节点点不到，裁剪内照常；点在裁掉的部分算空白，触发 pointerPress 动作', async () => {
    const g = await createTestGame({ main: Scene, actions: { clipTap: [pointerPress()] } })
    const win = g.scene.add(new Node2D({ position: v(100, 100), clipRect: rect(0, 0, 200, 200) }))
    const b = win.add(new Button({ position: v(200, 100) })) // 世界 x 250–350，裁剪区世界 x 100–300
    g.tap(280, 200)
    expect(b.kinds).toEqual(['down', 'up', 'click'])
    expect(g.tree.input.isActionJustReleased('clipTap')).toBe(false)
    g.tap(320, 200)
    expect(b.kinds).toEqual(['down', 'up', 'click'])
    expect(g.tree.input.isActionJustReleased('clipTap')).toBe(true)
  })

  it('嵌套裁剪取交集', async () => {
    const g = await createTestGame({ main: Scene })
    const outer = g.scene.add(new Node2D({ clipRect: rect(0, 0, 200, 200) }))
    const inner = outer.add(new Node2D({ position: v(100, 0), clipRect: rect(0, 0, 200, 200) })) // 世界 x 100–300
    const b = inner.add(new Button({ position: v(100, 100) })) // 世界 x 150–250
    g.tap(170, 100) // 两个都在
    expect(b.kinds).toEqual(['down', 'up', 'click'])
    g.tap(220, 100) // 在 inner 里、在 outer 外
    expect(b.kinds).toEqual(['down', 'up', 'click'])
  })

  it('节点自己的 clipRect 也裁自己的点击区域', async () => {
    const g = await createTestGame({ main: Scene })
    const b = g.scene.add(new Button({ position: v(200, 200), clipRect: rect(-50, -50, 50, 100) })) // 只留左半
    g.tap(180, 200)
    expect(b.kinds).toEqual(['down', 'up', 'click'])
    g.tap(220, 200)
    expect(b.kinds).toEqual(['down', 'up', 'click'])
  })

  it('裁剪随节点的旋转和缩放走', async () => {
    const g = await createTestGame({ main: Scene })
    // 窗口绕原点转 90°、放大 2 倍：局部 (0..100, 0..50) → 世界 x ∈ [-100, 0]、y ∈ [0, 200]
    const win = g.scene.add(new Node2D({ position: v(300, 300), rotation: Math.PI / 2, scale: v(2, 2), clipRect: rect(0, 0, 100, 50) }))
    const b = win.add(new Button({ position: v(50, 25), hitArea: rect(-100, -100, 200, 200) }))
    g.tap(250, 400) // 世界 (300-50, 300+100)：在裁剪区里
    expect(b.kinds).toEqual(['down', 'up', 'click'])
    g.tap(350, 400) // 窗口的另一侧：在点击区域里但被裁掉
    expect(b.kinds).toEqual(['down', 'up', 'click'])
  })

  it('CanvasLayer 里的节点不受场景里祖先的裁剪', async () => {
    const g = await createTestGame({ main: Scene })
    const win = g.scene.add(new Node2D({ clipRect: rect(0, 0, 10, 10) }))
    const layer = win.add(new CanvasLayer())
    const b = layer.add(new Button({ position: v(400, 400) }))
    g.tap(400, 400)
    expect(b.kinds).toEqual(['down', 'up', 'click'])
  })

  it('按下在裁剪内、抬起在裁剪外（仍在点击区域内）：收到 pointerUp，不算 clicked', async () => {
    const g = await createTestGame({ main: Scene })
    const win = g.scene.add(new Node2D({ position: v(100, 100), clipRect: rect(0, 0, 200, 200) }))
    const b = win.add(new Button({ position: v(200, 100) }))
    g.pointerDown(280, 200)
    g.step()
    g.pointerUp(320, 200)
    g.step()
    expect(b.kinds).toEqual(['down', 'up'])
  })

  it('被拖着的节点滚出裁剪区：不触发帧首的取消，抬起时照常收到 pointerUp', async () => {
    const g = await createTestGame({ main: Scene })
    const win = g.scene.add(new Node2D({ position: v(100, 100), clipRect: rect(0, 0, 200, 200) }))
    const b = win.add(new Button({ position: v(100, 100) }))
    g.pointerDown(200, 200)
    g.step()
    b.x = 500 // 整个按钮滚出裁剪区
    g.step(3)
    expect(b.kinds).toEqual(['down'])
    g.pointerUp(200, 200)
    g.step()
    expect(b.kinds).toEqual(['down', 'up'])
  })

  it('有相机时：裁剪按世界坐标判断，屏幕上的点先换算成世界坐标', async () => {
    const g = await createTestGame({ main: Scene })
    g.scene.add(new Camera2D({ position: v(1000, 1000) })) // 世界 (1000, 1000) 在屏幕中心 (375, 667)
    const win = g.scene.add(new Node2D({ position: v(900, 900), clipRect: rect(0, 0, 100, 100) })) // 世界 x 900–1000
    const b = win.add(new Button({ position: v(100, 100) })) // 世界 x 950–1050
    g.step()
    g.tap(365, 657) // 世界 (990, 990)：在裁剪区里（裁剪区不含右下边界，所以不取 1000）
    expect(b.kinds).toEqual(['down', 'up', 'click'])
    g.tap(405, 657) // 世界 (1030, 990)：在点击区域里但被裁掉
    expect(b.kinds).toEqual(['down', 'up', 'click'])
  })
})
