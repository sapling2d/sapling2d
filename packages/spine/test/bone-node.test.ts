import { describe, expect, it } from 'vitest'
import { Node2D, v } from 'sapling2d'
import { SpineBoneNode, SpineSprite } from '@sapling2d/spine'
import { MINIMAL, setup } from './helpers'

const round = (n: number) => Math.round(n * 100) / 100

describe('SpineBoneNode', () => {
  it('每帧跟随骨骼的位置、旋转、缩放（父节点先更新）；翻转时缩放带符号', async () => {
    let hero!: SpineSprite
    let hand!: SpineBoneNode
    const g = await setup((scene) => {
      hero = scene.add(new SpineSprite({ skeleton: MINIMAL, animation: 'swing', loop: false, position: v(100, 100) }))
      hand = hero.add(new SpineBoneNode({ bone: 'hand', name: 'Hand' }))
    })
    expect([round(hand.x), round(hand.y), round(hand.rotation) || 0]).toEqual([60, 0, 0])
    expect([round(hand.scale.x), round(hand.scale.y)]).toEqual([1, 1])
    g.step(60)
    expect([round(hand.x), round(hand.y)]).toEqual([10, -50])
    expect(round(hand.rotation)).toBe(round(-Math.PI / 2))
    expect([round(hand.scale.x), round(hand.scale.y)]).toEqual([1, 1])
    // 全局位置 = 父节点位置 + 骨骼位置
    expect([round(hand.globalPosition.x), round(hand.globalPosition.y)]).toEqual([110, 50])
    hero.flipH = true
    g.step()
    expect([round(hand.x), round(hand.y)]).toEqual([-10, -50])
    // 翻转后：旋转 + 带符号的缩放 等价于 scaleX = -1（挂在手上的贴图跟着镜像）
    expect([round(hand.scale.x), round(hand.scale.y)]).toEqual([1, -1])
    expect(round(hand.rotation)).toBe(round(-Math.PI / 2))
    const t = hand.transform // x 轴 (a, b) 朝上，y 轴 (c, d) 朝左：等价于骨骼朝上 + 水平镜像
    expect([round(t.a) || 0, round(t.b) || 0, round(t.c) || 0, round(t.d) || 0]).toEqual([0, -1, -1, 0])
    expect(g.dump()).toContain('Hand (SpineBoneNode) position=(-10, -50) rotationDegrees=')
    expect(g.dump()).toContain('bone=hand')
  })

  it('必须是 SpineSprite 的直接子节点；未知骨骼报错', async () => {
    await expect(setup((scene) => scene.add(new SpineBoneNode({ bone: 'hand' })))).rejects.toThrow(/must be a direct child of a SpineSprite/)
    await expect(
      setup((scene) => {
        const hero = scene.add(new SpineSprite({ skeleton: MINIMAL }))
        hero.add(new Node2D()).add(new SpineBoneNode({ bone: 'hand' }))
      }),
    ).rejects.toThrow(/must be a direct child/)
    await expect(
      setup((scene) => {
        const hero = scene.add(new SpineSprite({ skeleton: MINIMAL }))
        hero.add(new SpineBoneNode({ bone: 'nope' }))
      }),
    ).rejects.toThrow(/unknown bone "nope" in minimal\/minimal\.json\. Bones: root, arm, hand\./)
  })
})
