import { afterEach, describe, expect, it, vi } from 'vitest'
import { Scene } from 'sapling2d'
import { _createProviders, Ads, type WxAdError, type WxAdsApi, type WxBannerAd, type WxFullscreenAd } from 'sapling2d/ads'
import { createTestGame } from 'sapling2d/testing'
import { AdHost } from '../src/plugins/ads/mock'
import { WechatBanner, WechatFullscreenAd } from '../src/plugins/ads/wechat'

/** 假的激励视频 / 插屏：记录调用，手动触发回调。 */
function fakeFullscreen() {
  const handlers = { load: [] as (() => void)[], error: [] as ((e: WxAdError) => void)[], close: [] as ((r?: { isEnded?: boolean }) => void)[] }
  const log: string[] = []
  const state = { showRejects: false }
  const ad: WxFullscreenAd = {
    load: () => {
      log.push('load')
      return Promise.resolve()
    },
    show: () => {
      log.push('show')
      return state.showRejects ? Promise.reject(new Error('not loaded')) : Promise.resolve()
    },
    destroy: () => void log.push('destroy'),
    onLoad: (cb) => void handlers.load.push(cb),
    onError: (cb) => void handlers.error.push(cb),
    onClose: (cb) => void handlers.close.push(cb),
  }
  return {
    ad,
    log,
    state,
    loaded: () => handlers.load.forEach((cb) => cb()),
    error: (err: WxAdError) => handlers.error.forEach((cb) => cb(err)),
    close: (res?: { isEnded?: boolean }) => handlers.close.forEach((cb) => cb(res)),
  }
}

/** 假的 banner。 */
function fakeBanner() {
  const handlers = { error: [] as ((e: WxAdError) => void)[], resize: [] as ((r: { width: number; height: number }) => void)[] }
  const log: string[] = []
  const state = { showRejects: false }
  let created: { adUnitId: string; style: { left: number; top: number; width: number } } | null = null
  const ad: WxBannerAd = {
    style: { left: 0, top: 0, width: 0 },
    show: () => {
      log.push('show')
      return state.showRejects ? Promise.reject(new Error('banner failed')) : Promise.resolve()
    },
    hide: () => void log.push('hide'),
    destroy: () => void log.push('destroy'),
    onError: (cb) => void handlers.error.push(cb),
    onResize: (cb) => void handlers.resize.push(cb),
  }
  const api: Pick<Required<WxAdsApi>, 'createBannerAd'> = {
    createBannerAd: (options) => {
      created = options
      ad.style = { ...options.style }
      return ad
    },
  }
  return { api, ad, log, state, created: () => created!, resize: (width: number, height: number) => handlers.resize.forEach((cb) => cb({ width, height })), error: (err: WxAdError) => handlers.error.forEach((cb) => cb(err)) }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

afterEach(() => vi.restoreAllMocks())

describe('小游戏激励视频 / 插屏', () => {
  it('安装即 load 预加载；onLoad 后 ready；已加载时 show 直接播，看完 → rewarded，关闭后自动 load 下一条', async () => {
    const f = fakeFullscreen()
    const ad = new WechatFullscreenAd(f.ad, 'rewarded', 1000)
    expect([f.log, ad.ready]).toEqual([['load'], false])
    f.loaded()
    expect(ad.ready).toBe(true)
    const p = ad.show()
    await tick()
    expect(f.log).toEqual(['load', 'show'])
    f.close({ isEnded: true })
    expect(await p).toBe('rewarded')
    expect([ad.ready, f.log]).toEqual([false, ['load', 'show', 'load']])
  })

  it('isEnded false → skipped；res 为 undefined（老基础库）→ rewarded；插屏 → shown', async () => {
    const f = fakeFullscreen()
    const ad = new WechatFullscreenAd(f.ad, 'rewarded', 1000)
    let p = ad.show()
    await tick()
    f.close({ isEnded: false })
    expect(await p).toBe('skipped')
    p = ad.show()
    await tick()
    f.close(undefined)
    expect(await p).toBe('rewarded')

    const g = fakeFullscreen()
    const inter = new WechatFullscreenAd(g.ad, 'interstitial', 1000)
    const q = inter.show()
    await tick()
    g.close({ isEnded: true })
    expect(await q).toBe('shown')
  })

  it('show 被拒（没加载好）：load 再 show 一次；还失败 → unavailable 并警告一次', async () => {
    const f = fakeFullscreen()
    const ad = new WechatFullscreenAd(f.ad, 'rewarded', 1000)
    f.state.showRejects = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await ad.show()).toBe('unavailable')
    expect(f.log).toEqual(['load', 'show', 'load', 'show'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toMatch(/rewarded.*not loaded/)
    // 第二次成功：load 之后的 show 成功，等 onClose
    f.state.showRejects = false
    const p = ad.show()
    await tick()
    f.close({ isEnded: true })
    expect(await p).toBe('rewarded')
  })

  it('show 被 wx 以 { errCode, errMsg } 对象拒绝（开发者工具里无效 id 就是这样）：文案带错误码，不是 [object Object]', async () => {
    const f = fakeFullscreen()
    const ad = new WechatFullscreenAd(f.ad, 'interstitial', 1000)
    f.ad.show = () => Promise.reject({ errCode: 1002, errMsg: 'no advertisement' })
    f.ad.load = () => Promise.reject({ errCode: 1002, errMsg: 'no advertisement' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await ad.show()).toBe('unavailable')
    expect(String(warn.mock.calls[0]![0])).toBe('[sapling2d] ads: interstitial error 1002 (广告单元无效): no advertisement')
    expect(String(warn.mock.calls[0]![0])).not.toContain('[object Object]')
  })

  it('onError：当前请求 unavailable、ready 变 false；同一个 errCode 只警告一次，文案带解释', async () => {
    const f = fakeFullscreen()
    const ad = new WechatFullscreenAd(f.ad, 'rewarded', 1000)
    f.loaded()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = ad.show()
    await tick()
    f.error({ errCode: 1004, errMsg: 'no ad' })
    expect(await p).toBe('unavailable')
    expect(ad.ready).toBe(false)
    f.error({ errCode: 1004, errMsg: 'no ad' })
    f.error({ errCode: 1005, errMsg: 'reviewing' })
    expect(warn).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[0]![0])).toContain('error 1004 (无合适的广告)')
    expect(String(warn.mock.calls[1]![0])).toContain('error 1005 (广告组件审核中)')
  })

  it('超时 → unavailable；之后迟到的 onClose 不改变结果、不重复 resolve；再次 show 正常', async () => {
    const f = fakeFullscreen()
    const ad = new WechatFullscreenAd(f.ad, 'rewarded', 20)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = ad.show()
    expect(await p).toBe('unavailable')
    expect(String(warn.mock.calls[0]![0])).toMatch(/no response within 20 ms/)
    f.close({ isEnded: true }) // 迟到
    const q = ad.show()
    await tick()
    f.close({ isEnded: true })
    expect(await q).toBe('rewarded')
  })

  it('播放中再 show → unavailable（Ads 外面还有一层保护）；dispose 结束等待中的请求并 destroy', async () => {
    const f = fakeFullscreen()
    const ad = new WechatFullscreenAd(f.ad, 'interstitial', 1000)
    const p = ad.show()
    expect(await ad.show()).toBe('unavailable')
    ad.dispose()
    expect(await p).toBe('unavailable')
    expect(f.log).toContain('destroy')
  })
})

describe('小游戏 banner', () => {
  it('创建时 style 撑满屏幕、按估算贴底；onResize 后贴安全区底部、height 为设计像素、resized 只在显示时发', async () => {
    const g = await createTestGame({ main: Scene })
    const b = fakeBanner()
    const banner = new WechatBanner(b.api, 'adunit-b', g.tree)
    expect(b.created().adUnitId).toBe('adunit-b')
    expect(b.created().style).toEqual({ left: 0, top: 1334 - 750 * 0.27, width: 750 })
    const heights: number[] = []
    banner.resized.connect((h) => heights.push(h))
    b.resize(750, 100)
    expect([b.ad.style.top, banner.height, heights]).toEqual([1234, 0, []]) // 还没 show：高度 0、不通知
    expect(await banner.show()).toBe(true)
    expect([banner.visible, banner.height, heights, b.log]).toEqual([true, 100, [100], ['show']])
    b.resize(750, 120)
    expect([b.ad.style.top, banner.height, heights]).toEqual([1214, 120, [100, 120]])
    banner.hide()
    expect([banner.visible, banner.height, heights, b.log]).toEqual([false, 0, [100, 120, 0], ['show', 'hide']])
    expect(b.log).not.toContain('destroy')
    expect(await banner.show()).toBe(true)
    expect(heights).toEqual([100, 120, 0, 120])
    banner.dispose()
    expect(b.log).toContain('destroy')
  })

  it('小屏幕：宽度至少 300、居中；高度按 viewport.scale 换算；屏幕变化时重算位置', async () => {
    const g = await createTestGame({ main: Scene, screen: { width: 280, height: 600, pixelRatio: 2 } })
    const b = fakeBanner()
    const banner = new WechatBanner(b.api, 'adunit-b', g.tree)
    expect(b.created().style.width).toBe(300)
    expect(b.created().style.left).toBe(-10)
    await banner.show()
    b.resize(300, 81)
    expect(banner.height).toBe(Math.round(81 / g.tree.viewport.scale))
    g.setScreen({ width: 402, height: 874, pixelRatio: 3 })
    expect([b.ad.style.left, b.ad.style.top]).toEqual([(402 - 300) / 2, 874 - 81])
  })

  it('show 失败 → false，警告一次；onError 也只警告一次', async () => {
    const g = await createTestGame({ main: Scene })
    const b = fakeBanner()
    b.state.showRejects = true
    const banner = new WechatBanner(b.api, 'adunit-b', g.tree)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await banner.show()).toBe(false)
    expect(await banner.show()).toBe(false)
    b.error({ errCode: 1002, errMsg: 'bad unit' })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(banner.visible).toBe(false)
  })
})

describe('按配置挑生产者', () => {
  it('小游戏：配了 id 的类型是真广告，没配的走 mock 并 info 一次；isMock 只在三种都是 mock 时为 true；旧基础库没有 API 也走 mock', async () => {
    const g = await createTestGame({ main: Scene })
    const host = new AdHost()
    g.scene.add(host)
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const f = fakeFullscreen()
    const api: WxAdsApi = { createRewardedVideoAd: () => f.ad, createInterstitialAd: () => fakeFullscreen().ad, createBannerAd: fakeBanner().api.createBannerAd }
    const some = _createProviders(g.tree, host, { rewarded: 'adunit-r' }, api)
    expect([some.isMock, some.rewarded instanceof WechatFullscreenAd, some.interstitial instanceof WechatFullscreenAd, some.banner instanceof WechatBanner]).toEqual([false, true, false, false])
    expect(info).toHaveBeenCalledTimes(1)
    expect(String(info.mock.calls[0]![0])).toMatch(/for interstitial, banner; using the mock/)

    const all = _createProviders(g.tree, host, { rewarded: 'r', interstitial: 'i', banner: 'b' }, api)
    expect([all.isMock, all.banner instanceof WechatBanner]).toEqual([false, true])
    expect(info).toHaveBeenCalledTimes(1)

    const old = _createProviders(g.tree, host, { rewarded: 'r', interstitial: 'i' }, {}) // 旧基础库：没有这些 API
    expect([old.isMock, old.rewarded instanceof WechatFullscreenAd]).toEqual([true, false])

    const browser = _createProviders(g.tree, host, { rewarded: 'r' }, undefined)
    expect(browser.isMock).toBe(true)
    expect(info).toHaveBeenCalledTimes(2) // 浏览器 / 无头不提示
  })

  it('激励视频创建时关掉 3.7.7 的分享页兜底（disableFallbackSharePage）', async () => {
    const g = await createTestGame({ main: Scene })
    const host = new AdHost()
    g.scene.add(host)
    let options: unknown = null
    _createProviders(g.tree, host, { rewarded: 'r' }, {
      createRewardedVideoAd: (o) => {
        options = o
        return fakeFullscreen().ad
      },
    })
    expect(options).toEqual({ adUnitId: 'r', disableFallbackSharePage: true })
  })

  it('整条链路：真激励视频通过 Ads 播放时暂停 / 静音，关闭后恢复', async () => {
    const g = await createTestGame({ main: Scene })
    const f = fakeFullscreen()
    const host = new AdHost()
    g.scene.add(host)
    const p = _createProviders(g.tree, host, { rewarded: 'r', mock: 'unavailable' }, { createRewardedVideoAd: () => f.ad })
    const service = new Ads(g.tree, p.rewarded, p.interstitial, p.banner, p.isMock, true)
    f.loaded()
    expect([service.isMock, service.ready.rewarded, service.ready.interstitial]).toEqual([false, true, false])
    const shown = service.showRewarded()
    await tick()
    expect([g.tree.paused, g.tree.audio.isBusMuted('Master')]).toEqual([true, true])
    f.close({ isEnded: true })
    expect(await shown).toBe('rewarded')
    expect([g.tree.paused, g.tree.audio.isBusMuted('Master')]).toEqual([false, false])
    expect(await service.showInterstitial()).toBe('unavailable') // 没配：mock 'unavailable'
  })
})
