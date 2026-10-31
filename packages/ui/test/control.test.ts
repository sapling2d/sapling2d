import { describe, expect, it, vi } from 'vitest'
import { CanvasLayer, rect, Scene, v } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import { Control } from '@sapling2d/ui'

describe('Control', () => {
  it('size / rect；点击区域默认是 rect，设了 hitArea 用 hitArea', async () => {
    const g = await createTestGame({ main: Scene })
    const c = g.scene.add(new Control({ size: v(100, 50) }))
    expect(c.rect).toEqual(rect(0, 0, 100, 50))
    expect([c.hitTest(v(0, 0)), c.hitTest(v(99, 49)), c.hitTest(v(100, 25)), c.hitTest(v(-1, 0))]).toEqual([true, true, false, false])
    c.hitArea = rect(-10, -10, 20, 20)
    expect([c.hitTest(v(0, 0)), c.hitTest(v(50, 25))]).toEqual([true, false])
    expect(g.dump()).toContain('(Control) position=(0, 0) size=(100, 50)')
  })

  it('anchor：按 safeRect 的边 / 中心定位，换屏后重算，左右同时给时拉伸', async () => {
    const g = await createTestGame({ main: Scene })
    const hud = g.scene.add(new CanvasLayer())
    const topRight = hud.add(new Control({ name: 'TR', size: v(100, 40), anchor: { right: 20, top: 30 } }))
    const stretch = hud.add(new Control({ size: v(10, 40), anchor: { left: 10, right: 10, bottom: 0 } }))
    const center = hud.add(new Control({ size: v(100, 40), anchor: { centerX: 0, centerY: 0 } }))
    expect(topRight.position).toEqual(v(630, 30))
    expect([stretch.position, stretch.size]).toEqual([v(10, 1294), v(730, 40)])
    expect(center.position).toEqual(v(325, 647))
    expect(g.dump()).toContain('TR (Control) position=(630, 30) size=(100, 40) anchor=right:20,top:30')

    // 安全区变了（刘海 + Home 条）：按新的 safeRect 重排
    g.setScreen({ width: 750, height: 1334, pixelRatio: 1, safeArea: { left: 0, top: 100, right: 750, bottom: 1234 } })
    expect(topRight.position).toEqual(v(630, 130))
    expect(stretch.position).toEqual(v(10, 1194))
    expect(center.position).toEqual(v(325, 647))
  })

  it('anchorTo: visible 用整个可见区域（宽屏时比设计区宽）', async () => {
    const g = await createTestGame({ main: Scene })
    const hud = g.scene.add(new CanvasLayer())
    const safe = hud.add(new Control({ size: v(50, 50), anchor: { left: 0, top: 0 } }))
    const visible = hud.add(new Control({ size: v(50, 50), anchor: { left: 0, top: 0 }, anchorTo: 'visible' }))
    // 宽屏：可见区域向两侧各扩 125；窗口左边 100 像素不安全
    g.setScreen({ width: 1000, height: 1334, pixelRatio: 1, safeArea: { left: 100, top: 0, right: 1000, bottom: 1334 } })
    expect(safe.position).toEqual(v(-25, 0))
    expect(visible.position).toEqual(v(-125, 0))
  })

  it('size 变化时右锚定的控件重新贴右边；anchor 可以后设', async () => {
    const g = await createTestGame({ main: Scene })
    const hud = g.scene.add(new CanvasLayer())
    const c = hud.add(new Control({ size: v(100, 40), anchor: { right: 20 } }))
    expect(c.x).toBe(630)
    c.size = v(200, 40)
    expect(c.x).toBe(530)
    const later = hud.add(new Control({ size: v(100, 40) }))
    later.anchor = { bottom: 0 }
    expect(later.y).toBe(1294)
  })

  it('场景里（不在 CanvasLayer）设 anchor 警告一次', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const g = await createTestGame({ main: Scene })
      const c = g.scene.add(new Control({ size: v(100, 40), anchor: { right: 20 } }))
      g.setScreen({ width: 750, height: 1334, pixelRatio: 1, safeArea: { left: 0, top: 50, right: 750, bottom: 1334 } })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toContain('CanvasLayer')
      expect(c.x).toBe(630) // 仍然按安全区算
    } finally {
      warn.mockRestore()
    }
  })

  it('离开树后不再响应屏幕变化', async () => {
    const g = await createTestGame({ main: Scene })
    const hud = g.scene.add(new CanvasLayer())
    const c = hud.add(new Control({ size: v(100, 40), anchor: { top: 0 } }))
    hud.remove(c)
    g.setScreen({ width: 750, height: 1334, pixelRatio: 1, safeArea: { left: 0, top: 100, right: 750, bottom: 1334 } })
    expect(c.y).toBe(0)
  })
})
