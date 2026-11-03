# 广告（小游戏流量主）

`@sapling2d/ads` 接入微信小游戏流量主的激励视频、插屏和 Banner。浏览器和测试里是画在场景树里的 mock，开发时能看到完整流程。

<<< ../../packages/ads/docs/examples/ads.test.ts#example

<<< ../../packages/ads/docs/examples/ads.test.ts#test

## 安装

```ts
plugins: [ads({ rewarded, interstitial, banner })]
```

三个参数都是流量主后台的广告位 id，可以只配一部分。id 用构建环境变量传（如 `import.meta.env.VITE_AD_REWARDED`），不要写死在代码里；没有 id 时不传，走 mock。

## 接口

`this.tree.get(Ads)`：

| 成员 | 返回 / 说明 |
|---|---|
| `showRewarded()` | `'rewarded' \| 'skipped' \| 'unavailable'`，**只有 `'rewarded'` 给奖励** |
| `showInterstitial()` | `'shown' \| 'unavailable'` |
| `banner` | `show()` / `hide()` / `height`（设计像素，真机上加载后才知道）/ 信号 `resized` |
| `ready.rewarded` | 决定要不要显示"看广告"按钮 |
| `isMock` | 是否是 mock |

## 行为

- **失败不抛错**：返回 `'unavailable'`，控制台 warn 一次，附流量主错误码的解释。
- 同一时间只播一个全屏广告。播放中再调用返回 `'unavailable'`，不会重复发奖励。
- 播放期间默认暂停场景树（`tree.paused = true`）并静音 `Master` 总线，结束恢复后 Promise 才 resolve。所以 `await` 之后的代码在游戏恢复后才跑。`pauseGame: false` 可以关掉。

## mock

浏览器、无头测试，以及小游戏里没配 id 的广告类型，都是 mock：

- 激励视频和插屏弹出一个带"看完 / 关闭"按钮的覆盖层（暂停时也能点）；Banner 是底部一条。
- 测试里可以 `g.tap` 覆盖层的按钮（坐标见 `MOCK_LAYOUT`），或用 `ads({ mock: 'rewarded' })` 不弹界面直接出结果。
- 小游戏里没配 id 时控制台 info 一次。上线前检查日志里有没有 `[sapling2d] ads:`。

## 上线真广告

- 先开通流量主（满足任一条件即可：累计 UV > 500 且无违规；游戏圈活跃且发满 5 条官方帖；同主体其他小程序已有流量主并满一个季度收益），在后台自建广告位，在开发版 / 体验版里测试。
- 官方没有测试用的广告位 id。随便编的 id 或别的 AppID 的 id 会收到 `error 1002（广告单元无效）`，插件按 `unavailable` 降级：不弹广告、按钮不显示、游戏照常。
- 以 `errCode` 为准；errMsg（如 "no advertisement"）不对应具体错误码。
- 基础库 3.7.7 起，"无合适广告"时默认弹分享页兜底，插件关掉了它（`disableFallbackSharePage: true`），按 `unavailable` 处理。
- `createBannerAd` 从基础库 3.5.5 起官方不再维护，替代是 `createCustomAd`，之后会迁移。
