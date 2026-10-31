// #region example
import { CanvasLayer, Scene, v } from 'sapling2d'
import { ProgressBar, ui } from '@sapling2d/ui'

export const plugins = [ui()]

export class Battle extends Scene {
  hp = 100
  // 血条：默认皮肤（深色底 + 圆角填充），范围直接用血量；Boss 血条从右往左消
  readonly hpBar = new ProgressBar({ name: 'Hp', size: v(400, 36), maxValue: 100, value: 100, anchor: { left: 24, top: 24 } })
  readonly bossBar = new ProgressBar({ name: 'Boss', size: v(600, 24), value: 1, fillMode: 'rightToLeft', fillColor: 0xe04040, anchor: { centerX: 0, top: 90 } })

  override ready() {
    const hud = this.add(new CanvasLayer())
    hud.add(this.hpBar)
    hud.add(this.bossBar)
  }

  hit(damage: number) {
    this.hp = Math.max(0, this.hp - damage)
    this.hpBar.createTween().to(this.hpBar, { value: this.hp }, 0.2) // value 可以补间：血条平滑地掉
    this.hpBar.fillColor = this.hp > 30 ? 0x5ad26a : 0xe04040 // 血少了变红
  }
}
// #endregion

import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'

it('ui-progress-bar', async () => {
  const g = await createTestGame({ main: Battle, plugins })
  // #region test
  g.scene.hit(60)
  g.stepSeconds(0.3)
  expect(g.scene.hpBar.value).toBe(40)
  expect(g.scene.hpBar.ratio).toBeCloseTo(0.4)
  // 填充节点始终铺满（388 = 400 - 两边各 6 的内缩），只是被 clipRect 裁到 40%：九宫格不变形
  expect(g.scene.hpBar.fill.size).toEqual(v(388, 24))
  expect(g.scene.hpBar.fill.clipRect?.width).toBeCloseTo(388 * 0.4)
  expect(g.scene.hpBar.fillColor).toBe(0x5ad26a)
  g.scene.hit(20)
  g.stepSeconds(0.3)
  expect(g.scene.hpBar.fillColor).toBe(0xe04040)
  expect(g.dump()).toContain('Hp (ProgressBar) position=(24, 24) size=(400, 36) anchor=left:24,top:24 value=20')
  // #endregion
})
