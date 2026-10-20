import { CanvasLayer, ColorRect, Label, Scene, v } from 'sapling2d'
import { MotionInput } from 'sapling2d/motion'
import { CAR, LANE, ROAD } from '../config'
import { Car } from '../nodes/Car'

/**
 * 一条向下滚动的公路：倾斜手机（或按 A / D）左右移动车。
 * HUD 显示传感器的权限状态和原始值，真机核对轴向和单位时直接看屏幕。
 */
export class Road extends Scene {
  car!: Car
  hint!: Label
  readout!: Label
  private readonly _lanes: ColorRect[] = []
  private _readoutTimer = 0

  override ready() {
    const h = this.tree.viewport.visibleRect
    this.add(new ColorRect({ name: 'Road', size: v(ROAD.right - ROAD.left, h.height), color: ROAD.color, position: v(ROAD.left, h.y) }))
    for (const x of [ROAD.left, ROAD.right - ROAD.edgeWidth]) this.add(new ColorRect({ size: v(ROAD.edgeWidth, h.height), color: ROAD.edgeColor, position: v(x, h.y) }))
    for (let y = h.y; y < h.bottom; y += LANE.gap) {
      this._lanes.push(this.add(new ColorRect({ name: 'Lane', size: v(LANE.width, LANE.height), color: LANE.color, position: v(375 - LANE.width / 2, y) })))
    }
    this.car = this.add(new Car())

    const hud = this.add(new CanvasLayer({ name: 'Hud' }))
    const safe = this.tree.viewport.safeRect
    hud.add(new Label({ text: '倾斜手机转向 · 键盘 A / D', fontSize: 30, align: 'center', position: v(375, safe.top + 30) }))
    this.hint = hud.add(new Label({ text: '点击屏幕开启重力感应', fontSize: 40, align: 'center', verticalAlign: 'center', position: v(375, 600), color: 0xffe066 }))
    this.readout = hud.add(new Label({ text: '', fontSize: 24, align: 'center', position: v(375, safe.bottom - 70), color: 0xcccccc }))
    this._updateHud()
  }

  override process(dt: number) {
    const h = this.tree.viewport.visibleRect
    for (const lane of this._lanes) {
      lane.y += LANE.speed * dt
      if (lane.y > h.bottom) lane.y -= this._lanes.length * LANE.gap
    }
    // 每 0.1 秒刷新一次文字就够了
    this._readoutTimer += dt
    if (this._readoutTimer >= 0.1) {
      this._readoutTimer = 0
      this._updateHud()
    }
  }

  private _updateHud() {
    const m = this.tree.get(MotionInput)
    this.hint.visible = m.permission === 'prompt'
    const status = m.available ? m.permission : 'no sensor'
    this.readout.text = `${status}  x ${m.x.toFixed(2)}  y ${m.y.toFixed(2)}  z ${m.z.toFixed(2)}  roll ${m.roll.toFixed(0)}°  car ${this.car.x.toFixed(0)}`
  }

  protected override dumpProps(): Record<string, unknown> {
    return { ...super.dumpProps(), carX: Math.round(this.car.x), hint: this.hint.visible || undefined }
  }
}

export { CAR }
