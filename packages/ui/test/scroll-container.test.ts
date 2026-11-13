import { describe, expect, it } from 'vitest'
import { CanvasLayer, Rect2, Scene, v, type Vector2 } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import { Button, ScrollContainer, ui, type ScrollContainerOptions } from '@sapling2d/ui'

/**
 * 容器在 (100, 100)，400×600；20 行按钮，每行 300×80（x 0..300，行距 100），内容高 2000。
 * 右边 x 300..400 是空白；按钮 i 的中心在屏幕 (250, 140 + 100 i - scrollY)。
 */
async function setup(options: ScrollContainerOptions = {}) {
  const g = await createTestGame({ main: Scene, plugins: [ui()] })
  const hud = g.scene.add(new CanvasLayer())
  const list = hud.add(new ScrollContainer({ name: 'List', position: v(100, 100), size: v(400, 600), contentSize: v(400, 2000), ...options }))
  const clicks: number[] = []
  const released: number[] = []
  const rows: Button[] = []
  for (let i = 0; i < 20; i++) {
    const b = list.content.add(new Button({ name: `Row${i}`, text: `${i}`, texture: null, size: v(300, 80), position: v(0, i * 100) }))
    b.clicked.connect(() => clicks.push(i))
    b.released.connect(() => released.push(i))
    rows.push(b)
  }
  let scrolledCount = 0
  list.scrolled.connect(() => scrolledCount++)
  return { g, hud, list, rows, clicks, released, scrolled: () => scrolledCount }
}

const BLANK = v(450, 600)
const ROW1 = v(250, 240)

/** 匀速拖动、不松手：按下，推进 1 帧，然后 `frames` 帧每帧移动一次。 */
function hold(g: Awaited<ReturnType<typeof setup>>['g'], from: Vector2, to: Vector2, frames = 10) {
  g.pointerDown(from.x, from.y)
  g.step()
  for (let i = 1; i <= frames; i++) {
    g.pointerMove(from.x + ((to.x - from.x) * i) / frames, from.y + ((to.y - from.y) * i) / frames)
    g.step()
  }
}

describe('ScrollContainer 基础', () => {
  it('结构：可点击、clipRect 等于 rect 并随 size 更新；content 子节点；默认只开竖向', async () => {
    const { list } = await setup()
    expect([list.inputPickable, list.clipRect, list.content.name]).toEqual([true, new Rect2(0, 0, 400, 600), 'Content'])
    expect([list.horizontal, list.vertical, list.dragThreshold, list.inertia, list.bounce]).toEqual([false, true, 12, true, true])
    expect(list.maxScroll).toEqual(v(0, 1400))
    list.size = v(400, 500)
    expect(list.clipRect).toEqual(new Rect2(0, 0, 400, 500))
  })

  it('按在空白处拖动：超过阈值之后的位移都算进 scrollOffset，内容反向移动，scrolled 发出', async () => {
    const { g, list, scrolled } = await setup({ inertia: false })
    g.drag(BLANK, v(450, 500)) // 每帧 10，第 2 帧（20）超过阈值
    expect(list.scrollOffset).toEqual(v(0, 80))
    expect(list.content.position).toEqual(v(0, -80))
    expect(scrolled()).toBeGreaterThan(0)
    g.step(30)
    expect(list.scrollY).toBe(80) // 关掉惯性：松手即停
  })

  it('阈值内轻点条目：按钮 clicked，不滚动', async () => {
    const { g, list, clicks } = await setup()
    g.pointerDown(ROW1.x, ROW1.y)
    g.step()
    g.pointerMove(ROW1.x, ROW1.y - 8)
    g.step()
    g.pointerUp(ROW1.x, ROW1.y - 8)
    g.step()
    expect(clicks).toEqual([1])
    expect(list.scrollY).toBe(0)
  })

  it('按在条目上拖过阈值：容器接管，按钮 released 一次、视觉恢复、无 clicked', async () => {
    const { g, list, rows, clicks, released } = await setup({ inertia: false })
    hold(g, ROW1, v(250, 140))
    expect(rows[1]!.isPressed).toBe(false)
    expect(released).toEqual([1])
    expect(list.scrollY).toBe(80)
    g.pointerUp(250, 140)
    g.step()
    expect(clicks).toEqual([])
    expect(released).toEqual([1])
  })

  it('只开竖向：横向拖动不滚动、不抢手势（按钮照常 clicked）；只开横向时对称', async () => {
    const a = await setup()
    a.g.drag(ROW1, v(150, 240))
    expect([a.list.scrollOffset, a.clicks]).toEqual([v(0, 0), [1]])

    const b = await setup({ horizontal: true, vertical: false, contentSize: v(1200, 600), inertia: false })
    b.g.drag(ROW1, v(250, 205)) // 竖向 35，仍在按钮里
    expect([b.list.scrollOffset, b.clicks]).toEqual([v(0, 0), [1]])
    b.g.drag(BLANK, v(350, 600))
    expect(b.list.scrollOffset).toEqual(v(80, 0))
  })

  it('两个轴都开：任一轴超过阈值就接管', async () => {
    const { g, list, clicks } = await setup({ horizontal: true, contentSize: v(1200, 2000), inertia: false })
    g.drag(ROW1, v(150, 240))
    expect([list.scrollOffset, clicks]).toEqual([v(80, 0), []])
  })

  it('夹紧：拖过头停在边界（bounce 关）；scrollTo 立即生效并夹紧；内容比容器小时为 0', async () => {
    const { g, list } = await setup({ bounce: false })
    g.drag(BLANK, v(450, 900))
    expect(list.scrollY).toBe(0)
    list.scrollTo(v(0, 9999))
    expect(list.scrollY).toBe(1400)
    list.scrollY = 300
    expect(list.scrollOffset).toEqual(v(0, 300))
    list.contentSize = v(400, 500)
    expect(list.scrollY).toBe(0)
  })

  it('滚动中第二根手指的按下被忽略', async () => {
    const { g, list } = await setup({ inertia: false })
    hold(g, BLANK, v(450, 500))
    g.pointerDown(450, 300, 2)
    g.step()
    g.pointerMove(450, 100, 2)
    g.step()
    expect(list.scrollY).toBe(80)
    g.pointerMove(450, 450)
    g.step()
    expect(list.scrollY).toBe(130)
  })

  it('切后台、容器隐藏：拖动结束，没有残留状态', async () => {
    const { g, list } = await setup()
    hold(g, BLANK, v(450, 500))
    g.setFocus(false)
    g.setFocus(true)
    g.step()
    expect(list.isScrolling).toBe(false)
    g.pointerMove(450, 300) // 被取消的手指：之后的移动不滚动
    g.step()
    expect(list.scrollY).toBe(80)

    hold(g, BLANK, v(450, 500))
    list.visible = false
    g.step()
    list.visible = true
    g.step(60)
    expect(list.isScrolling).toBe(false)
    expect(list.scrollY).toBe(160)
  })

  it('暂停：普通容器不能滚动；processMode always 的容器照常滚动', async () => {
    const a = await setup({ inertia: false })
    a.g.tree.paused = true
    a.g.drag(BLANK, v(450, 500))
    expect(a.list.scrollY).toBe(0)

    const b = await setup({ inertia: false, processMode: 'always' })
    b.g.tree.paused = true
    b.g.drag(BLANK, v(450, 500))
    expect(b.list.scrollY).toBe(80)
  })

  it('滚出可见区的条目点不到', async () => {
    const { g, clicks } = await setup()
    g.tap(250, 140 + 100 * 7) // 第 7 行在 y 700..780（容器内），裁在外面
    expect(clicks).toEqual([])
    g.tap(250, 140 + 100 * 5)
    expect(clicks).toEqual([5])
  })

  it('dump 显示 contentSize 和非零的 scrollOffset', async () => {
    const { g, list } = await setup()
    expect(g.dump()).toContain('List (ScrollContainer) position=(100, 100) clipRect=(0, 0, 400, 600) size=(400, 600) contentSize=(400, 2000)')
    expect(g.dump()).not.toContain('scrollOffset')
    list.scrollTo(v(0, 250))
    expect(g.dump()).toContain('contentSize=(400, 2000) scrollOffset=(0, 250)')
  })
})

describe('ScrollContainer 手感：惯性、回弹、scrollTo 动画', () => {
  it('快速拖动后松手：继续沿拖动方向滚动、速度单调衰减、最终停下且不越界', async () => {
    const { g, list } = await setup({ contentSize: v(400, 6000) })
    g.drag(BLANK, v(450, 300), { frames: 5 })
    const released = list.scrollY
    const deltas: number[] = []
    let last = released
    for (let i = 0; i < 300 && list.isScrolling; i++) {
      g.step()
      deltas.push(list.scrollY - last)
      last = list.scrollY
    }
    expect(list.isScrolling).toBe(false)
    expect(last).toBeGreaterThan(released + 200)
    expect(last).toBeLessThanOrEqual(5400)
    for (let i = 1; i < deltas.length; i++) expect(deltas[i]!).toBeLessThanOrEqual(deltas[i - 1]! + 1e-9)
    expect(deltas[0]!).toBeGreaterThan(0)
  })

  it('拖过边界：越界按阻尼缩小；松手后回弹到边界停住；bounce 关时拖动期间就夹紧', async () => {
    const { g, list } = await setup()
    hold(g, BLANK, v(450, 900)) // 向下拖 300：内容顶部越界
    expect(list.scrollY).toBeLessThan(0)
    expect(list.scrollY).toBeGreaterThan(-288)
    g.pointerUp(450, 900)
    g.step(60)
    expect(list.scrollY).toBe(0)
    expect(list.isScrolling).toBe(false)
  })

  it('惯性冲到边界：bounce 开时越界再回弹，关时停在边界', async () => {
    const a = await setup()
    a.list.scrollTo(v(0, 1300))
    a.g.drag(BLANK, v(450, 300), { frames: 5 })
    let max = 0
    for (let i = 0; i < 120; i++) {
      a.g.step()
      max = Math.max(max, a.list.scrollY)
    }
    expect(max).toBeGreaterThan(1400)
    expect(a.list.scrollY).toBe(1400)

    const b = await setup({ bounce: false })
    b.list.scrollTo(v(0, 1300))
    b.g.drag(BLANK, v(450, 300), { frames: 5 })
    for (let i = 0; i < 120; i++) {
      b.g.step()
      expect(b.list.scrollY).toBeLessThanOrEqual(1400)
    }
    expect(b.list.scrollY).toBe(1400)
  })

  it('inertia 关：松手即停', async () => {
    const { g, list } = await setup({ inertia: false })
    g.drag(BLANK, v(450, 300), { frames: 5 })
    const y = list.scrollY
    g.step(30)
    expect(list.scrollY).toBe(y)
  })

  it('scrollTo 动画：有限帧内到达并夹紧；动画中按下中断', async () => {
    const { g, list } = await setup()
    list.scrollTo(v(0, 5000), { animate: true })
    g.step()
    expect(list.scrollY).toBeGreaterThan(0)
    expect(list.scrollY).toBeLessThan(1400)
    g.step(30)
    expect(list.scrollY).toBe(1400)

    list.scrollTo(v(0, 0), { animate: true })
    g.step(3)
    g.pointerDown(BLANK.x, BLANK.y)
    g.step(30)
    const y = list.scrollY
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(1400)
    g.pointerUp(BLANK.x, BLANK.y)
    g.step(30)
    expect(list.scrollY).toBe(y)
  })

  it('惯性滚动中按在条目上：只是按停，不点到条目', async () => {
    const { g, list, clicks } = await setup()
    g.drag(BLANK, v(450, 300), { frames: 5 })
    g.step(2)
    expect(list.isScrolling).toBe(true)
    g.tap(ROW1.x, ROW1.y)
    expect(clicks).toEqual([])
    const y = list.scrollY
    g.step(10)
    expect(list.scrollY).toBe(y)
  })

  it('timeScale 0.5：惯性放慢；暂停时 always 的容器惯性照常推进', async () => {
    const run = async (timeScale: number) => {
      const { g, list } = await setup()
      g.drag(BLANK, v(450, 300), { frames: 5 })
      g.tree.timeScale = timeScale
      const y = list.scrollY
      g.step(10)
      return list.scrollY - y
    }
    expect(await run(0.5)).toBeLessThan((await run(1)) * 0.6)

    const { g, list } = await setup({ processMode: 'always' })
    g.drag(BLANK, v(450, 300), { frames: 5 })
    g.tree.paused = true
    const y = list.scrollY
    g.step(5)
    expect(list.scrollY).toBeGreaterThan(y)
  })

  it('惯性中切后台：速度清零并夹紧', async () => {
    const { g, list } = await setup()
    g.drag(BLANK, v(450, 300), { frames: 5 })
    g.setFocus(false)
    g.setFocus(true)
    const y = list.scrollY
    g.step(10)
    expect(list.scrollY).toBe(y)
    expect(list.isScrolling).toBe(false)
  })

  it('确定性：同一组输入两次运行，每帧的 scrollOffset 相同', async () => {
    const trace = async () => {
      const { g, list } = await setup()
      const ys: number[] = []
      g.drag(BLANK, v(450, 900), { frames: 4 })
      for (let i = 0; i < 40; i++) {
        g.step()
        ys.push(list.scrollY)
      }
      g.drag(BLANK, v(450, 200), { frames: 3 })
      for (let i = 0; i < 80; i++) {
        g.step()
        ys.push(list.scrollY)
      }
      return ys
    }
    expect(await trace()).toEqual(await trace())
  })
})
