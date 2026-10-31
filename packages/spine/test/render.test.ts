import { describe, expect, it, vi } from 'vitest'
import { Container, Mesh } from 'pixi.js'
import { PixiRenderer } from 'sapling2d/render'
import { SpineSprite } from '@sapling2d/spine'
import type { ClippingAttachment } from '@esotericsoftware/spine-core'
import { MINIMAL, setup } from './helpers'

const content = (s: SpineSprite) => (s.unsafePixi as Container).children[0] as Container
const meshes = (s: SpineSprite) => content(s).children as Mesh[]
const labels = (s: SpineSprite) => meshes(s).map((m) => m.label)
const xs = (m: Mesh) => Array.from(m.geometry.positions).filter((_, i) => i % 2 === 0)
const ys = (m: Mesh) => Array.from(m.geometry.positions).filter((_, i) => i % 2 === 1)
const sorted = (a: number[]) => a.map((n) => Math.round(n * 100) / 100 || 0).sort((x, y) => x - y)

async function scene(options: Partial<ConstructorParameters<typeof SpineSprite>[0]> = {}, pixelArt = false) {
  let s!: SpineSprite
  const g = await setup((sc) => {
    s = sc.add(new SpineSprite({ name: 'Hero', skeleton: MINIMAL, ...options }))
  })
  const r = PixiRenderer._createForSyncTests({ pixelArt })
  return { g, s, r, sync: () => r.sync(g.tree) }
}

describe('SpineContent：同步到 Pixi', () => {
  it('每个有 region / mesh 附件的 slot 一个 Mesh，按绘制顺序；clipping 和空 slot 不显示；换附件后出现', async () => {
    const { s, sync } = await scene()
    sync()
    expect(content(s).label).toBe('__content')
    expect(labels(s)).toEqual(['body/box', 'arm/armMesh'])
    s.setAttachment('fx', 'spark')
    sync()
    expect(labels(s)).toEqual(['body/box', 'arm/armMesh', 'fx/spark'])
    s.setAttachment('fx', null)
    sync()
    expect(labels(s)).toEqual(['body/box', 'arm/armMesh'])
  })

  it('region 附件 4 顶点 6 索引、mesh 附件按 triangles；顶点是世界坐标（y 向下），随动画变化', async () => {
    const { g, s, sync } = await scene({ animation: 'swing', loop: false })
    sync()
    const [box, arm] = meshes(s)
    expect(box!.geometry.positions).toHaveLength(8)
    expect(Array.from(box!.geometry.indices)).toEqual([0, 1, 2, 2, 3, 0])
    expect(sorted(xs(box!))).toEqual([-16, -16, 16, 16])
    expect(sorted(ys(box!))).toEqual([-16, -16, 16, 16])
    expect(arm!.geometry.positions).toHaveLength(8)
    expect(Array.from(arm!.geometry.indices)).toEqual([0, 1, 2, 2, 3, 0])
    expect(sorted(xs(arm!))).toEqual([10, 10, 60, 60])
    expect(sorted(ys(arm!))).toEqual([-8, -8, 8, 8])
    expect(Array.from(arm!.geometry.uvs)).toEqual([0, 0.5, 0.78125, 0.5, 0.78125, 0.75, 0, 0.75]) // 图集 64×64 里 (0,32)–(50,48)
    g.step(60)
    sync()
    expect(meshes(s)[1]).toBe(arm) // 复用同一个网格
    expect(sorted(xs(arm!))).toEqual([2, 2, 18, 18])
    expect(sorted(ys(arm!))).toEqual([-50, -50, 0, 0])
  })

  it('颜色：骨架 × slot × 附件 × selfModulate → tint，alpha 乘积；alpha 为 0 的 slot 不显示', async () => {
    const { s, sync } = await scene()
    sync()
    const box = meshes(s)[0]!
    expect([box.tint, box.alpha]).toEqual([0xffffff, 1])
    s.spine.findSlot('body')!.pose.color.set(1, 0.5, 0, 0.5)
    s.refreshPose()
    sync()
    expect([box.tint, box.alpha]).toEqual([0xff8000, 0.5])
    s.selfModulate = 0x00ff00
    sync()
    expect(box.tint).toBe(0x008000)
    s.spine.findSlot('body')!.pose.color.a = 0
    s.refreshPose()
    sync()
    expect(labels(s)).toEqual(['arm/armMesh'])
  })

  it('混合模式：additive 的 slot 是 add，normal 的跟随节点（inherit）', async () => {
    const { s, sync } = await scene()
    s.setAttachment('fx', 'spark')
    sync()
    expect(meshes(s).map((m) => m.blendMode)).toEqual(['inherit', 'inherit', 'add'])
  })

  it('贴图：页图没加载时 EMPTY，加载后换成缓存的贴图（页图共用一个图片源）', async () => {
    const { s, r, sync } = await scene()
    const page = MINIMAL.pages[0]!
    page._unload()
    sync()
    expect(meshes(s).map((m) => m.texture.label)).toEqual(['EMPTY', 'EMPTY'])
    page._setLoaded({ width: 64, height: 64 }, 64, 64)
    sync()
    expect(meshes(s).every((m) => m.texture.label !== 'EMPTY')).toBe(true)
    expect(meshes(s)[0]!.texture).toBe(meshes(s)[1]!.texture)
    expect(r._sourceCount).toBe(1)
  })

  it('裁剪：被 clipping 覆盖一半的 region 顶点被裁到一半；完全裁掉时不显示；裁剪结束后恢复原始顶点', async () => {
    const { s, sync } = await scene()
    s.setAttachment('clip', 'clip') // 设置姿势里 clip 槽是空的：显式装上裁剪多边形（±100 的方块，整个盖住 body）
    const clip = s.spine.findSlot('clip')!.appliedPose.attachment as ClippingAttachment
    const original = clip.vertices
    clip.vertices = [-100, -100, 0, -100, 0, 100, -100, 100] // 左半边
    s.refreshPose()
    sync()
    const box = meshes(s)[0]!
    expect(box.label).toBe('body/box')
    expect(Math.max(...xs(box))).toBeCloseTo(0, 5)
    expect(Math.min(...xs(box))).toBeCloseTo(-16, 5)
    expect(box.geometry.indices.length % 3).toBe(0)
    expect(box.geometry.uvs).toHaveLength(box.geometry.positions.length)
    // arm 不在裁剪范围内（end 是 body）
    expect(sorted(xs(meshes(s)[1]!))).toEqual([10, 10, 60, 60])
    clip.vertices = [500, 500, 600, 500, 600, 600, 500, 600] // 远处：body 全部裁掉
    s.refreshPose()
    sync()
    expect(labels(s)).toEqual(['arm/armMesh'])
    s.setAttachment('clip', null)
    s.refreshPose()
    sync()
    expect(labels(s)).toEqual(['body/box', 'arm/armMesh'])
    expect(sorted(xs(meshes(s)[0]!))).toEqual([-16, -16, 16, 16])
    expect(Array.from(meshes(s)[0]!.geometry.indices)).toEqual([0, 1, 2, 2, 3, 0])
    clip.vertices = original // 附件是资源里共享的：还原，别影响别的用例
  })

  it('绘制顺序动画改变顺序后子对象重排', async () => {
    const { g, s, sync } = await scene({ animation: 'reorder', loop: false })
    s.setAttachment('fx', 'spark')
    sync()
    expect(labels(s)).toEqual(['body/box', 'arm/armMesh', 'fx/spark'])
    g.step(12)
    sync()
    expect(labels(s)).toEqual(['fx/spark', 'body/box', 'arm/armMesh'])
  })

  it('姿势没变时不写缓冲区（静止的角色每帧零开销）；隐藏时不同步', async () => {
    const { g, s, sync } = await scene()
    sync()
    const update = vi.spyOn(meshes(s)[0]!.geometry.getBuffer('aPosition'), 'update')
    g.step(10)
    sync()
    expect(update).not.toHaveBeenCalled()
    s.play('swing')
    g.step(3)
    sync()
    expect(update).toHaveBeenCalledTimes(1) // 一次同步写一次
    s.visible = false
    g.step(3)
    sync()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('pixelArt：网格顶点对齐到物理像素', async () => {
    const { s, sync } = await scene({}, true)
    sync()
    expect(meshes(s).every((m) => m.roundPixels)).toBe(true)
  })

  it('节点离开树：网格销毁', async () => {
    const { g, s, sync } = await scene()
    sync()
    const [box, arm] = meshes(s)
    s.queueFree()
    g.step()
    sync()
    expect(box!.destroyed).toBe(true)
    expect(arm!.destroyed).toBe(true)
  })

  it('dark tint 的 slot：忽略 dark color，每个资源警告一次', async () => {
    const { s, sync } = await scene()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    s.spine.findSlot('body')!.pose.darkColor = s.spine.color.set(0.5, 0, 0, 1)
    s.refreshPose()
    sync()
    s.refreshPose()
    sync()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatch(/slot "body" uses tint black/)
    warn.mockRestore()
  })
})
