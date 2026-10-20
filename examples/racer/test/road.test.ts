import { describe, expect, it } from 'vitest'
import { MotionInput } from 'sapling2d/motion'
import { createTestGame } from 'sapling2d/testing'
import { CAR, ROAD } from '../src/config'
import { gameOptions } from '../src/game'
import type { Road } from '../src/scenes/Road'

const DEG = Math.PI / 180
/** 向左压低 `deg` 度（手机竖着拿、屏幕朝上）。 */
const roll = (deg: number) => ({ type: 'motion' as const, x: Math.sin(deg * DEG), y: 0, z: Math.cos(deg * DEG) })

async function start() {
  const g = await createTestGame({ ...gameOptions, seed: 1 })
  return { g, road: g.scene as Road }
}

describe('倾斜赛车', () => {
  it('向左倾斜 20°：转向力度 0.6，车向左走；回正后停下', async () => {
    const { g, road } = await start()
    g.inject(roll(20))
    g.step() // 采样生效，车已经走了 1 帧
    expect(g.tree.input.getActionStrength('steerLeft')).toBeCloseTo(0.6)
    const x0 = road.car.x
    g.stepSeconds(0.5)
    expect(road.car.velocityX).toBeCloseTo(-0.6 * CAR.steerSpeed)
    expect(x0 - road.car.x).toBeCloseTo(0.6 * CAR.steerSpeed * 0.5, 0)
    g.inject(roll(0))
    g.step()
    const x = road.car.x
    g.stepSeconds(0.5)
    expect([road.car.velocityX, road.car.x]).toEqual([0, x])
  })

  it('键盘同样能开：按住 D 向右，车身不出公路', async () => {
    const { g, road } = await start()
    g.keyDown('KeyD')
    g.stepSeconds(0.3)
    expect(road.car.velocityX).toBe(CAR.steerSpeed)
    g.stepSeconds(3)
    expect(road.car.x).toBe(ROAD.right - CAR.width / 2)
  })

  it('左下角的摇杆也能开（默认皮肤已随 touch() 加载）；data: 图片在场景资源里', async () => {
    const { g, road } = await start()
    const stick = road.stick
    expect([stick.isPressed, stick.children.length]).toEqual([false, 2]) // 底座和摇杆头
    expect((road.constructor as typeof Road).assets.dot.isLoaded).toBe(true)
    g.pointerDown(stick.x, stick.y)
    g.pointerMove(stick.x + 80, stick.y) // 推到底：向右
    g.step()
    expect([stick.isPressed, g.tree.input.getActionStrength('steerRight')]).toEqual([true, 1])
    g.stepSeconds(0.2)
    expect(road.car.velocityX).toBe(CAR.steerSpeed)
    g.pointerUp(stick.x + 80, stick.y)
    g.step()
    expect(road.car.velocityX).toBe(0)
  })

  it('无头平台当作已授权：不显示权限提示；HUD 读数显示传感器值', async () => {
    const { g, road } = await start()
    expect(g.tree.get(MotionInput).permission).toBe('granted')
    expect(road.hint.visible).toBe(false)
    g.inject(roll(30))
    g.stepSeconds(0.2)
    expect(road.readout.text).toContain('roll 30°')
    expect(g.dump()).toContain('carX=')
  })
})
