import { describe, expect, it, vi } from 'vitest'
import { CanvasLayer, ColorRect, NineSliceSprite, Scene, sfx, tex, v, type Plugin } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import { Button, ui, UI_SKIN, UiTheme } from '@sapling2d/ui'

async function setup(plugins: Plugin[] = [ui()]) {
  const g = await createTestGame({ main: Scene, plugins })
  const hud = g.scene.add(new CanvasLayer())
  const counts = { pressed: 0, released: 0, clicked: 0 }
  const b = hud.add(new Button({ name: 'Start', text: '开始', size: v(300, 100), position: v(100, 200) }))
  b.pressed.connect(() => counts.pressed++)
  b.released.connect(() => counts.released++)
  b.clicked.connect(() => counts.clicked++)
  return { g, hud, b, counts }
}
const INSIDE = [250, 250] as const
const OUTSIDE = [600, 250] as const

describe('ui() 与默认皮肤', () => {
  it('提供 UiTheme，预加载默认皮肤', async () => {
    const { g } = await setup()
    const theme = g.tree.get(UiTheme)
    expect(theme.pressEffect).toEqual({ scale: 1.1, tint: 0xffffff, duration: 0.08 })
    expect(UI_SKIN.button.texture.isLoaded).toBe(true)
    expect(UI_SKIN.barFill.texture.isLoaded).toBe(true)
  })

  it('没装 ui() 用默认皮肤的按钮警告一次；纯色按钮不警告', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const g = await createTestGame({ main: Scene })
      g.scene.add(new Button({ text: 'a' }))
      g.scene.add(new Button({ text: 'b' }))
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toContain('plugins: [ui()]')
      const flat = g.scene.add(new Button({ text: 'c', texture: null, backgroundColor: 0x336699 }))
      expect(warn).toHaveBeenCalledTimes(1)
      expect(flat.background).toBeInstanceOf(ColorRect)
      expect((flat.background as ColorRect).color).toBe(0x336699)
    } finally {
      warn.mockRestore()
    }
  })
})

describe('Button', () => {
  it('结构：原点左上角、主体在中心、底图铺满、文字居中；默认皮肤和深色文字', async () => {
    const { b } = await setup()
    expect(b.body.position).toEqual(v(150, 50))
    expect(b.background).toBeInstanceOf(NineSliceSprite)
    expect([b.background.position, b.background.size]).toEqual([v(-150, -50), v(300, 100)])
    expect((b.background as NineSliceSprite).texture).toBe(UI_SKIN.button.texture)
    expect([b.label.text, b.label.align, b.label.verticalAlign, b.label.color]).toEqual(['开始', 'center', 'center', 0x2b2b33])
    expect(b.text).toBe('开始')
    b.text = '继续'
    expect(b.label.text).toBe('继续')
    expect([b.hitTest(v(0, 0)), b.hitTest(v(300, 50))]).toEqual([true, false])
    b.size = v(400, 120)
    expect([b.body.position, b.background.position, b.background.size]).toEqual([v(200, 60), v(-200, -60), v(400, 120)])
  })

  it('按下：主体缩放到 1.1、换成按下态底图、pressed 一次；在按钮内抬起：clicked 一次、released 一次、恢复', async () => {
    const { g, b, counts } = await setup()
    g.pointerDown(...INSIDE)
    g.step(10)
    expect(b.isPressed).toBe(true)
    expect(b.body.scale.x).toBeCloseTo(1.1, 3)
    expect(b.scale).toEqual(v(1, 1)) // 节点自身不变
    expect((b.background as NineSliceSprite).texture).toBe(UI_SKIN.buttonPressed.texture)
    expect(counts).toEqual({ pressed: 1, released: 0, clicked: 0 })
    expect(g.dump()).toContain('Start (Button) position=(100, 200) size=(300, 100) pressed=true')
    g.pointerUp(...INSIDE)
    g.step(10)
    expect(b.isPressed).toBe(false)
    expect(b.body.scale.x).toBeCloseTo(1, 3)
    expect((b.background as NineSliceSprite).texture).toBe(UI_SKIN.button.texture)
    expect(counts).toEqual({ pressed: 1, released: 1, clicked: 1 })
    expect(g.dump()).not.toContain('pressed=')
  })

  it('滑出：恢复但不 released；滑回：再按下；在外面抬起：released，不 clicked', async () => {
    const { g, b, counts } = await setup()
    g.pointerDown(...INSIDE)
    g.step(10)
    g.pointerMove(...OUTSIDE)
    g.step(10)
    expect([b.isPressed, b.body.scale.x]).toEqual([false, 1])
    expect(counts).toEqual({ pressed: 1, released: 0, clicked: 0 })
    g.pointerMove(...INSIDE)
    g.step(10)
    expect(b.isPressed).toBe(true)
    expect(b.body.scale.x).toBeCloseTo(1.1, 3)
    g.pointerMove(...OUTSIDE)
    g.pointerUp(...OUTSIDE)
    g.step(10)
    expect(counts).toEqual({ pressed: 1, released: 1, clicked: 0 })
    expect(b.body.scale.x).toBeCloseTo(1, 3)
  })

  it('pressEffect: false 主体不动；配置 tint 时底图 selfModulate 压暗；全局默认可被 ui() 改', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ui({ pressEffect: { scale: 0.9, duration: 0.05 } })] })
    const plain = g.scene.add(new Button({ position: v(0, 0), pressEffect: false }))
    const tinted = g.scene.add(new Button({ position: v(0, 300), pressEffect: { scale: 1, tint: 0x808080, duration: 0.05 } }))
    const themed = g.scene.add(new Button({ position: v(0, 600) }))
    g.pointerDown(150, 50, 1)
    g.pointerDown(150, 350, 2)
    g.pointerDown(150, 650, 3)
    g.step(10)
    expect(plain.body.scale.x).toBe(1)
    expect(tinted.body.scale.x).toBe(1)
    expect(tinted.background.selfModulate).toBe(0x808080)
    expect(themed.body.scale.x).toBeCloseTo(0.9, 3)
  })

  it('duration: 0 的反馈立刻生效，不经过补间', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ui()] })
    const b = g.scene.add(new Button({ position: v(0, 0), pressEffect: { tint: 0xd0d0d0, scale: 0.9, duration: 0 } }))
    g.pointerDown(150, 50)
    g.step()
    expect([b.background.selfModulate, b.body.scale.x]).toEqual([0xd0d0d0, 0.9])
    g.pointerUp(150, 50)
    g.step()
    expect([b.background.selfModulate, b.body.scale.x]).toEqual([0xffffff, 1])
  })

  it('切后台：回到前台的第一帧 released 一次、不 clicked、主体恢复', async () => {
    const { g, b, counts } = await setup()
    g.pointerDown(...INSIDE)
    g.step(10)
    g.setFocus(false) // 游戏挂起（pauseOnBackground），按着的手指排队成取消
    g.step(10)
    g.setFocus(true)
    g.step()
    expect(counts).toEqual({ pressed: 1, released: 1, clicked: 0 })
    expect(b.isPressed).toBe(false)
    g.step(10)
    expect(b.body.scale.x).toBeCloseTo(1, 3)
    g.tap(...INSIDE)
    expect(counts.clicked).toBe(1)
  })

  it('按住时被隐藏：下一帧 released，不 clicked', async () => {
    const { g, b, counts } = await setup()
    g.pointerDown(...INSIDE)
    g.step(2)
    b.visible = false
    g.step(10)
    expect(counts).toEqual({ pressed: 1, released: 1, clicked: 0 })
    g.pointerUp(...INSIDE)
    g.step()
    expect(counts).toEqual({ pressed: 1, released: 1, clicked: 0 })
  })

  it('按住时 disabled：立刻 released、恢复；之后抬起不 clicked；禁用期间点不到、半透明；再启用恢复', async () => {
    const { g, b, counts } = await setup()
    g.pointerDown(...INSIDE)
    g.step(2)
    b.disabled = true
    expect(counts).toEqual({ pressed: 1, released: 1, clicked: 0 })
    expect([b.isPressed, b.alpha, b.inputPickable]).toEqual([false, 0.5, false])
    expect(g.dump()).toContain('disabled=true')
    g.pointerUp(...INSIDE)
    g.step(10)
    expect(counts).toEqual({ pressed: 1, released: 1, clicked: 0 })
    expect(b.body.scale.x).toBeCloseTo(1, 3)
    g.tap(...INSIDE)
    expect(counts.clicked).toBe(0)
    b.disabled = false
    expect([b.alpha, b.inputPickable]).toEqual([1, true])
    g.tap(...INSIDE)
    expect(counts.clicked).toBe(1)
  })

  it('clickSound：按钮自己的 > ui() 的全局 > 无；null 显式关闭', async () => {
    class Main extends Scene {
      static override assets = { other: sfx('other.mp3') } // 按钮自己的音效由场景预加载；全局的由 ui() 预加载
    }
    const g = await createTestGame({ main: Main, plugins: [ui({ clickSound: sfx('click.mp3') })] })
    const themed = g.scene.add(new Button({ position: v(0, 0) }))
    const own = g.scene.add(new Button({ position: v(0, 300), clickSound: Main.assets.other }))
    const silent = g.scene.add(new Button({ position: v(0, 600), clickSound: null }))
    g.tap(150, 50)
    g.tap(150, 350)
    g.tap(150, 650)
    expect(g.audio.log.map((s) => s.path)).toEqual(['click.mp3', 'other.mp3'])
    expect([themed.clickSound, own.clickSound?.path, silent.clickSound]).toEqual([undefined, 'other.mp3', null])

    const bare = await createTestGame({ main: Scene })
    bare.scene.add(new Button({ texture: null }))
    bare.tap(150, 50)
    expect(bare.audio.log).toEqual([])
  })

  it('第二根手指按在同一个按钮上被忽略', async () => {
    const { g, counts } = await setup()
    g.pointerDown(250, 250, 1)
    g.pointerDown(260, 260, 2)
    g.step()
    expect(counts.pressed).toBe(1)
    g.pointerUp(260, 260, 2)
    g.step()
    expect(counts.released).toBe(0)
    g.pointerUp(250, 250, 1)
    g.step()
    expect(counts).toEqual({ pressed: 1, released: 1, clicked: 2 }) // clicked 是节点信号：两根手指各算一次
  })

  it('自己的贴图和边距；离开树时按着的手指算松开', async () => {
    const { g, hud, counts } = await setup()
    const skinned = hud.add(new Button({ position: v(100, 600), texture: tex('btn.png'), margins: 12, texturePressed: null, text: 'x' }))
    expect((skinned.background as NineSliceSprite).margins).toEqual({ left: 12, top: 12, right: 12, bottom: 12 })
    expect(skinned.label.color).toBe(0xffffff)
    g.pointerDown(250, 650)
    g.step(2)
    expect((skinned.background as NineSliceSprite).texture).toBe(tex('btn.png')) // texturePressed: null 不换图
    let released = 0
    skinned.released.connect(() => released++)
    hud.remove(skinned)
    expect([released, skinned.isPressed, skinned.body.scale.x]).toEqual([1, false, 1])
    expect(counts.released).toBe(0)
  })
})
