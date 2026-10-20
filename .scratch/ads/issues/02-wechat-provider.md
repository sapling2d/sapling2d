# 02 — 小游戏生产者：激励视频、插屏、Banner

**What to build:** `src/plugins/ads/wechat.ts`：实现 01 的 `AdProvider` 接口，`kind === 'wechat'` 且配了对应 id 时启用；没配 id 的类型仍走 mock（`console.info` 一次）。规格见 `../spec.md`"小游戏实现"一节。

- `WxLike` 结构类型：`createRewardedVideoAd` / `createInterstitialAd` / `createBannerAd` 及返回对象的 `load` / `show` / `hide` / `destroy` / `onLoad` / `onError` / `onClose` / `onResize` / `style`。不改 `wx.d.ts`。
- 激励视频：安装时 create + `load()` 预加载，`onLoad` → `ready.rewarded = true`；`show()` 被拒 → `load().then(show)` 再试一次；`onClose(res)`：`res?.isEnded !== false` → `rewarded`，否则 `skipped`；关闭后 `load()` 下一条；`onError` → 当前请求 `unavailable`、`ready = false`、同一 `errCode` 只 warn 一次（文案带错误码对照里的解释）；`timeoutMs` 超时 → `unavailable`（之后迟到的 onClose 忽略）。
- 插屏：同上，`onClose` → `shown`；`show()` 被拒（频控）→ `unavailable`，warn 一次。
- Banner：`style = { left: (W - width) / 2, top: H - 估算高度, width: clamp(W, 300, W) }`（`W` / `H` 来自 `tree.viewport.screen`）；`onResize` → 贴底（减去安全区下边距 `screen.height - screen.safeArea.bottom`）、`height` 换算成设计像素（÷ `viewport.scale`）、发 `resized`；`viewport.resized` 时重算 `style`；`show()` 失败 warn 一次返回 false；`hide()` 不销毁。
- API 不存在（旧基础库）→ 该类型视为没配 id → mock。
- 暂停 / 静音、并发保护都在 01 的 `Ads` 里，生产者只管平台调用。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `test/ads-wechat.test.ts`，假 `wx`（每个 create 返回可手动触发 `onLoad` / `onError` / `onClose` / `onResize` 的对象，记录 `load` / `show` / `hide` 调用）：
  - [ ] 安装即 create + load；`onLoad` 后 `ready.rewarded` 为 true
  - [ ] `showRewarded()`：已加载直接 show；show 被拒后 load 再 show 一次；`onClose({ isEnded: true })` → `'rewarded'`，`{ isEnded: false }` → `'skipped'`，`undefined` → `'rewarded'`；关闭后自动 load 下一条
  - [ ] `onError({ errCode: 1004 })` → 当前请求 `'unavailable'`，`ready` 为 false，再来一次同样的错不再 warn
  - [ ] 超时（用假时钟或很小的 `timeoutMs`）→ `'unavailable'`，之后的 `onClose` 不改变结果、不重复 resolve
  - [ ] 插屏：`show()` 被拒 → `'unavailable'`；正常 → `'shown'`
  - [ ] banner：`style` 的 `width` / `left` / `top` 按 750×1334、DPR 1 的屏幕算；`onResize({ height: 100 })` 后 `style.top` 贴底、`height` 为设计像素、`resized` 发一次；`hide()` 后 `visible` false 且没调 `destroy`；`viewport.resized` 后 `style` 重算
  - [ ] 只配了 `rewarded`：插屏和 banner 走 mock，`isMock` 为 false（有一个是真的就算真），`console.info` 各一次
- [ ] `pnpm check` 绿

**实现提示**

- 怎么把假 `wx` 喂进去：`createWechatAds(wx: WxLike, …)` 接收对象（和 `wechat/touch.ts` 的 `subscribeTouches(api, …)` 一样），`ads()` 在 `kind === 'wechat'` 时传 `globalThis.wx`。
- 迟到的回调：每次 show 一个请求对象，`onClose` / `onError` / 超时都先检查它是不是当前请求。
- 错误码对照写成一个 `Record<number, string>`，warn 文案 `[sapling2d] ads: rewarded video error 1004 (no suitable ad)`。
