// #region example
import { ColorRect, Label, rect, Scene, v } from 'sapling2d'
import { ads, Ads } from '@sapling2d/ads'

export class GameOver extends Scene {
  revived = false

  override ready() {
    const a = this.tree.get(Ads)
    if (!a.ready.rewarded) return // 没有能播的激励视频就不显示按钮
    const button = this.add(new ColorRect({ name: 'Revive', size: v(300, 90), position: v(225, 800), color: 0x3b7ddd, inputPickable: true, hitArea: rect(0, 0, 300, 90) }))
    button.add(new Label({ text: '看视频复活', fontSize: 32, align: 'center', verticalAlign: 'center', position: v(150, 45) }))
    button.clicked.connect(() => void this.revive(), this)
  }

  async revive() {
    const result = await this.tree.get(Ads).showRewarded() // 播放期间游戏暂停、静音；结束后才返回
    if (result === 'rewarded') this.revived = true // 只有看完才给奖励；'skipped'（中途关了）/ 'unavailable'（没广告）不给
  }
}

// 启动参数：startGame({ main: GameOver, plugins: [ads({ rewarded: 'adunit-xxx', interstitial: 'adunit-yyy', banner: 'adunit-zzz' })] })
// 浏览器和没配 id 的小游戏是 mock：弹一个带“看完 / 关闭”按钮的覆盖层
// #endregion

import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'

it('ads', async () => {
  // #region test
  const g = await createTestGame({ main: GameOver, plugins: [ads({ mock: 'rewarded' })] }) // 不弹 UI，直接当作看完
  g.tap(375, 845)
  await new Promise((r) => setTimeout(r, 0))
  expect(g.scene.revived).toBe(true)
  // #endregion
})
