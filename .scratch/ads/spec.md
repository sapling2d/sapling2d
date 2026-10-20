# Spec: 广告插件 `sapling2d/ads`（小游戏流量主优先，浏览器 mock）

Status: ready-for-agent
Date: 2026-10-20
ADR: docs/adr/0010-plugins.md（插件规则）、docs/adr/0011-plugin-assets.md（资源，这里用不上）

小游戏流量主的三种广告——激励视频、插屏、Banner——做成一个插件。小游戏上是真的；浏览器、无头、以及小游戏没配广告位 id 时是场景树里画出来的 mock，游戏流程在三端都跑得通、测得了。

## 原则（ADR 0010 的三条，落到广告上）

- 核心零改动，只加一个 `PluginContext.autoload(cls)`（插件需要一个跨场景存活的节点放 mock 覆盖层和 banner 条）。
- 平台差异全在 `src/plugins/ads/` 里：`kind === 'wechat'` 且配了 id → 真广告；其余 → mock。`wx.createRewardedVideoAd` 等不进 `wx.d.ts`，插件自己声明用到的结构（避免把 `wx` 全局带进核心类型检查，见 plugin-assets/01 的教训）。
- 广告永远不让游戏崩：任何失败 `console.warn` 一次（带 `errCode`）并返回 `unavailable`；没配 id 走 mock 并 `console.info` 一次（避免上线忘配）。

## 游戏侧 API

```ts
import { ads, Ads, type RewardedResult } from 'sapling2d/ads'

startGame({ main, plugins: [ads({ rewarded: 'adunit-xxx', interstitial: 'adunit-yyy', banner: 'adunit-zzz' })] })

const result = await this.tree.get(Ads).showRewarded()   // 'rewarded' | 'skipped' | 'unavailable'
if (result === 'rewarded') this.revive()                   // 只有 'rewarded' 给奖励

await this.tree.get(Ads).showInterstitial()              // 'shown' | 'unavailable'

const banner = this.tree.get(Ads).banner
await banner.show()                                      // true 显示了；false 没配 id / 出错
banner.hide()
banner.height                                            // 设计像素；没显示时 0。布局用
banner.resized                                           // Signal<[height]>：真机上加载后才知道高度
```

```ts
export interface AdsOptions {
  rewarded?: string       // 激励视频广告位 id
  interstitial?: string   // 插屏广告位 id
  banner?: string         // Banner 广告位 id
  /** 激励视频 / 插屏播放期间 `tree.paused = true` 并静音 `Master` 总线，结束后恢复之前的状态。默认 true。 */
  pauseGame?: boolean
  /** mock 的行为：'ui'（默认，场景树里弹模拟覆盖层）| 'rewarded' | 'skipped' | 'unavailable'（直接返回，不弹；测试用）。 */
  mock?: 'ui' | 'rewarded' | 'skipped' | 'unavailable'
  /** 激励视频 / 插屏从请求到能播的等待上限（毫秒），超时算 unavailable。默认 15000。 */
  timeoutMs?: number
}

export type RewardedResult = 'rewarded' | 'skipped' | 'unavailable'
export type InterstitialResult = 'shown' | 'unavailable'

export class Ads {
  /** 当前是不是 mock（浏览器 / 无头 / 小游戏没配 id）。 */
  readonly isMock: boolean
  /** 预加载好、随时能播：用来决定要不要显示“看视频复活”按钮。mock 下按 `mock` 选项（'unavailable' 时 false）。 */
  readonly ready: { readonly rewarded: boolean; readonly interstitial: boolean }
  showRewarded(): Promise<RewardedResult>
  showInterstitial(): Promise<InterstitialResult>
  readonly banner: AdBanner
}

export class AdBanner {
  show(): Promise<boolean>
  hide(): void
  readonly visible: boolean
  readonly height: number
  readonly resized: Signal<[height: number]>
}
```

- 返回值是三态字符串：`unavailable`（没广告 / 频控 / 没配 id / 出错）和 `skipped`（用户中途关了）游戏通常走不同的路。
- 同一时间只允许一个全屏广告：播放中再次调用 `showRewarded` / `showInterstitial` 直接返回 `unavailable`（不重复发奖励）。
- `pauseGame`：`show` 之前记下 `tree.paused` 和 `audio.isBusMuted('Master')`，设为暂停 + 静音；关闭后恢复，然后才 resolve——`await` 之后的游戏代码看到的是正常运行的树。mock 覆盖层的节点 `processMode: 'always'`，暂停时也能点。
- 小游戏的激励视频是原生全屏，是否触发 `wx.onHide` 官方没有说明（未验证，见 spikes/wechat-ads/RESEARCH.md），游戏逻辑会在底下继续跑：所以暂停由插件自己做，不依赖 `focusChanged`（真机核对一下是否触发，04）。

## 核心新增

```ts
interface PluginContext {
  …
  /** 注册一个 Autoload（和启动参数 `autoloads` 一样的全局单例节点），在游戏的 Autoload 之前进树。插件放跨场景存活的节点用。 */
  autoload<T extends Node>(cls: NodeClass<T>): T
}
```

包一层 `tree._addAutoload`。插件安装在加载页之前，所以满足“第一个场景之前注册”的约束。

## 小游戏实现

- **激励视频**：安装时 `wx.createRewardedVideoAd({ adUnitId })`（每个 id 单例）并 `load()` 预加载；`onLoad` → `ready.rewarded = true`。`showRewarded()`：`show()`，被拒就 `load().then(show)` 再试一次，还失败 → `unavailable`。`onClose(res)`：`res?.isEnded !== false`（老基础库 `res` 为 undefined 也算看完）→ `rewarded`，否则 `skipped`；关闭后立刻 `load()` 下一条。`onError({ errCode, errMsg })` → 当前请求 `unavailable`，`ready = false`，同一个 `errCode` 只 warn 一次。`timeoutMs` 兜底。
- **插屏**：`wx.createInterstitialAd`，同样预加载；`show()` 常因频控被拒 → `unavailable`（warn 一次）。`onClose` → `shown`。
- **Banner**：`wx.createBannerAd({ adUnitId, style: { left, top, width } })`，`width = clamp(screen.width, 300, screen.width)`，`top` 先按估算（`width × 0.27`）贴底，`onResize({ width, height })` 后 `style.top = screen.height - height - 安全区下边距`、`style.left = (screen.width - width) / 2`，`height`（设计像素 = 屏幕像素 ÷ `viewport.scale`）更新并发 `resized`。`viewport.resized` 时重算位置。`show()` 失败 warn 一次返回 false。`hide()` 不销毁（再 `show()` 不重新加载）。
- 基础库：激励视频 / Banner ≥ 2.0.4，插屏 ≥ 2.6.0（引擎要求 ≥ 2.25）。API 不存在时视为没配 id → mock。
- 错误码对照（写进 warn 文案和文档）：1000 后端错误、1001 参数错误、1002 广告单元无效、1003 内部错误、1004 无合适广告、1005 广告组件审核中、1006 广告组件被驳回、1007 广告组件被封禁、1008 广告单元已关闭；插屏 `show()` 另有 2001 启动后太快、2002 离上一次插屏 / 激励视频太近、2003 正在播别的广告、2004 渲染失败、2005 跨页面使用实例。激励视频创建时传 `disableFallbackSharePage: true`（基础库 3.7.7 起 1004 默认弹分享页、走 `onLoad({ useFallbackSharePage: true })` 而不是 `onError`，关闭后 `isEnded` 未定义）。

## Mock（浏览器、无头、小游戏没配 id）

不用 DOM，用场景树画，三端一份代码：

- 宿主：插件 `autoload` 一个 `AdHost extends CanvasLayer`（`layer: 1000`、`processMode: 'always'`、`name: 'Ads'`），覆盖层和 banner 条都挂在它下面。
- `mock: 'ui'` 的激励视频：半透明黑 `ColorRect` 遮罩（铺满 `visibleRect`）+ 面板 + `Label`（"模拟激励视频" / "模拟插屏广告"）+ 两个可点区域（`inputPickable` 的 `ColorRect`，带 `Label`）：**看完 ✓** → `rewarded`，**关闭 ✗** → `skipped`；插屏只有一个 **关闭** → `shown`。位置以 `visibleRect` 中心为准：面板 500×320，两个按钮 200×90，分别在中心偏下 120、左右各偏 130——无头测试按这个坐标 `g.tap`。遮罩吞掉其它点击（`inputPickable`，不发信号）。
- `mock: 'rewarded' | 'skipped' | 'unavailable'`：不弹 UI，下一帧直接返回；测试默认这么用。
- Banner mock：底部一条 `ColorRect`（宽 = 可见区域宽，高 = 0.27 × 屏幕宽换算成设计像素，颜色 0x222222、alpha 0.85）+ 居中 `Label` "广告"。`height` 真实返回，`resized` 在 `show()` 时发一次——结果页的布局在浏览器里就能调。
- `isMock = true`；小游戏没配 id 时 `console.info` 一次。
- 文案是中文（目标用户是小游戏）；不做本地化。

## 测试

- 无头（`test/ads.test.ts`）：三态返回；`mock` 四种模式；覆盖层两个按钮和遮罩吞点击；暂停 / 静音的进入和恢复（包括本来就暂停 / 静音时不乱恢复）；播放中再调用返回 `unavailable`；`ready` 的值；banner `show` / `hide` / `height` / `resized`；`PluginContext.autoload` 的节点在游戏 Autoload 之前、切场景后还在。
- 小游戏生产者（`test/ads-wechat.test.ts`）：假 `wx`（`createRewardedVideoAd` 等返回可手动触发 `onLoad` / `onError` / `onClose` 的假对象）：预加载；未加载先 load 再 show；`isEnded` 两种和 `undefined`；错误 → `unavailable` 且同一 errCode 只 warn 一次；超时；关闭后重新 load；插屏 show 被拒；banner `style` 计算、`onResize` → `height` / `resized`、`hide` 不销毁。
- 官方没有测试用的广告位 id，也没有开发者工具的模拟广告开关（spikes/wechat-ads/RESEARCH.md）；随便编的 id 预加载就收到 `error 1002 广告单元无效`（实测）。真实生产者的成功路径要开通流量主（任一：累计 UV > 500 且无违规；游戏圈活跃 + 5 条官方帖；同主体其他小程序已有流量主满一季度）、自建广告位后在开发版 / 体验版里验，不阻塞发布；错误路径（1002 → 全部 `unavailable`、按钮不显示、游戏照常）在模拟器里已验。mock 流程在模拟器里也已验（不配 id）。在有 id 之前 `pauseGame` 保持默认开（无论 `wx.onHide` 触不触发都不冲突）。

## 验证载体

`examples/spinblade` 的 `Result` 画面：失败时"看视频复活"（`rewarded` → 重开本关并带奖励，具体奖励由实现者读 Arena 后选最小改动，比如多带几把刀），通关时"看视频双倍"（分数翻倍显示）；进入 Result 时放一次插屏；Result 底部 banner，离开时 `hide()`。浏览器里全是 mock，照样能点通。hero-guard 等 spec 定稿后在它那边接。

## 顺序

每步 `pnpm check` 绿。

1. 01 `sapling2d/ads` 服务 + mock + 暂停 / 静音 + `PluginContext.autoload`
2. 02 小游戏生产者（激励视频 / 插屏 / Banner）
3. 03 spinblade Result 接入 + 文档（llms、CONTEXT、README 入口表）
4. 04 模拟器验证；真机部分 blocked（没有广告位 id）

## 不在范围内

原生模板广告（`createCustomAd`）、格子广告；`Ads` 上的埋点信号（`shown` / `failed`）——返回值够用，有需要再加；浏览器的真实广告网络；多语言文案；一个 id 多实例（`multiton`）。

## 后记（2026-10-20）

插件已从引擎的子入口 `sapling2d/ads` 拆成独立包 `@sapling2d/ads`（`packages/ads`，只依赖 `sapling2d` 的公开 API）；`sapling2d-touch` 同时改名 `@sapling2d/touch`，资源前缀 `~@sapling2d/touch/`。本文和工单里的 `sapling2d/ads` 指的都是它。
