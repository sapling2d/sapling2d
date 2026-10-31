import { describe, expect, it } from 'vitest'
import { Scene } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import { spine, spineSkeleton, SpineSkeleton } from '@sapling2d/spine'
import { FIXTURES, MINIMAL, setup } from './helpers'

describe('spineSkeleton 资源', () => {
  it('放进 static assets 加载：骨架解析、页图句柄（图集目录 + 页名）、名字列表、设置姿势的包围盒（y 向下）', async () => {
    await setup(() => {})
    expect(MINIMAL.isLoaded).toBe(true)
    expect(MINIMAL.kind).toBe('spine')
    expect(MINIMAL.atlasPath).toBe('minimal/minimal.atlas')
    expect(MINIMAL.pages.map((p) => p.path)).toEqual(['minimal/minimal.png'])
    expect(MINIMAL.pages[0]!.isLoaded).toBe(true)
    expect(MINIMAL.pages[0]!._premultiplied).toBe(false)
    expect(MINIMAL.animationNames).toEqual(['swing', 'blink', 'reorder', 'walk'])
    expect(MINIMAL.skinNames).toEqual(['default', 'red'])
    expect(MINIMAL.boneNames).toEqual(['root', 'arm', 'hand'])
    expect(MINIMAL.slotNames).toEqual(['clip', 'body', 'arm', 'fx'])
    expect(MINIMAL.eventNames).toEqual(['hit', 'step'])
    const r = MINIMAL.rect
    expect([r.x, r.y, r.width, r.height].map((n) => Math.round(n))).toEqual([-16, -16, 76, 32])
  })

  it('atlas 选项：pma 图集把页图标成预乘；scale 缩放包围盒；同一路径同一句柄、不同选项不同句柄', async () => {
    const pma = spineSkeleton('minimal/minimal.json', { atlas: 'minimal/minimal-pma.atlas' })
    const half = spineSkeleton('minimal/minimal.json', { scale: 0.5 })
    await setup(() => {}, { assets: { pma, half } })
    expect(pma.pages.map((p) => p.path)).toEqual(['minimal/pma.png'])
    expect(pma.pages[0]!._premultiplied).toBe(true)
    const r = half.rect
    expect([r.x, r.y, r.width, r.height].map((n) => Math.round(n))).toEqual([-8, -8, 38, 16])
    expect(spineSkeleton('minimal/minimal.json')).toBe(MINIMAL)
    expect(spineSkeleton('minimal/minimal.json', { scale: 0.5 })).toBe(half)
    expect(half).not.toBe(MINIMAL)
    expect(() => spineSkeleton('x.json', { scale: 0 })).toThrow(/scale must be > 0/)
  })

  it('没加载就用：data / rect 报错并提示放进 static assets', () => {
    const never = spineSkeleton('minimal/minimal.json', { scale: 0.333 })
    expect(() => never.data).toThrow(/is not loaded yet; declare it in the scene's static assets/)
    expect(() => never.rect).toThrow(/not loaded/)
    expect(never.isLoaded).toBe(false)
    expect(never._textures()).toEqual([])
  })

  it('版本不是 4.3：报错说明要重新导出', async () => {
    const old = spineSkeleton('bad/old-version.json')
    await expect(setup(() => {}, { assets: { old } })).rejects.toThrow(/exported from Spine 4\.2\.33, but @sapling2d\/spine reads Spine 4\.3 exports.*Re-export it from Spine 4\.3/)
  })

  it('图集里缺 region：报错带路径和 region 名；不是 Spine 导出的 JSON 也报错', async () => {
    const missing = spineSkeleton('bad/missing-region.json')
    await expect(setup(() => {}, { assets: { missing } })).rejects.toThrow(/spineSkeleton\('bad\/missing-region\.json'\): .*spark.*\(atlas: bad\/missing-region\.atlas\)/)
    const notSpine = spineSkeleton('bad/not-spine.json')
    await expect(setup(() => {}, { assets: { notSpine } })).rejects.toThrow(/is not a Spine skeleton export/)
  })

  it('官方 spineboy（4.3 导出）能加载', async () => {
    const boy = spineSkeleton('spineboy/spineboy-ess.json', { atlas: 'spineboy/spineboy.atlas' })
    await setup(() => {}, { assets: { boy } })
    expect(boy.animationNames).toContain('walk')
    expect(boy.boneNames.length).toBeGreaterThan(10)
    expect(boy.pages.map((p) => p.path)).toEqual(['spineboy/spineboy.png'])
    expect(boy.rect.height).toBeGreaterThan(300)
  })

  it('切场景：旧场景独有的骨架页图卸载，数据保留，切回来只重新加载页图', async () => {
    const boy = spineSkeleton('spineboy/spineboy-ess.json', { atlas: 'spineboy/spineboy.atlas', scale: 2 })
    class A extends Scene {
      static override assets = { boy }
    }
    class B extends Scene {}
    const g = await createTestGame({ main: A, assetsDir: FIXTURES, plugins: [spine()] })
    expect(boy.isLoaded).toBe(true)
    await g.tree.changeScene(B)
    expect(boy.pages[0]!.isLoaded).toBe(false)
    expect(boy.isLoaded).toBe(false)
    expect(() => boy.data).not.toThrow() // 解析好的数据保留
    await g.tree.changeScene(A)
    expect(boy.isLoaded).toBe(true)
  })

  it('SpineSkeleton 类导出，kind 和 path 可读', () => {
    expect(MINIMAL).toBeInstanceOf(SpineSkeleton)
    expect(MINIMAL.path).toBe('minimal/minimal.json')
  })
})
