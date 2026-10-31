import { describe, expect, it, vi } from 'vitest'
import { ColorRect, NineSliceSprite, rect, Scene, tex, v } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import { ProgressBar, ui, UI_SKIN } from '@sapling2d/ui'

async function setup() {
  const g = await createTestGame({ main: Scene, plugins: [ui()] })
  return g
}

describe('ProgressBar', () => {
  it('value 夹在范围内，ratio 0–1，valueChanged 只在值真的变化时发', async () => {
    const g = await setup()
    const bar = g.scene.add(new ProgressBar({ size: v(200, 40), fillPadding: 0 }))
    const changes: number[] = []
    bar.valueChanged.connect((x) => changes.push(x))
    expect([bar.value, bar.ratio, bar.minValue, bar.maxValue]).toEqual([0, 0, 0, 1])
    bar.value = 0.25
    bar.value = 0.25
    bar.value = 2
    bar.value = -1
    expect(changes).toEqual([0.25, 1, 0])
    expect(bar.ratio).toBe(0)
  })

  it('四个方向的 clipRect；0 时填充不显示，满时不裁剪；填充的 size 和位置始终不变', async () => {
    const g = await setup()
    const bar = g.scene.add(new ProgressBar({ size: v(200, 40), fillPadding: 0, value: 0.25 }))
    const fill = bar.fill
    expect([fill.position, fill.size]).toEqual([v(0, 0), v(200, 40)])
    expect(fill.clipRect).toEqual(rect(0, 0, 50, 40))
    bar.fillMode = 'rightToLeft'
    expect(fill.clipRect).toEqual(rect(150, 0, 50, 40))
    bar.fillMode = 'bottomToTop'
    expect(fill.clipRect).toEqual(rect(0, 30, 200, 10))
    bar.fillMode = 'topToBottom'
    expect(fill.clipRect).toEqual(rect(0, 0, 200, 10))
    expect([fill.position, fill.size]).toEqual([v(0, 0), v(200, 40)])

    bar.value = 0
    expect([fill.visible, fill.clipRect]).toEqual([false, null])
    bar.value = 1
    expect([fill.visible, fill.clipRect]).toEqual([true, null])
    bar.value = 0.5
    expect(fill.clipRect).toEqual(rect(0, 0, 200, 20))
  })

  it('fillPadding 内缩；size 变化时重新布局并重算裁剪', async () => {
    const g = await setup()
    const bar = g.scene.add(new ProgressBar({ size: v(200, 40), fillPadding: 6, value: 0.5 }))
    expect([bar.background.position, bar.background.size]).toEqual([v(0, 0), v(200, 40)])
    expect([bar.fill.position, bar.fill.size]).toEqual([v(6, 6), v(188, 28)])
    expect(bar.fill.clipRect).toEqual(rect(0, 0, 94, 28))
    bar.size = v(400, 60)
    expect([bar.background.size, bar.fill.size]).toEqual([v(400, 60), v(388, 48)])
    expect(bar.fill.clipRect).toEqual(rect(0, 0, 194, 48))
    bar.fillPadding = { left: 10, top: 0, right: 0, bottom: 0 }
    expect([bar.fill.position, bar.fill.size]).toEqual([v(10, 0), v(390, 60)])
  })

  it('自定义范围（血量 0..200）；改范围时重新夹紧', async () => {
    const g = await setup()
    const bar = g.scene.add(new ProgressBar({ size: v(200, 40), fillPadding: 0, maxValue: 200, value: 50 }))
    expect(bar.ratio).toBe(0.25)
    bar.value = 250
    expect(bar.value).toBe(200)
    bar.maxValue = 100
    expect([bar.value, bar.ratio]).toEqual([100, 1])
    bar.minValue = 50
    bar.value = 75
    expect(bar.ratio).toBe(0.5)
    bar.maxValue = bar.minValue // 空范围
    expect(bar.ratio).toBe(0)
  })

  it('Tween 能补间 value', async () => {
    const g = await setup()
    const bar = g.scene.add(new ProgressBar({ size: v(200, 40), fillPadding: 0, value: 0 }))
    bar.createTween().to(bar, { value: 1 }, 0.5)
    const samples: number[] = []
    for (let i = 0; i < 6; i++) {
      g.stepSeconds(0.1)
      samples.push(bar.ratio)
    }
    for (let i = 1; i < samples.length; i++) expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!)
    expect(samples[0]!).toBeGreaterThan(0)
    expect(bar.value).toBe(1)
    expect(bar.fill.clipRect).toBeNull()
  })

  it('默认皮肤：panel 底、barFill 填充按 fillColor 染色、内缩 6；fillColor 运行时可改', async () => {
    const g = await setup()
    const bar = g.scene.add(new ProgressBar({ size: v(200, 40), value: 0.5 }))
    expect(bar.background).toBeInstanceOf(NineSliceSprite)
    expect((bar.background as NineSliceSprite).texture).toBe(UI_SKIN.panel.texture)
    expect((bar.fill as NineSliceSprite).texture).toBe(UI_SKIN.barFill.texture)
    expect((bar.fill as NineSliceSprite).margins).toEqual({ left: 10, top: 10, right: 10, bottom: 10 })
    expect(bar.fill.selfModulate).toBe(0x5ad26a)
    expect(bar.fill.position).toEqual(v(6, 6))
    bar.fillColor = 0xe04040
    expect(bar.fill.selfModulate).toBe(0xe04040)
  })

  it('纯色模式不需要插件；自己的贴图和边距；没装插件用默认皮肤警告一次', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const g = await createTestGame({ main: Scene })
      const flat = g.scene.add(new ProgressBar({ size: v(100, 10), textureBackground: null, textureFill: null, backgroundColor: 0x111111, fillColor: 0xff0000, value: 0.5 }))
      expect(flat.background).toBeInstanceOf(ColorRect)
      expect((flat.fill as ColorRect).color).toBe(0xff0000)
      expect(flat.fill.position).toEqual(v(0, 0)) // 纯色默认不内缩
      expect(warn).not.toHaveBeenCalled()
      const skinned = g.scene.add(new ProgressBar({ textureBackground: tex('bar-bg.png'), marginsBackground: 8, textureFill: tex('bar-fill.png'), marginsFill: 4 }))
      expect((skinned.background as NineSliceSprite).margins.left).toBe(8)
      expect((skinned.fill as NineSliceSprite).margins.left).toBe(4)
      expect(warn).not.toHaveBeenCalled()
      g.scene.add(new ProgressBar())
      g.scene.add(new ProgressBar())
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('dump 显示 value（和非默认的 fillMode）', async () => {
    const g = await setup()
    g.scene.add(new ProgressBar({ name: 'Hp', size: v(200, 40), value: 0.4, fillMode: 'rightToLeft' }))
    expect(g.dump()).toContain('Hp (ProgressBar) position=(0, 0) size=(200, 40) value=0.4 fillMode=rightToLeft')
  })
})
