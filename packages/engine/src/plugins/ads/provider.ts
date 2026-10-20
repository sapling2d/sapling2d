import type { Signal } from '../../core/Signal'

/** 激励视频的结果：只有 `rewarded` 该给奖励；`skipped` 是用户中途关了；`unavailable` 是没广告 / 频控 / 没配 id / 出错。 */
export type RewardedResult = 'rewarded' | 'skipped' | 'unavailable'

/** 插屏的结果。 */
export type InterstitialResult = 'shown' | 'unavailable'

/**
 * 一种全屏广告（激励视频或插屏）的实现：小游戏的真广告和 mock 都实现它。
 * `show()` 永远 resolve（出错也是 `unavailable`），暂停 / 静音和并发保护由 `Ads` 负责。
 */
export interface FullscreenAd {
  /** 已预加载好、随时能播。 */
  readonly ready: boolean
  show(): Promise<RewardedResult | InterstitialResult>
  dispose(): void
}

/**
 * Banner：底部一条。`height` 是设计像素（没显示时 0），真机上加载后才知道、通过 `resized` 通知；布局用它。
 */
export interface AdBanner {
  /** 显示；成功 true，没配 id / 出错 false（出错会 warn 一次）。重复调用幂等。 */
  show(): Promise<boolean>
  /** 隐藏（不销毁，再 `show()` 不重新加载）。 */
  hide(): void
  readonly visible: boolean
  readonly height: number
  readonly resized: Signal<[height: number]>
  dispose(): void
}
