// #region example
import { key, Node2D, Scene, v } from 'sapling2d'
import { motion, MotionInput, tilt } from 'sapling2d/motion'

declare module 'sapling2d' {
  interface ActionRegistry {
    steerLeft: true
    steerRight: true
  }
}

// 倾斜和键盘共用动作：浏览器里按 A / D，手机上左右倾斜（5° 以内不动，30° 满力度）
export const actions = { steerLeft: [key('KeyA'), tilt('left')], steerRight: [key('KeyD'), tilt('right')] }
export const plugins = [motion()]

class Car extends Node2D {
  override physicsProcess(dt: number) {
    // 力度 0–1：倾斜越多转得越快；游戏不关心输入来自键盘还是传感器
    this.x += this.tree.input.getAxis('steerLeft', 'steerRight') * 400 * dt
  }
}

export class Track extends Scene {
  car!: Car

  override ready() {
    this.car = this.add(new Car({ position: v(375, 1100) }))
    // iOS 浏览器要在第一次触摸时授权：prompt 期间可以提示“点击屏幕开启重力感应”
    const sensor = this.tree.get(MotionInput)
    if (sensor.permission === 'prompt') console.log('tap to enable tilt')
  }
}

// 启动参数：startGame({ main: Track, actions, plugins })
// #endregion

import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'

it('motion', async () => {
  const g = await createTestGame({ main: Track, actions, plugins })
  // #region test
  const x0 = g.scene.car.x
  const deg = (20 * Math.PI) / 180
  g.inject({ type: 'motion', x: Math.sin(deg), y: 0, z: Math.cos(deg) }) // 向左压低 20°（单位 g，设备坐标）
  g.step()
  expect(g.tree.input.getActionStrength('steerLeft')).toBeCloseTo(0.6) // (20° − 5°) / (30° − 5°)
  g.stepSeconds(1)
  expect(g.scene.car.x).toBeLessThan(x0)
  expect(g.tree.get(MotionInput).permission).toBe('granted') // 无头平台当作已授权
  // #endregion
})
