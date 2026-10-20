import type { Plugin } from '../../core/plugin'
import type { SceneTree } from '../../core/SceneTree'
import { AdHost, MockBanner, MockFullscreenAd, type MockMode } from './mock'
import type { AdBanner, FullscreenAd, InterstitialResult, RewardedResult } from './provider'
import { createWechatAds, type WxAdsApi } from './wechat'

export type { AdBanner, InterstitialResult, RewardedResult } from './provider'
export { MOCK_LAYOUT, MOCK_BANNER_RATIO } from './mock'
export type { WxAdsApi, WxFullscreenAd, WxBannerAd, WxAdError } from './wechat'

/** 默认的超时（毫秒）。 */
const DEFAULT_TIMEOUT_MS = 15000

export interface AdsOptions {
  /** 激励视频的广告位 id（小游戏流量主）。不配就是 mock。 */
  rewarded?: string
  /** 插屏的广告位 id。 */
  interstitial?: string
  /** Banner 的广告位 id。 */
  banner?: string
  /** 激励视频 / 插屏播放期间 `tree.paused = true` 并静音 `Master` 总线，结束后恢复之前的状态。默认 true。 */
  pauseGame?: boolean
  /** mock 的行为：`'ui'`（默认，场景树里弹模拟覆盖层）或直接返回的结果（不弹；测试用）。 */
  mock?: MockMode
  /** 小游戏上从请求到能播的等待上限（毫秒），超时算 `unavailable`。默认 15000。 */
  timeoutMs?: number
}

/**
 * 广告服务，通过 `this.tree.get(Ads)` 访问。
 *
 * ```ts
 * const result = await this.tree.get(Ads).showRewarded()
 * if (result === 'rewarded') this.revive()   // 只有 'rewarded' 给奖励
 * ```
 *
 * - 任何失败都不抛错：返回 `'unavailable'`（`console.warn` 一次）。广告不该让游戏崩。
 * - 同一时间只播一个全屏广告：播放中再调用直接返回 `'unavailable'`，不会重复发奖励。
 * - 播放期间默认暂停场景树并静音（`pauseGame`），结束并恢复之后才 resolve。
 */
export class Ads {
  /** 当前是不是 mock（浏览器 / 无头 / 小游戏没配任何 id）。 */
  readonly isMock: boolean
  /** 预加载好、随时能播：用来决定要不要显示“看视频复活”按钮。 */
  readonly ready: { readonly rewarded: boolean; readonly interstitial: boolean }
  readonly banner: AdBanner
  private readonly _tree: SceneTree
  private readonly _rewarded: FullscreenAd
  private readonly _interstitial: FullscreenAd
  private readonly _pauseGame: boolean
  private _showing = false

  /** @internal 由 `ads()` 创建。 */
  constructor(tree: SceneTree, rewarded: FullscreenAd, interstitial: FullscreenAd, banner: AdBanner, isMock: boolean, pauseGame: boolean) {
    this._tree = tree
    this._rewarded = rewarded
    this._interstitial = interstitial
    this.banner = banner
    this.isMock = isMock
    this._pauseGame = pauseGame
    this.ready = {
      get rewarded() {
        return rewarded.ready
      },
      get interstitial() {
        return interstitial.ready
      },
    }
  }

  /** 播激励视频。`'rewarded'` 看完了（给奖励）、`'skipped'` 中途关了、`'unavailable'` 没广告 / 频控 / 没配 id / 出错 / 正在播别的。 */
  showRewarded(): Promise<RewardedResult> {
    return this._show(this._rewarded) as Promise<RewardedResult>
  }

  /** 播插屏。`'shown'` 或 `'unavailable'`。 */
  showInterstitial(): Promise<InterstitialResult> {
    return this._show(this._interstitial) as Promise<InterstitialResult>
  }

  private async _show(ad: FullscreenAd): Promise<RewardedResult | InterstitialResult> {
    if (this._showing) return 'unavailable'
    this._showing = true
    const tree = this._tree
    const wasPaused = tree.paused
    const wasMuted = tree.audio.isBusMuted('Master')
    if (this._pauseGame) {
      tree.paused = true
      tree.audio.setBusMute('Master', true)
    }
    try {
      return await ad.show()
    } catch (err) {
      console.warn(`[sapling2d] ads: showing the ad failed: ${err instanceof Error ? err.message : String(err)}`)
      return 'unavailable'
    } finally {
      if (this._pauseGame) {
        tree.paused = wasPaused
        tree.audio.setBusMute('Master', wasMuted)
      }
      this._showing = false
    }
  }

  /** @internal */
  _dispose(): void {
    this._rewarded.dispose()
    this._interstitial.dispose()
    this.banner.dispose()
  }
}

/**
 * 广告插件：`startGame({ main, plugins: [ads({ rewarded: 'adunit-…', interstitial: 'adunit-…', banner: 'adunit-…' })] })`。
 *
 * - 小游戏且配了 id 的类型是真广告（流量主）；没配的类型、浏览器、无头都是场景树里画出来的 mock——游戏流程三端都跑得通。
 * - 测试：`createTestGame({ plugins: [ads({ mock: 'rewarded' })] })` 不弹 UI 直接给结果；默认的 `'ui'` 可以用 `g.tap` 点覆盖层的按钮（坐标见 `MOCK_LAYOUT`）。
 */
export function ads(options: AdsOptions = {}): Plugin {
  return {
    install(ctx) {
      const host = ctx.autoload(AdHost)
      const wx = ctx.platform.kind === 'wechat' ? (globalThis as unknown as { wx?: WxAdsApi }).wx : undefined
      const providers = _createProviders(ctx.tree, host, options, wx)
      const service = new Ads(ctx.tree, providers.rewarded, providers.interstitial, providers.banner, providers.isMock, options.pauseGame ?? true)
      ctx.provide(Ads, service)
      return () => service._dispose()
    },
  }
}

/**
 * @internal 按平台和配置挑生产者：小游戏上配了 id（且基础库有这个 API）的类型是真广告，其余是 mock。
 * `wx` 为 undefined 就是非小游戏平台。导出给测试喂假 `wx`。
 */
export function _createProviders(tree: SceneTree, host: AdHost, options: AdsOptions, wx: WxAdsApi | undefined): { rewarded: FullscreenAd; interstitial: FullscreenAd; banner: AdBanner; isMock: boolean } {
  const mode = options.mock ?? 'ui'
  const real = wx ? createWechatAds(wx, tree, { ...options, timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS }) : { rewarded: null, interstitial: null, banner: null }
  if (wx) {
    const missing = (['rewarded', 'interstitial', 'banner'] as const).filter((k) => !real[k])
    if (missing.length) console.info(`[sapling2d] ads: no adUnitId (or no API on this base library) for ${missing.join(', ')}; using the mock. Pass ads({ ${missing.map((k) => `${k}: 'adunit-…'`).join(', ')} }) for real ads.`)
  }
  return {
    rewarded: real.rewarded ?? new MockFullscreenAd(host, 'rewarded', mode),
    interstitial: real.interstitial ?? new MockFullscreenAd(host, 'interstitial', mode),
    banner: real.banner ?? new MockBanner(host),
    isMock: !real.rewarded && !real.interstitial && !real.banner,
  }
}
