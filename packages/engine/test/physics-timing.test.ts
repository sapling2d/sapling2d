import { describe, expect, it } from 'vitest'
import { Node, Node2D, Scene, Timer } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'

/** 每个物理步记录一个值：用来比较不同倍速下各个物理步看到的东西是否一样。 */
class Probe extends Node {
  readonly seen: number[] = []
  constructor(private readonly read: () => number) {
    super()
  }
  override physicsProcess() {
    this.seen.push(this.read())
  }
}

/** 推进 `steps` 个物理步：倍速 n 下每帧 n 步。 */
function stepPhysics(g: Awaited<ReturnType<typeof createTestGame>>, steps: number, speed: number) {
  g.step(steps / speed)
}

describe('processInPhysics：按物理步推进的计时器和补间', () => {
  it('createTimer：按帧的计时器在 3 倍速下晚触发（一帧吞掉 3 步），按物理步的在任何倍速下都在同一个物理步触发', async () => {
    const firedAt = async (speed: number, processInPhysics: boolean) => {
      const g = await createTestGame({ main: Scene })
      g.tree.timeScale = speed
      let at = -1
      g.tree.createTimer(1.01, { processInPhysics }).timeout.connect(() => (at = g.tree.physicsFrames))
      stepPhysics(g, 72, speed)
      return at
    }
    // 1.01 秒 = 60.6 步：按帧的 1 倍速在第 61 步之后的帧末触发，3 倍速要等到第 21 帧（63 步）
    expect([await firedAt(1, false), await firedAt(3, false)]).toEqual([61, 63])
    expect([await firedAt(1, true), await firedAt(3, true)]).toEqual([61, 61])
  })

  it('Timer 节点 processInPhysics：倍速下和 1 倍速在同一个物理步触发；树里没有别的物理节点也能被调到', async () => {
    const firedAt = async (speed: number) => {
      const g = await createTestGame({ main: Scene })
      g.tree.timeScale = speed
      const t = g.scene.add(new Timer({ waitTime: 1.01, oneShot: true, autostart: true, processInPhysics: true }))
      let at = -1
      t.timeout.connect(() => (at = g.tree.physicsFrames))
      stepPhysics(g, 72, speed)
      expect(g.dump()).toContain('physics=true')
      return at
    }
    expect([await firedAt(1), await firedAt(3)]).toEqual([61, 61])
  })

  it('Timer 节点按帧（默认）：3 倍速下一帧只计一次，触发晚两步', async () => {
    const g = await createTestGame({ main: Scene })
    g.tree.timeScale = 3
    const t = g.scene.add(new Timer({ waitTime: 1.01, oneShot: true, autostart: true }))
    let at = -1
    t.timeout.connect(() => (at = g.tree.physicsFrames))
    stepPhysics(g, 72, 3)
    expect(at).toBe(63)
  })

  it('Tween processInPhysics：各个物理步看到的值在 1 倍速和 3 倍速下完全一样；按帧的补间一帧内三步看到同一个值', async () => {
    const seenBy = async (speed: number, processInPhysics: boolean) => {
      const g = await createTestGame({ main: Scene })
      g.tree.timeScale = speed
      const mover = g.scene.add(new Node2D())
      const probe = g.scene.add(new Probe(() => mover.x))
      mover.createTween({ processInPhysics }).to(mover, { x: 60 }, 1)
      stepPhysics(g, 6, speed)
      return probe.seen.map((x) => Math.round(x * 1e9) / 1e9) // 只关心步序，不关心浮点尾数
    }
    const slow = await seenBy(1, true)
    expect(slow).toEqual([0, 1, 2, 3, 4, 5])
    expect(await seenBy(3, true)).toEqual(slow)
    expect(await seenBy(3, false)).toEqual([0, 0, 0, 3, 3, 3]) // 按帧：帧末才推进 3 步的量
  })

  it('本步新建的从下一步开始推进（和按帧的"下一帧开始"同一条规则）', async () => {
    const g = await createTestGame({ main: Scene })
    let created = -1
    let fired = -1
    class Spawner extends Node {
      override physicsProcess() {
        if (created >= 0) return
        created = this.tree.physicsFrames
        this.tree.createTimer(1 / 60, { processInPhysics: true }).timeout.connect(() => (fired = this.tree.physicsFrames))
      }
    }
    g.scene.add(new Spawner())
    g.step(3)
    expect([created, fired]).toEqual([1, 2])
  })

  it('暂停：processAlways: false 的物理计时器和绑定在 pausable 节点上的物理补间都停住；默认的计时器继续', async () => {
    const g = await createTestGame({ main: Scene })
    const mover = g.scene.add(new Node2D())
    mover.createTween({ processInPhysics: true }).to(mover, { x: 60 }, 1)
    let always = 0
    let pausable = 0
    g.tree.createTimer(0.1, { processInPhysics: true }).timeout.connect(() => always++)
    g.tree.createTimer(0.1, { processInPhysics: true, processAlways: false }).timeout.connect(() => pausable++)
    g.tree.paused = true
    g.step(12)
    expect([always, pausable, mover.x]).toEqual([1, 0, 0])
    g.tree.paused = false
    g.step(6)
    expect([always, pausable]).toEqual([1, 1])
    expect(mover.x).toBeCloseTo(6)
  })

  it('ignoreTimeScale 和 processInPhysics 不能同时用', async () => {
    const g = await createTestGame({ main: Scene })
    expect(() => g.tree.createTimer(1, { ignoreTimeScale: true, processInPhysics: true })).toThrow(/cannot be combined/)
  })
})
