import { describe, expect, it, vi } from 'vitest'
import { Node, Node2D, rect, Scene, v } from 'sapling2d'
import { ads, Ads, MOCK_LAYOUT } from '@sapling2d/ads'
import { createTestGame } from 'sapling2d/testing'

/** 默认屏幕 750×1334 下覆盖层按钮的中心（见 MOCK_LAYOUT）。 */
const CX = 375
const CY = 667
const FINISH = v(CX - MOCK_LAYOUT.button.offsetX, CY + MOCK_LAYOUT.button.offsetY)
const CLOSE = v(CX + MOCK_LAYOUT.button.offsetX, CY + MOCK_LAYOUT.button.offsetY)

/** 每帧 process 计数的节点：用来看游戏有没有被暂停。 */
class Ticker extends Node {
  ticks = 0
  override process() {
    this.ticks++
  }
}

describe('Ads：mock 直接返回', () => {
  it("mock: 'rewarded' / 'skipped' / 'unavailable'：不弹 UI，await 直接拿到结果；ready 和 isMock", async () => {
    for (const mode of ['rewarded', 'skipped', 'unavailable'] as const) {
      const g = await createTestGame({ main: Scene, plugins: [ads({ mock: mode })] })
      const a = g.tree.get(Ads)
      expect(a.isMock).toBe(true)
      expect([a.ready.rewarded, a.ready.interstitial]).toEqual([mode !== 'unavailable', mode !== 'unavailable'])
      expect(await a.showRewarded()).toBe(mode)
      expect(await a.showInterstitial()).toBe(mode === 'unavailable' ? 'unavailable' : 'shown')
      expect(g.dump()).not.toContain('AdMock')
    }
  })

  it('没装插件：tree.get(Ads) 报错并提示 plugins', async () => {
    const g = await createTestGame({ main: Scene })
    expect(() => g.tree.get(Ads)).toThrow(/Ads is not installed.*plugins: \[/)
  })
})

describe('Ads：mock 覆盖层', () => {
  it('默认弹覆盖层：Ads 层下有遮罩和两个按钮；点“看完”→ rewarded，覆盖层移除', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads()] })
    const p = g.tree.get(Ads).showRewarded()
    g.step()
    const dump = g.dump()
    expect(dump).toContain('Ads (AdHost)')
    expect(dump).toContain('AdMock (ColorRect)')
    expect(dump).toContain('Finish (ColorRect)')
    expect(dump).toContain('Close (ColorRect)')
    g.tap(FINISH.x, FINISH.y)
    expect(await p).toBe('rewarded')
    g.step()
    expect(g.dump()).not.toContain('AdMock')
  })

  it('点“关闭”→ skipped；插屏只有一个关闭按钮 → shown', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads()] })
    const a = g.tree.get(Ads)
    const p = a.showRewarded()
    g.step()
    g.tap(CLOSE.x, CLOSE.y)
    expect(await p).toBe('skipped')
    g.step()
    const q = a.showInterstitial()
    g.step()
    expect(g.dump()).not.toContain('Finish')
    g.tap(CX, CY + MOCK_LAYOUT.button.offsetY)
    expect(await q).toBe('shown')
  })

  it('遮罩吞掉其它点击：点空白处没反应，下面场景的可点击节点收不到', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads()] })
    let clicks = 0
    const under = g.scene.add(new Node2D({ position: v(100, 100), inputPickable: true, hitArea: rect(-50, -50, 100, 100) }))
    under.clicked.connect(() => clicks++)
    const p = g.tree.get(Ads).showRewarded()
    g.step()
    g.tap(100, 100) // 遮罩下面的节点
    g.tap(CX, CY) // 面板中间的空白
    expect(clicks).toBe(0)
    expect(g.dump()).toContain('AdMock')
    g.tap(FINISH.x, FINISH.y)
    expect(await p).toBe('rewarded')
    g.step()
    g.tap(100, 100)
    expect(clicks).toBe(1) // 覆盖层没了，下面的节点又能点
  })

  it('播放中：场景树暂停、Master 静音；关闭后恢复；本来就暂停 / 静音的不被“恢复”成运行', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads()] })
    const ticker = g.scene.add(new Ticker())
    const a = g.tree.get(Ads)
    g.step()
    expect(ticker.ticks).toBe(1)
    const p = a.showRewarded()
    g.step(3)
    expect([g.tree.paused, g.tree.audio.isBusMuted('Master'), ticker.ticks]).toEqual([true, true, 1])
    g.tap(FINISH.x, FINISH.y)
    await p
    expect([g.tree.paused, g.tree.audio.isBusMuted('Master')]).toEqual([false, false])
    g.step()
    expect(ticker.ticks).toBe(2)

    // 本来就暂停 + 静音
    g.tree.paused = true
    g.tree.audio.setBusMute('Master', true)
    const q = a.showRewarded()
    g.step()
    g.tap(CLOSE.x, CLOSE.y)
    await q
    expect([g.tree.paused, g.tree.audio.isBusMuted('Master')]).toEqual([true, true])
  })

  it("pauseGame: false 时不动暂停和静音", async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads({ pauseGame: false })] })
    const ticker = g.scene.add(new Ticker())
    const p = g.tree.get(Ads).showRewarded()
    g.step(2)
    expect([g.tree.paused, g.tree.audio.isBusMuted('Master'), ticker.ticks]).toEqual([false, false, 2])
    g.tap(FINISH.x, FINISH.y)
    await p
  })

  it('播放中再次调用直接返回 unavailable，不弹第二层', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads()] })
    const a = g.tree.get(Ads)
    const p = a.showRewarded()
    g.step()
    expect(await a.showRewarded()).toBe('unavailable')
    expect(await a.showInterstitial()).toBe('unavailable')
    expect(g.dump().match(/AdMock/g)).toHaveLength(1)
    g.tap(FINISH.x, FINISH.y)
    expect(await p).toBe('rewarded')
    // 结束后又能播
    const q = a.showRewarded()
    g.step()
    g.tap(CLOSE.x, CLOSE.y)
    expect(await q).toBe('skipped')
  })

  it('覆盖层在场景切换后仍在（挂在插件的 Autoload 下）', async () => {
    class A extends Scene {}
    class B extends Scene {}
    const g = await createTestGame({ main: A, plugins: [ads()] })
    const p = g.tree.get(Ads).showRewarded()
    g.step()
    await g.tree.changeScene(B)
    g.step()
    expect(g.dump()).toContain('AdMock')
    g.tap(FINISH.x, FINISH.y)
    expect(await p).toBe('rewarded')
  })
})

describe('Ads：banner mock', () => {
  it('show 返回 true，高度是 0.27 × 屏幕宽（设计像素），resized 发一次；hide 后为 0；重复 show 幂等', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads()] })
    const banner = g.tree.get(Ads).banner
    const heights: number[] = []
    banner.resized.connect((h) => heights.push(h))
    expect([banner.visible, banner.height]).toEqual([false, 0])
    expect(await banner.show()).toBe(true)
    expect([banner.visible, banner.height, heights]).toEqual([true, 203, [203]]) // round(0.27 × 750)
    g.step()
    expect(g.dump()).toContain('AdBanner (ColorRect)')
    expect(await banner.show()).toBe(true)
    expect(heights).toEqual([203])
    banner.hide()
    expect([banner.visible, banner.height, heights]).toEqual([false, 0, [203, 0]])
    g.step()
    expect(g.dump()).not.toContain('AdBanner')
  })

  it('不同屏幕：高度按屏幕宽和缩放算', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads()], screen: { width: 402, height: 874, pixelRatio: 3 } })
    const banner = g.tree.get(Ads).banner
    await banner.show()
    // 屏幕 402 宽 → banner 108.54 屏幕像素；设计分辨率 750 对应 402 屏幕像素，scale = 402 / 750
    expect(banner.height).toBe(Math.round((0.27 * 402) / (402 / 750)))
  })
})

describe('Ads：卸载', () => {
  it('game.destroy() 后覆盖层和 banner 都移除', async () => {
    const g = await createTestGame({ main: Scene, plugins: [ads()] })
    const a = g.tree.get(Ads)
    void a.showRewarded()
    await a.banner.show()
    g.step()
    expect(g.dump()).toContain('AdMock')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    g.game.destroy()
    g.step()
    expect(g.dump()).not.toContain('AdMock')
    expect(g.dump()).not.toContain('AdBanner')
    warn.mockRestore()
  })
})
