import { Signal } from '../../core/Signal'
import type { SceneTree } from '../../core/SceneTree'
import type { AdBanner, FullscreenAd, InterstitialResult, RewardedResult } from './provider'

// 用到的那一点 wx 广告 API。不引用 wx.d.ts：那会把 `wx` 全局声明带进核心的类型检查程序。
export interface WxAdError {
  errCode?: number
  errMsg: string
}
/** 激励视频 / 插屏共用的形态（`wx.createRewardedVideoAd` / `wx.createInterstitialAd` 的返回）。 */
export interface WxFullscreenAd {
  load(): Promise<void>
  show(): Promise<void>
  destroy?(): void
  onLoad(cb: () => void): void
  onError(cb: (err: WxAdError) => void): void
  onClose(cb: (res?: { isEnded?: boolean }) => void): void
}
export interface WxBannerStyle {
  left: number
  top: number
  width: number
  height?: number
  realWidth?: number
  realHeight?: number
}
export interface WxBannerAd {
  style: WxBannerStyle
  show(): Promise<void>
  hide(): void
  destroy(): void
  onError(cb: (err: WxAdError) => void): void
  onResize(cb: (res: { width: number; height: number }) => void): void
}
export interface WxAdsApi {
  createRewardedVideoAd?(options: { adUnitId: string }): WxFullscreenAd
  createInterstitialAd?(options: { adUnitId: string }): WxFullscreenAd
  createBannerAd?(options: { adUnitId: string; style: { left: number; top: number; width: number } }): WxBannerAd
}

/** 流量主的错误码（写进警告，省得查文档）。 */
const ERRORS: Record<number, string> = {
  1000: '后端错误',
  1001: '参数错误',
  1002: '广告单元无效',
  1003: '内部错误',
  1004: '无合适的广告',
  1005: '广告组件审核中',
  1006: '广告组件被驳回',
  1007: '广告组件被封禁',
  1008: '广告单元已关闭',
}

/** 真 banner 的高宽比估算（拿到 onResize 之前先按它贴底）。 */
const BANNER_RATIO = 0.27
/** Banner 的最小宽度（平台限制）。 */
const BANNER_MIN_WIDTH = 300

/** 两端都有的定时器（结构类型；核心的类型检查没有 DOM / Node）。 */
const timers = globalThis as unknown as { setTimeout(cb: () => void, ms: number): unknown; clearTimeout(id: unknown): void }

function describe(err: WxAdError): string {
  const code = err.errCode
  return code !== undefined ? `error ${code}${ERRORS[code] ? ` (${ERRORS[code]})` : ''}: ${err.errMsg}` : err.errMsg
}

/**
 * 小游戏的激励视频 / 插屏：安装时预加载；`show()` 被拒就 `load()` 再试一次；关闭后立刻预加载下一条。
 * 任何失败都 resolve `unavailable`（同一个错误码只警告一次），`timeoutMs` 兜底。暂停 / 静音和并发保护在 `Ads` 里。
 */
export class WechatFullscreenAd implements FullscreenAd {
  private readonly _ad: WxFullscreenAd
  private readonly _kind: 'rewarded' | 'interstitial'
  private readonly _timeoutMs: number
  private readonly _warned = new Set<number | string>()
  private _ready = false
  /** 正在播的请求：onClose / onError / 超时里谁先到谁 resolve，之后的忽略。 */
  private _request: { resolve: (result: RewardedResult | InterstitialResult) => void; timer: unknown } | null = null

  constructor(ad: WxFullscreenAd, kind: 'rewarded' | 'interstitial', timeoutMs: number) {
    this._ad = ad
    this._kind = kind
    this._timeoutMs = timeoutMs
    ad.onLoad(() => {
      this._ready = true
    })
    ad.onError((err) => {
      this._ready = false
      this._warnOnce(err)
      this._settle('unavailable')
    })
    ad.onClose((res) => {
      this._ready = false
      const result: RewardedResult | InterstitialResult = this._kind === 'interstitial' ? 'shown' : res?.isEnded !== false ? 'rewarded' : 'skipped'
      this._settle(result)
      // 预加载下一条；失败走 onError（没有请求在等，只是 ready 保持 false）
      void ad.load().catch(() => {})
    })
    void ad.load().catch(() => {})
  }

  get ready(): boolean {
    return this._ready
  }

  show(): Promise<RewardedResult | InterstitialResult> {
    if (this._request) return Promise.resolve('unavailable')
    return new Promise((resolve) => {
      const timer = timers.setTimeout(() => {
        this._warnOnce({ errMsg: `no response within ${this._timeoutMs} ms`, errCode: undefined }, 'timeout')
        this._settle('unavailable')
      }, this._timeoutMs)
      this._request = { resolve, timer }
      const ad = this._ad
      ad.show()
        .catch(() => ad.load().then(() => ad.show()))
        .catch((err: unknown) => {
          this._warnOnce({ errMsg: err instanceof Error ? err.message : String(err) }, 'show')
          this._settle('unavailable')
        })
    })
  }

  dispose(): void {
    this._settle('unavailable')
    this._ad.destroy?.()
  }

  private _settle(result: RewardedResult | InterstitialResult): void {
    const request = this._request
    if (!request) return
    this._request = null
    timers.clearTimeout(request.timer)
    request.resolve(result)
  }

  private _warnOnce(err: WxAdError, key: number | string | undefined = err.errCode): void {
    const k = key ?? err.errMsg
    if (this._warned.has(k)) return
    this._warned.add(k)
    console.warn(`[sapling2d] ads: ${this._kind} ${describe(err)}`)
  }
}

/**
 * 小游戏的 banner：宽度撑满屏幕（至少 300），`onResize` 之后贴到安全区底部；`height` 换算成设计像素。
 * `hide()` 不销毁（再 `show()` 不重新加载）。
 */
export class WechatBanner implements AdBanner {
  readonly resized = new Signal<[height: number]>()
  private readonly _ad: WxBannerAd
  private readonly _tree: SceneTree
  private readonly _offResize: () => void
  private _visible = false
  /** 真实高度（屏幕像素），onResize 之前为 0。 */
  private _realHeight = 0
  private _warned = false

  constructor(api: Pick<Required<WxAdsApi>, 'createBannerAd'>, adUnitId: string, tree: SceneTree) {
    this._tree = tree
    const screen = tree.viewport.screen
    const width = Math.max(BANNER_MIN_WIDTH, screen.width)
    this._ad = api.createBannerAd({ adUnitId, style: { left: (screen.width - width) / 2, top: screen.height - width * BANNER_RATIO, width } })
    this._ad.onError((err) => {
      if (this._warned) return
      this._warned = true
      console.warn(`[sapling2d] ads: banner ${describe(err)}`)
    })
    this._ad.onResize((res) => {
      this._realHeight = res.height
      this._place(res.width, res.height)
      if (this._visible) this.resized.emit(this.height)
    })
    this._offResize = tree.viewport.resized.connect(() => this._place(this._ad.style.width, this._realHeight))
  }

  get visible(): boolean {
    return this._visible
  }

  get height(): number {
    return this._visible && this._realHeight > 0 ? Math.round(this._realHeight / this._tree.viewport.scale) : 0
  }

  show(): Promise<boolean> {
    if (this._visible) return Promise.resolve(true)
    return this._ad.show().then(
      () => {
        this._visible = true
        if (this._realHeight > 0) this.resized.emit(this.height)
        return true
      },
      (err: unknown) => {
        if (!this._warned) {
          this._warned = true
          console.warn(`[sapling2d] ads: banner show failed: ${err instanceof Error ? err.message : String(err)}`)
        }
        return false
      },
    )
  }

  hide(): void {
    if (!this._visible) return
    this._visible = false
    this._ad.hide()
    this.resized.emit(0)
  }

  dispose(): void {
    this._offResize()
    this._visible = false
    this._ad.destroy()
  }

  /** 按当前屏幕把 banner 居中贴到安全区底部；`height` 为 0（还没 onResize）时用估算高度。 */
  private _place(width: number, height: number): void {
    const screen = this._tree.viewport.screen
    const style = this._ad.style
    const h = height > 0 ? height : width * BANNER_RATIO
    style.left = (screen.width - width) / 2
    style.top = screen.safeArea.bottom - h
  }
}

/** `ads()` 在小游戏上创建的生产者：配了 id 且 API 存在的类型才创建，其余由调用方换成 mock。 */
export function createWechatAds(
  api: WxAdsApi,
  tree: SceneTree,
  options: { rewarded?: string; interstitial?: string; banner?: string; timeoutMs: number },
): { rewarded: FullscreenAd | null; interstitial: FullscreenAd | null; banner: AdBanner | null } {
  return {
    rewarded: options.rewarded && api.createRewardedVideoAd ? new WechatFullscreenAd(api.createRewardedVideoAd({ adUnitId: options.rewarded }), 'rewarded', options.timeoutMs) : null,
    interstitial: options.interstitial && api.createInterstitialAd ? new WechatFullscreenAd(api.createInterstitialAd({ adUnitId: options.interstitial }), 'interstitial', options.timeoutMs) : null,
    banner: options.banner && api.createBannerAd ? new WechatBanner(api as Pick<Required<WxAdsApi>, 'createBannerAd'>, options.banner, tree) : null,
  }
}
