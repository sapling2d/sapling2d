# 02 — 小游戏生产者：激励视频、插屏、Banner

**What to build:** `src/plugins/ads/wechat.ts`：实现 01 的 `FullscreenAd` / `AdBanner` 接口，`kind === 'wechat'` 且配了对应 id 时启用；没配 id 的类型仍走 mock（`console.info` 一次）。规格见 `../spec.md`"小游戏实现"一节。

- 结构类型 `WxAdsApi` / `WxFullscreenAd` / `WxBannerAd`：`createRewardedVideoAd` / `createInterstitialAd` / `createBannerAd` 及返回对象的 `load` / `show` / `hide` / `destroy` / `onLoad` / `onError` / `onClose` / `onResize` / `style`。不改 `wx.d.ts`。
- 激励视频：安装时 create + `load()` 预加载，`onLoad` → `ready = true`；`show()` 被拒 → `load().then(show)` 再试一次；`onClose(res)`：`res?.isEnded !== false` → `rewarded`，否则 `skipped`；关闭后 `load()` 下一条；`onError` → 当前请求 `unavailable`、`ready = false`、同一 `errCode` 只 warn 一次（文案带错误码对照里的解释）；`timeoutMs` 超时 → `unavailable`（之后迟到的 onClose 忽略）。
- 插屏：同上，`onClose` → `shown`；`show()` 被拒（频控）→ `unavailable`，warn 一次。
- Banner：`style = { left: (W - width) / 2, top: H - width × 0.27, width: max(300, W) }`；`onResize` → 贴安全区底部、`height` 换算成设计像素（÷ `viewport.scale`）、显示中才发 `resized`；`viewport.resized` 时重算 `style`；`show()` 失败 warn 一次返回 false；`hide()` 不销毁。
- API 不存在（旧基础库）→ 该类型视为没配 id → mock。
- 暂停 / 静音、并发保护都在 01 的 `Ads` 里，生产者只管平台调用。

**Blocked by:** 01

**Status:** done（2026-10-20）

- [x] `test/ads-wechat.test.ts`（11 个），假 `wx`：
  - [x] 安装即 create + load；`onLoad` 后 `ready` 为 true
  - [x] 已加载直接 show；show 被拒后 load 再 show 一次，还失败 → `unavailable` 并警告一次；`onClose({ isEnded: true })` → `'rewarded'`，`{ isEnded: false }` → `'skipped'`，`undefined` → `'rewarded'`；关闭后自动 load 下一条
  - [x] `onError({ errCode: 1004 })` → 当前请求 `'unavailable'`，`ready` 为 false，同样的错不再 warn，不同的错各 warn 一次，文案带 `(无合适的广告)`
  - [x] 超时（`timeoutMs: 20`，真定时器）→ `'unavailable'`，迟到的 `onClose` 不改变结果、不重复 resolve，再次 show 正常
  - [x] 插屏：`'shown'`；播放中再 show → `'unavailable'`；`dispose` 结束等待中的请求并 `destroy`
  - [x] banner：`style` 按 750×1334 算；`onResize` 后贴底、`height` 为设计像素、`resized` 只在显示中发；`hide()` 不 `destroy`；280 宽的屏幕宽度取 300 并居中；`setScreen` 后 `style` 重算；show 失败 → false 且只 warn 一次
  - [x] 只配了 `rewarded`：插屏和 banner 走 mock，`isMock` 为 false，`console.info` 一次；三种都配 → 不提示；旧基础库（api 为 `{}`）→ 全 mock；浏览器 / 无头（`wx` 为 undefined）不提示
  - [x] 整条链路：真激励视频通过 `Ads` 播放时暂停 / 静音，关闭后恢复
- [x] `pnpm check` 绿

## Comments

**实现（2026-10-20）：**

- `ads()` 的接线抽成 `_createProviders(tree, host, options, wx)`（@internal 导出）：`kind === 'wechat'` 时传 `globalThis.wx`，测试传假对象。`isMock` = 三种都是 mock。
- **超时用 `globalThis.setTimeout`**（结构类型），不用 `tree.createTimer`：原生广告在播时 rAF 可能停，树上的计时器不走。
- 迟到的回调靠 `_request` 对象：`onClose` / `onError` / 超时 / `dispose` 谁先到谁 resolve，之后的 `_settle` 直接返回。
- `WechatBanner.height` 在不可见或还没 `onResize` 时为 0；`resized` 在 `show()` 成功且已知高度、`onResize`（显示中）、`hide()`（发 0）时发。
- banner 的位置用 `screen.safeArea.bottom` 贴底（有底部安全区的机型会抬高）。
