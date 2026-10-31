import { describe, expect, it } from 'vitest'
import { Scene, v } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import { SpineSprite, spineSkeleton, type SpineEvent } from '@sapling2d/spine'
import type { RegionAttachment, TextureAtlasRegion } from '@esotericsoftware/spine-core'
import { FIXTURES, MINIMAL, setup } from './helpers'

const round = (p: { x: number; y: number }) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]

async function sprite(options: Partial<ConstructorParameters<typeof SpineSprite>[0]> = {}, gameOptions = {}) {
  let s!: SpineSprite
  const g = await setup((scene) => {
    s = scene.add(new SpineSprite({ name: 'Hero', skeleton: MINIMAL, ...options }))
  }, gameOptions)
  return { g, s }
}

describe('SpineSprite：播放', () => {
  it('animation 选项立即播放；骨骼位置随动画变化；不循环的动画播完触发 animationFinished 并停止', async () => {
    const { g, s } = await sprite({ animation: 'swing', loop: false })
    const finished: [string, number][] = []
    s.animationFinished.connect((name, track) => finished.push([name, track]), s)
    expect(s.animation).toBe('swing')
    expect(s.isPlaying).toBe(true)
    expect(round(s.bonePosition('hand'))).toEqual([60, 0])
    g.step(30)
    expect(finished).toEqual([])
    expect(round(s.bonePosition('hand'))).toEqual([45.36, -35.36]) // 45°：手在右上（y 向下）
    g.step(29)
    expect(finished).toEqual([])
    g.step(1)
    expect(finished).toEqual([['swing', 0]])
    expect(round(s.bonePosition('hand'))).toEqual([10, -50])
    expect(Math.round(s.boneRotation('hand') * 1000) / 1000).toBe(-Math.round((Math.PI / 2) * 1000) / 1000)
    expect(s.isPlaying).toBe(false)
    expect(s.animation).toBe('swing') // 停在最后一帧
    g.step(60)
    expect(finished).toHaveLength(1)
  })

  it('循环的动画每圈触发一次 animationFinished，isPlaying 一直为 true', async () => {
    const { g, s } = await sprite({ animation: 'swing' })
    let n = 0
    s.animationFinished.connect(() => n++, s)
    g.stepSeconds(2.5)
    expect(n).toBe(2)
    expect(s.isPlaying).toBe(true)
  })

  it('animationEvent：时间点、int / float / string、轨道', async () => {
    const { g, s } = await sprite({ animation: 'swing', loop: false })
    const events: [string, SpineEvent, number][] = []
    s.animationEvent.connect((name, e, track) => events.push([name, e, track]), s)
    g.step(29)
    expect(events).toEqual([])
    g.step(2) // 30 帧 = 0.5 秒差一点浮点误差，第 31 帧到
    expect(events).toEqual([['hit', { name: 'hit', int: 7, float: 1.5, string: 'hard', time: 0.5 }, 0]])
  })

  it('speedScale 和 tree.timeScale 叠加；暂停时不推进', async () => {
    const { g, s } = await sprite({ animation: 'swing', loop: false, speedScale: 2 })
    let n = 0
    s.animationFinished.connect(() => n++, s)
    g.step(29)
    expect(n).toBe(0)
    g.step(2)
    expect(n).toBe(1)
    s.play('swing', { loop: false })
    g.tree.timeScale = 0.5 // 2 × 0.5 = 1 倍速
    g.step(59)
    expect(n).toBe(1)
    g.step(2)
    expect(n).toBe(2)
    g.tree.timeScale = 1
    s.play('swing', { loop: false })
    g.tree.paused = true
    const before = round(s.bonePosition('hand'))
    g.step(120)
    expect(round(s.bonePosition('hand'))).toEqual(before)
    expect(n).toBe(2)
    g.tree.paused = false
    g.step(31)
    expect(n).toBe(3)
    s.speedScale = -1
    expect(s.speedScale).toBe(0)
  })

  it('queue：排在当前动画之后；animationStarted 在轮到它时触发；stop 混回设置姿势', async () => {
    const { g, s } = await sprite({ animation: 'swing', loop: false })
    const started: string[] = []
    s.animationStarted.connect((name) => started.push(name), s)
    s.queue('walk')
    g.step(59)
    expect(s.animation).toBe('swing')
    expect(started).toEqual([])
    g.step(2)
    expect(s.animation).toBe('walk')
    expect(started).toEqual(['walk'])
    s.stop()
    g.step()
    expect(s.animation).toBeNull()
    expect(s.isPlaying).toBe(false)
    g.step(5)
    expect(round(s.bonePosition('hand'))).toEqual([60, 0])
  })

  it('play 返回 TrackEntry（进阶：可以直接调 spine 的参数）；高轨道叠加', async () => {
    const { g, s } = await sprite({ animation: 'walk' })
    const entry = s.play('swing', { track: 1, loop: false })
    entry.timeScale = 2
    g.step(31)
    expect(s.animation).toBe('walk') // 轨道 0 不变
    expect(s.state.getTrack(1)?.isComplete()).toBe(true)
    expect(round(s.bonePosition('hand'))[1]).toBe(-50)
  })

  it('defaultMix / mix：混合时长；未知动画报错并列出可用的', async () => {
    const { s } = await sprite({ defaultMix: 0.2 })
    expect(s.defaultMix).toBe(0.2)
    s.mix('swing', 'walk', 0.5)
    const data = MINIMAL.data
    expect(s.state.data.getMix(data.findAnimation('swing')!, data.findAnimation('walk')!)).toBe(0.5)
    expect(s.state.data.getMix(data.findAnimation('walk')!, data.findAnimation('swing')!)).toBe(0.2)
    expect(() => s.play('nope')).toThrow(/unknown animation "nope" in minimal\/minimal\.json\. Animations: swing, blink, reorder, walk\./)
    expect(() => s.queue('nope')).toThrow(/unknown animation/)
    expect(() => s.mix('swing', 'nope', 1)).toThrow(/unknown animation/)
    s.defaultMix = -1
    expect(s.defaultMix).toBe(0)
  })
})

describe('SpineSprite：换装、翻转、姿势', () => {
  it('skin 换装：region 换成皮肤里的；未知皮肤报错；setAttachment 换附件和清空', async () => {
    const { s } = await sprite()
    expect(s.skin).toBeNull()
    const region = () => ((s.spine.findSlot('body')!.appliedPose.attachment as RegionAttachment).sequence.regions[0] as TextureAtlasRegion).name
    expect(region()).toBe('box')
    s.skin = 'red'
    expect(s.skin).toBe('red')
    expect(region()).toBe('box-red')
    s.skin = null
    expect(s.skin).toBeNull()
    expect(() => (s.skin = 'blue')).toThrow(/unknown skin "blue" in minimal\/minimal\.json\. Skins: default, red\./)
    expect(s.spine.findSlot('fx')!.appliedPose.attachment).toBeNull()
    s.setAttachment('fx', 'spark')
    expect(s.spine.findSlot('fx')!.appliedPose.attachment?.name).toBe('spark')
    s.setAttachment('fx', null)
    expect(s.spine.findSlot('fx')!.appliedPose.attachment).toBeNull()
    expect(() => s.setAttachment('nope', 'spark')).toThrow(/unknown slot "nope".*Slots: clip, body, arm, fx\./)
    expect(() => s.setAttachment('fx', 'nope')).toThrow(/Attachment not found: nope, for slot: fx \(minimal\/minimal\.json\)/)
  })

  it('flipH / flipV：骨骼位置和包围盒镜像；没设 hitArea 时按包围盒点击', async () => {
    const { s } = await sprite()
    expect(round(s.bonePosition('hand'))).toEqual([60, 0])
    expect([s.rect.x, s.rect.width].map(Math.round)).toEqual([-16, 76])
    expect(s.hitTest(v(50, 0))).toBe(true)
    expect(s.hitTest(v(-50, 0))).toBe(false)
    s.flipH = true
    expect(round(s.bonePosition('hand'))).toEqual([-60, 0])
    expect([s.rect.x, s.rect.width].map(Math.round)).toEqual([-60, 76])
    expect(s.hitTest(v(-50, 0))).toBe(true)
    expect(s.hitTest(v(50, 0))).toBe(false)
    s.flipV = true
    s.play('swing', { loop: false })
    s.state.update(1)
    s.state.apply(s.spine)
    s.refreshPose()
    expect(round(s.bonePosition('hand'))).toEqual([-10, 50]) // 两个方向都翻：手在左下
    s.flipH = false
    s.flipV = false
    expect(round(s.bonePosition('hand'))).toEqual([10, -50])
    s.hitArea = s.rect
    expect(s.hitTest(v(50, 0))).toBe(true)
  })

  it('setupPose 清掉轨道回到设置姿势；bonePosition / boneRotation 未知骨骼报错', async () => {
    const { g, s } = await sprite({ animation: 'swing', loop: false })
    g.step(30)
    expect(round(s.bonePosition('hand'))).not.toEqual([60, 0])
    s.setupPose()
    expect(round(s.bonePosition('hand'))).toEqual([60, 0])
    expect(s.animation).toBeNull()
    g.step(10)
    expect(round(s.bonePosition('hand'))).toEqual([60, 0])
    expect(() => s.bonePosition('nope')).toThrow(/unknown bone "nope" in minimal\/minimal\.json\. Bones: root, arm, hand\./)
    expect(() => s.boneRotation('nope')).toThrow(/unknown bone/)
    expect(() => (s.physics = 'x' as never)).toThrow(/unknown physics mode/)
    s.physics = 'none'
    expect(s.physics).toBe('none')
  })

  it('_poseVersion：播放时每帧变，静止时不变，换装 / 翻转 / refreshPose 时变', async () => {
    const { g, s } = await sprite()
    const v0 = s._poseVersion
    g.step(10)
    expect(s._poseVersion).toBe(v0)
    s.play('swing')
    g.step(10)
    expect(s._poseVersion).toBe(v0 + 10)
    s.stop()
    g.step(3) // 混出：第一帧 apply 仍返回 true（空动画），之后不再变
    const v1 = s._poseVersion
    g.step(10)
    expect(s._poseVersion).toBe(v1)
    s.flipH = true
    expect(s._poseVersion).toBe(v1 + 1)
    s.skin = 'red'
    expect(s._poseVersion).toBe(v1 + 2)
    s.refreshPose()
    expect(s._poseVersion).toBe(v1 + 3)
  })

  it('dump：骨架路径、动画、播放中、皮肤、翻转', async () => {
    const { g, s } = await sprite({ animation: 'swing', skin: 'red', flipH: true, speedScale: 2, position: v(100, 200) })
    expect(g.dump()).toContain('Hero (SpineSprite) position=(100, 200) skeleton=minimal/minimal.json animation=swing playing=true skin=red speedScale=2 flipH=true')
    s.stop()
    g.step()
    expect(g.dump()).toContain('Hero (SpineSprite) position=(100, 200) skeleton=minimal/minimal.json skin=red speedScale=2 flipH=true')
  })
})

describe('SpineSprite：前置条件', () => {
  it('没装 spine() 时进树报错并提示', async () => {
    class Main extends Scene {
      static override assets = { skeleton: MINIMAL }
      override ready() {
        this.add(new SpineSprite({ skeleton: MINIMAL }))
      }
    }
    await expect(createTestGame({ main: Main, assetsDir: FIXTURES })).rejects.toThrow(/SpineSprite requires the spine plugin: add plugins: \[spine\(\)\]/)
  })

  it('骨架没加载时构造报错', () => {
    expect(() => new SpineSprite({ skeleton: spineSkeleton('minimal/minimal.json', { scale: 0.25 }) })).toThrow(/is not loaded yet/)
  })
})
