// #region example
import { CanvasLayer, Scene, sfx, v } from 'sapling2d'
import { Button, ui } from '@sapling2d/ui'

export const plugins = [ui({ clickSound: sfx('click.mp3') })] // 预加载默认皮肤；所有按钮点击都播这个音效

export class Menu extends Scene {
  started = false
  // 锚点按安全区摆放：开始按钮水平居中、离底边 200；商店按钮贴右上角。屏幕变化时自动重排
  readonly start = new Button({ name: 'Start', text: '开始游戏', size: v(360, 110), anchor: { centerX: 0, bottom: 200 } })
  readonly shop = new Button({ name: 'Shop', text: '商店', size: v(200, 80), anchor: { right: 24, top: 24 }, texture: null, backgroundColor: 0x6a4ad9 })

  override ready() {
    const hud = this.add(new CanvasLayer()) // 界面放在 CanvasLayer 里：不跟随相机，用设计坐标
    hud.add(this.start)
    hud.add(this.shop)
    this.shop.disabled = true // 还没解锁：半透明、点不到
    this.start.clicked.connect(() => (this.started = true))
  }
}
// #endregion

import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'

it('ui-button', async () => {
  const g = await createTestGame({ main: Menu, plugins })
  // #region test
  g.pointerDown(375, 1079) // 开始按钮的中心（750×1334 的设计分辨率，安全区就是整屏）
  g.step(8)
  expect(g.scene.start.body.scale.x).toBeCloseTo(1.1, 2) // 按下反馈：视觉主体围绕中心放大，节点自身的 rect 不变
  g.pointerUp(375, 1079)
  g.step()
  expect(g.scene.started).toBe(true)
  expect(g.audio.log.map((s) => s.path)).toEqual(['click.mp3'])
  g.tap(626, 64) // 禁用的商店按钮：点不到
  expect(g.dump()).toContain('Shop (Button) position=(526, 24) alpha=0.5 size=(200, 80) anchor=right:24,top:24 disabled=true')
  // #endregion
})
