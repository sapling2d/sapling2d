// #region example
import { ColorRect, Scene, v } from 'sapling2d'
import { spine, spineSkeleton, SpineBoneNode, SpineSprite } from '@sapling2d/spine'

// 骨架 JSON（Spine 4.3 导出）+ 图集 + 页图都放在资源目录里：public/assets/spineboy/。图集和骨架同名时不用写 atlas
const SPINEBOY = spineSkeleton('spineboy/spineboy-ess.json', { atlas: 'spineboy/spineboy.atlas' })

export class Arena extends Scene {
  static override assets = { boy: SPINEBOY } // 进入场景前加载骨架、图集和页图
  boy!: SpineSprite
  footsteps = 0

  override ready() {
    // 原点在 Spine 的 root 骨骼（spineboy 是脚底）；defaultMix：动作切换时过渡 0.2 秒
    this.boy = this.add(new SpineSprite({ name: 'Boy', skeleton: SPINEBOY, animation: 'idle', defaultMix: 0.2, position: v(375, 1100) }))
    // Spine 的用户事件（时间轴上的 footstep）
    this.boy.animationEvent.connect((name) => {
      if (name === 'footstep') this.footsteps++
    }, this)
    // 跟随骨骼的节点：枪口的闪光挂在 gun-tip 上，每帧跟着骨骼动
    this.boy.add(new SpineBoneNode({ bone: 'gun-tip' })).add(new ColorRect({ name: 'Flash', size: v(60, 12), position: v(0, -6), color: 0xffdd55 }))
  }

  jump() {
    this.boy.play('jump', { loop: false }) // 轨道 0：和 idle 混合 0.2 秒
    this.boy.queue('idle') // 跳完接回 idle
  }

  shoot() {
    this.boy.play('shoot', { track: 1, loop: false }) // 轨道 1 叠在走路 / 站立上面
  }

  faceLeft() {
    this.boy.flipH = true
  }
}

// 启动参数：startGame({ main: Arena, plugins: [spine()] })
// #endregion

import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'

it('spine', async () => {
  // #region test
  // 无头测试从 assetsDir 读真实的骨架和图集文件（默认 public/assets）；页图不读，但图集里带尺寸，骨骼位置和事件都和真机一致
  const g = await createTestGame({ main: Arena, plugins: [spine()], assetsDir: 'test/fixtures' })
  const scene = g.scene as Arena
  expect(scene.boy.animation).toBe('idle')
  scene.jump()
  expect(scene.boy.animation).toBe('jump')
  g.stepSeconds(1.5) // jump 1.33 秒
  expect(scene.boy.animation).toBe('idle')
  scene.boy.play('walk')
  g.stepSeconds(2)
  expect(scene.footsteps).toBeGreaterThanOrEqual(3) // walk 每秒两步
  const tip = scene.boy.bonePosition('gun-tip') // 节点局部坐标，y 向下
  scene.faceLeft()
  expect(scene.boy.bonePosition('gun-tip').x).toBeCloseTo(-tip.x)
  expect(g.dump()).toContain('Boy (SpineSprite) position=(375, 1100) skeleton=spineboy/spineboy-ess.json animation=walk playing=true flipH=true')
  // #endregion
})
