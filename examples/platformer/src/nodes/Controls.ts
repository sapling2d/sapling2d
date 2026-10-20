import { CanvasLayer, Rect2, Sprite2D, TouchJoystick, TouchScreenButton, v } from 'sapling2d'
import { ASSETS } from '../assets'

/** 方向键的触摸区域：盖住左右两张按钮图（各 60×60，中心相距 60）。 */
const DPAD = new Rect2(-60, -30, 120, 60)
/** 没按着的按钮图的透明度。 */
const DIM = 0.55

/**
 * 屏幕控件：左右方向键、跳。浏览器里也显示，键盘同样可用。
 * 方向键是一个只配左右的 fixed 摇杆盖在两张按钮图上（手指从“左”滑到“右”不用抬起）：
 * 半径 20、没有死区，按在任一张图上就是满力度，只有两张图接缝处的几个像素不算。
 */
export class Controls extends CanvasLayer {
  readonly left = new Sprite2D({ name: 'Left', texture: ASSETS.btnLeft, alpha: DIM })
  readonly right = new Sprite2D({ name: 'Right', texture: ASSETS.btnRight, alpha: DIM })
  readonly move = new TouchJoystick({ name: 'Move', mode: 'fixed', actions: { left: 'left', right: 'right' }, radius: 20, deadzone: 0, hitArea: DPAD })
  readonly jump = new TouchScreenButton({ name: 'Jump', action: 'jump', texture: ASSETS.btnJump, hitArea: new Rect2(-40, -40, 80, 80), alpha: DIM })
  private _dir = 0

  constructor() {
    super({ name: 'Controls', layer: 20 })
  }

  override ready() {
    this.add(this.left)
    this.add(this.right)
    this.add(this.move)
    this.add(this.jump)
    this._layout()
    this.tree.viewport.resized.connect(() => this._layout(), this)
  }

  /** 推向哪边就点亮哪张图。 */
  override process() {
    const dir = Math.sign(this.move.vectorX)
    if (dir === this._dir) return
    this._dir = dir
    this.left.alpha = dir < 0 ? 1 : DIM
    this.right.alpha = dir > 0 ? 1 : DIM
  }

  /** 贴着安全区的左下角和右下角。 */
  private _layout() {
    const r = this.tree.viewport.safeRect
    this.left.position = v(r.left + 36, r.bottom - 34)
    this.right.position = v(r.left + 96, r.bottom - 34)
    this.move.position = v(r.left + 66, r.bottom - 34)
    this.jump.position = v(r.right - 44, r.bottom - 38)
  }
}
