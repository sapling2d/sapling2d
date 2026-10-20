import { ColorRect, Node2D, v } from 'sapling2d'
import { CAR, ROAD } from '../config'

/** 车：横向速度由转向轴（倾斜或键盘）决定，车身不出公路。 */
export class Car extends Node2D {
  /** 当前横向速度（像素/秒），测试用。 */
  velocityX = 0

  constructor() {
    super({ name: 'Car', position: v(375, CAR.y) })
    // 以车的中心为原点
    this.add(new ColorRect({ size: v(CAR.width, CAR.height), color: CAR.color, position: v(-CAR.width / 2, -CAR.height / 2) }))
    this.add(new ColorRect({ size: v(CAR.width - 16, 30), color: 0x202020, position: v(-CAR.width / 2 + 8, -CAR.height / 2 + 18) }))
  }

  override physicsProcess(dt: number): void {
    const axis = this.tree.input.getAxis('steerLeft', 'steerRight')
    this.velocityX = axis * CAR.steerSpeed
    const half = CAR.width / 2
    const x = this.x + this.velocityX * dt
    this.x = Math.min(ROAD.right - half, Math.max(ROAD.left + half, x))
  }
}
