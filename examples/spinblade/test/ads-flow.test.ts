import { describe, expect, it } from 'vitest'
import { ads, Ads } from '@sapling2d/ads'
import { touch } from '@sapling2d/touch'
import { createTestGame } from 'sapling2d/testing'
import { PLAYER } from '../src/config'
import { gameOptions } from '../src/game'
import { Arena } from '../src/scenes/Arena'
import { AD_BONUS_KNIVES, Result } from '../src/scenes/Result'

const settle = () => new Promise((r) => setTimeout(r, 0))

/** 等 changeScene 完成（资源加载是异步的）。 */
async function waitForScene(g: { scene: unknown }, cls: abstract new (...args: never[]) => unknown) {
  for (let i = 0; i < 20 && !(g.scene instanceof cls); i++) await settle()
}

/** 用指定的广告 mock 启动，并直接把玩家打死进入结果页。 */
async function lose(mode: 'rewarded' | 'skipped' | 'unavailable') {
  const g = await createTestGame({ ...gameOptions, plugins: [touch(), ads({ mock: mode })], seed: 1 })
  const arena = g.scene as Arena
  arena.player.damage(arena.player.hp)
  g.step()
  g.stepSeconds(PLAYER.deathDelay + 0.3)
  await waitForScene(g, Result)
  g.stepSeconds(0.6) // 结果画面刚出现时不接受输入
  return { g, result: g.scene as unknown as Result }
}

describe('结果画面的广告', () => {
  it('有激励视频时显示按钮；看完 → 重开本关并多带刀', async () => {
    const { g } = await lose('rewarded')
    expect(g.dump()).toContain('ReviveAd (ColorRect)')
    expect(g.tree.get(Ads).banner.visible).toBe(true)
    g.tap(375, 900)
    await waitForScene(g, Arena)
    await settle()
    const arena = g.scene as Arena
    expect(arena.state).toBe('fight')
    expect(arena.player.knives.length).toBe(PLAYER.startKnives + AD_BONUS_KNIVES)
    expect(g.tree.get(Ads).banner.visible).toBe(false) // 离开结果页时隐藏
    expect(g.tree.paused).toBe(false)
  })

  it('中途关了：留在结果页并提示，没有奖励', async () => {
    const { g } = await lose('skipped')
    g.tap(375, 900)
    await settle()
    expect(g.scene).toBeInstanceOf(Result)
    expect(g.dump()).toContain('没看完，没有奖励')
  })

  it('没有广告（测试默认）：不显示按钮，点屏幕照常再来一局', async () => {
    const { g } = await lose('unavailable')
    expect(g.dump()).not.toContain('ReviveAd')
    expect(g.tree.get(Ads).banner.visible).toBe(true) // banner mock 不受 mock 模式影响
    g.tap(375, 667)
    await waitForScene(g, Arena)
    expect((g.scene as Arena).player.knives.length).toBe(PLAYER.startKnives)
  })
})
