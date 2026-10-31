import { describe, expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'
import { gameOptions, Main, SPINEBOY } from '../src/game'

async function start() {
  const g = await createTestGame({ ...gameOptions, seed: 1 })
  return { g, scene: g.scene as Main, boy: (g.scene as Main).boy }
}

describe('spineboy', () => {
  it('骨架加载；一开始站着（idle）', async () => {
    const { g, boy } = await start()
    expect(SPINEBOY.isLoaded).toBe(true)
    expect(boy.animation).toBe('idle')
    expect(boy.isPlaying).toBe(true)
    expect(g.dump()).toContain('Spineboy (SpineSprite) position=(375, 1150) skeleton=spineboy/spineboy-pro.json animation=idle playing=true')
  })

  it('点空白处跳一下，跳完接回 idle', async () => {
    const { g, boy } = await start()
    g.tap(375, 600)
    expect(boy.animation).toBe('jump')
    g.stepSeconds(1)
    expect(boy.animation).toBe('jump')
    g.stepSeconds(0.5)
    expect(boy.animation).toBe('idle')
  })

  it('按住 D 走路并向右移动，松开回到 idle；按 A 朝左（翻转），枪口骨骼的位置跟着镜像', async () => {
    const { g, boy } = await start()
    g.keyDown('KeyD')
    g.step(30)
    expect(boy.animation).toBe('walk')
    expect(boy.flipH).toBe(false)
    expect(boy.x).toBeGreaterThan(375)
    const tipRight = boy.bonePosition('gun-tip')
    expect(tipRight.x).toBeGreaterThan(0)
    g.keyUp('KeyD')
    g.step(2)
    expect(boy.animation).toBe('idle')
    g.keyDown('KeyA')
    g.step(30)
    expect(boy.flipH).toBe(true)
    expect(boy.bonePosition('gun-tip').x).toBeLessThan(0)
    expect(boy.x).toBeLessThan(375 + 30 * 3) // 先向右 0.5 秒再向左 0.5 秒：回到差不多原地
    g.keyUp('KeyA')
  })

  it('走路时 footstep 事件计数（walk 每秒两步）', async () => {
    const { g, scene } = await start()
    g.keyDown('KeyD')
    g.stepSeconds(2.2)
    expect(scene.footsteps).toBeGreaterThanOrEqual(3)
    expect(g.dump()).toContain(`text="footstep ×${scene.footsteps}"`)
  })

  it('开枪：轨道 1 叠加 shoot，枪口闪光跟着 gun-tip 骨骼亮 0.12 秒，播完轨道 1 清掉', async () => {
    const { g, scene, boy } = await start()
    g.keyDown('Space')
    g.step()
    expect(boy.state.getTrack(1)?.animation?.name).toBe('shoot')
    expect(boy.animation).toBe('idle') // 轨道 0 不受影响
    expect(scene.flash.visible).toBe(true)
    expect(scene.flash.isVisibleInTree).toBe(true)
    const tip = scene.flash.parent!
    expect(tip.name).toBe('GunTip')
    g.step(10)
    expect(scene.flash.visible).toBe(false)
    g.keyUp('Space')
    g.stepSeconds(1)
    expect(boy.state.getTrack(1)).toBeNull()
  })
})

describe('压力测试场景', () => {
  it('addBenchBoys 加 9 个跑步 / 走路的 spineboy，动画各自推进', async () => {
    const { g, scene } = await start()
    scene.addBenchBoys(9)
    g.step(30)
    const boys = scene.children.filter((c) => c.name.startsWith('Bench'))
    expect(boys).toHaveLength(9)
    expect(g.dump()).toContain('Bench1 (SpineSprite)')
    expect(g.dump()).toMatch(/Bench1 \(SpineSprite\).*animation=run playing=true/)
  })
})
