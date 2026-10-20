import { CanvasLayer, ColorRect, Label, Scene, Sprite2D, tex, v } from 'sapling2d'
import { MotionInput } from 'sapling2d/motion'
import { TouchJoystick } from '@sapling2d/touch'
import { CAR, LANE, ROAD } from '../config'
import { Car } from '../nodes/Car'

/** 内嵌图片的逃生口示例（`tex('data:…')`，不经过资源目录）：24×24 的橙色圆点，真机上用来验证小游戏能不能读 data: 图片。 */
const DOT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAn0lEQVR42r2VwQ3AIAhF2cEtHM4tvDGOYzgGY5DQCybGNK1p/RzexdD/YlUgYyIkbwXJmIoxNWMSY1JHfK14zSdB9TB7Qb12W5CNqW8Er3T/9lGQffv2EVklq6D/CJ93ciuoB8IHdRWkzQPdRcftGoJyMHxQZkEDCNosEIBAZoECBBoqgP8i+CHDryn8ocFbRUizC2nX8IETMjLDhv4RLse986G9/KsiAAAAAElFTkSuQmCC'

/**
 * 一条向下滚动的公路：倾斜手机、按 A / D 或推左下角的摇杆，左右移动车——三种输入驱动同一对动作。
 * HUD 显示传感器的权限状态和原始值，真机核对轴向和单位时直接看屏幕；摇杆用 @sapling2d/touch 的默认皮肤，
 * 右上角的橙色圆点是 data: 图片——两者在真机上显示出来，就说明插件包资源和内嵌图片都能读。
 */
export class Road extends Scene {
  static override assets = { dot: tex(DOT) }
  car!: Car
  hint!: Label
  readout!: Label
  stick!: TouchJoystick
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
    hud.add(new Label({ text: '倾斜手机转向 · 键盘 A / D · 左下摇杆', fontSize: 30, align: 'center', position: v(375, safe.top + 30) }))
    hud.add(new Sprite2D({ name: 'Dot', texture: Road.assets.dot, position: v(safe.right - 40, safe.top + 45), scale: v(2, 2) }))
    this.stick = hud.add(new TouchJoystick({ name: 'Stick', mode: 'fixed', actions: { left: 'steerLeft', right: 'steerRight' }, radius: 80, position: v(safe.left + 150, safe.bottom - 220) }))
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
