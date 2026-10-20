import { describe, expect, it, vi } from 'vitest'
import { key, Node, Scene } from 'sapling2d'
import { motion, MotionInput, tilt } from 'sapling2d/motion'
import { createTestGame } from 'sapling2d/testing'

declare module 'sapling2d' {
  interface ActionRegistry {
    mLeft: true
    mRight: true
    mForward: true
  }
}

const DEG = Math.PI / 180
/** 向左压低 `deg` 度时的采样（手机竖着拿、屏幕朝上）。 */
const rollSample = (deg: number) => ({ type: 'motion' as const, x: Math.sin(deg * DEG), y: 0, z: Math.cos(deg * DEG) })

const actions = { mLeft: [key('KeyA'), tilt('left')], mRight: [key('KeyD'), tilt('right')], mForward: [tilt('forward', { deadzone: 10, full: 20 })] }

describe('motion 插件', () => {
  it('不装插件：tilt 绑定警告一次，动作一直是 0', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const g = await createTestGame({ main: Scene, actions })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toMatch(/binding type "tilt" has no input source/)
    expect(() => g.tree.get(MotionInput)).toThrow(/MotionInput is not installed.*plugins: \[/)
    warn.mockRestore()
  })

  it('无头平台：当作有传感器、已授权；注入的采样在下一次 step 生效', async () => {
    const g = await createTestGame({ main: Scene, plugins: [motion()], actions })
    const m = g.tree.get(MotionInput)
    expect([m.available, m.permission, m.x, m.y, m.z]).toEqual([true, 'granted', 0, 0, 0])
    g.inject(rollSample(20))
    expect(m.roll).toBe(0)
    g.step()
    expect(m.roll).toBeCloseTo(20)
    expect(m.z).toBeCloseTo(Math.cos(20 * DEG))
  })

  it('tilt：死区以内是 0，到 full 线性增加到 1；只响应自己的方向', async () => {
    const g = await createTestGame({ main: Scene, plugins: [motion({ smoothing: 0 })], actions })
    const input = g.tree.input
    g.inject(rollSample(20)) // (20 − 5) / (30 − 5)
    g.step()
    expect(input.getActionStrength('mLeft')).toBeCloseTo(0.6)
    expect(input.getActionStrength('mRight')).toBe(0)
    expect(input.getAxis('mRight', 'mLeft')).toBeCloseTo(0.6)
    expect(input.isActionPressed('mLeft')).toBe(true) // ≥ 0.5
    g.inject(rollSample(4))
    g.step()
    expect(input.getActionStrength('mLeft')).toBe(0)
    expect(input.isActionJustReleased('mLeft')).toBe(true)
    g.inject(rollSample(-45))
    g.step()
    expect([input.getActionStrength('mLeft'), input.getActionStrength('mRight')]).toEqual([0, 1])
  })

  it('forward / back 看 y；自定义 deadzone / full', async () => {
    const g = await createTestGame({ main: Scene, plugins: [motion()], actions })
    g.inject({ type: 'motion', x: 0, y: Math.sin(15 * DEG), z: Math.cos(15 * DEG) })
    g.step()
    expect(g.tree.get(MotionInput).pitch).toBeCloseTo(15)
    expect(g.tree.input.getActionStrength('mForward')).toBeCloseTo(0.5) // (15 − 10) / (20 − 10)
  })

  it('平滑：第一个采样直接到位，之后每个采样走 1 − smoothing；smoothing 0 不平滑', async () => {
    const g = await createTestGame({ main: Scene, plugins: [motion({ smoothing: 0.5 })] })
    const m = g.tree.get(MotionInput)
    g.inject({ type: 'motion', x: 1, y: 0, z: 0 })
    g.step()
    expect(m.x).toBe(1)
    g.inject({ type: 'motion', x: 0, y: 0, z: 1 })
    g.step()
    expect([m.x, m.z]).toEqual([0.5, 0.5])
    g.inject({ type: 'motion', x: 0, y: 0, z: 1 })
    g.step()
    expect([m.x, m.z]).toEqual([0.25, 0.75])

    const g2 = await createTestGame({ main: Scene, plugins: [motion({ smoothing: 0 })] })
    g2.inject({ type: 'motion', x: 1, y: 0, z: 0 })
    g2.step()
    g2.inject({ type: 'motion', x: 0, y: 0, z: 1 })
    g2.step()
    expect([g2.tree.get(MotionInput).x, g2.tree.get(MotionInput).z]).toEqual([0, 1])
  })

  it('和键盘取最大；几个 tilt 采样在同一帧按顺序生效', async () => {
    const g = await createTestGame({ main: Scene, plugins: [motion({ smoothing: 0 })], actions })
    const input = g.tree.input
    g.inject(rollSample(10))
    g.keyDown('KeyA')
    g.step()
    expect(input.getActionStrength('mLeft')).toBe(1)
    g.keyUp('KeyA')
    g.step()
    expect(input.getActionStrength('mLeft')).toBeCloseTo(0.2)
    g.inject(rollSample(45))
    g.inject(rollSample(0))
    g.step()
    expect(input.getActionStrength('mLeft')).toBe(0)
  })

  it('没有事件的帧不调用 handle；strength 只做算术', async () => {
    const g = await createTestGame({ main: Scene, plugins: [motion()], actions })
    const m = g.tree.get(MotionInput)
    const handle = vi.spyOn(m, 'handle')
    g.step(3)
    expect(handle).not.toHaveBeenCalled()
    g.inject(rollSample(10))
    g.step()
    expect(handle).toHaveBeenCalledTimes(1)
  })

  it('每帧读动作状态的节点：倾斜驱动移动，回正后停下', async () => {
    class Car extends Node {
      x = 0
      override physicsProcess(dt: number) {
        this.x += this.tree.input.getAxis('mLeft', 'mRight') * 100 * dt
      }
    }
    const g = await createTestGame({ main: Scene, plugins: [motion({ smoothing: 0 })], actions })
    const car = g.scene.add(new Car())
    g.inject(rollSample(30)) // 满力度向左 → mLeft 1 → 轴 getAxis(left, right) = -1
    g.stepSeconds(1)
    expect(car.x).toBeCloseTo(-100, 0)
    g.inject(rollSample(0))
    g.step()
    const x = car.x
    g.stepSeconds(1)
    expect(car.x).toBe(x)
  })

  it('卸载后不再响应', async () => {
    const g = await createTestGame({ main: Scene, plugins: [motion()], actions })
    g.game.destroy()
    g.inject(rollSample(30))
    g.step()
    expect(g.tree.input.getActionStrength('mLeft')).toBe(0)
  })
})
