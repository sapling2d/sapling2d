# 微信小游戏广告：一手资料核对（2026-10-20）

起因：测试号 AppID `wxb3bb93d33e62448a`（没开流量主）+ 随便填的 `adunit-test-*`，开发者工具模拟器里三种广告的 `onError` 都是 `{ errCode: 1002, errMsg: "no advertisement" }`。我们的文档写的是"开发者工具的模拟广告也要真的 id，随便填的 id 收到 1002"。这里逐条对官方文档核对。

来源分级：
- **官方文档**：developers.weixin.qq.com 的 minigame / miniprogram 文档页（2026-10-20 抓取）。
- **社区·官方账号**：开放社区里社区接口 `isOfficialUser: true` 的回答（页面上的"官方"标记）。社区页要登录才能看；内容是从 `https://developers.weixin.qq.com/community/ngi/doc/detail/<id>` 和 `.../ngi/comment/list/<id>` 读的，下面给的是普通帖子链接。
- **社区·运营昵称**：昵称是"小游戏运营专员 / 微信广告运营专员"，但接口返回 `isOfficialUser: false`。可能是官方员工，但没有官方标记，按半官方处理。
- **社区·普通用户**：只算旁证。

---

## 1. 模拟器、1002 和 "no advertisement"

### 官方文档能确认的

- 错误码由 `errCode` 区分，`errMsg` 只是文字说明。`onError` 回调的参数是 `{ errMsg: string, errCode: number }`，`errCode` 从基础库 2.2.2 起才有。来源：https://developers.weixin.qq.com/minigame/dev/api/ad/RewardedVideoAd.onError.html
- **1002 = 广告单元无效**。官方给的原因是"可能是拼写错误、或者误用了其他APP的广告ID"，处理方法是"请重新前往mp.weixin.qq.com确认广告位ID"。来源：同上，插屏和 Banner 的错误码页内容相同：https://developers.weixin.qq.com/minigame/dev/api/ad/InterstitialAd.onError.html 、https://developers.weixin.qq.com/minigame/dev/api/ad/BannerAd.onError.html
- 原因里写的是"其他APP的广告ID"，可见广告位 id 是绑定到某个 AppID 上校验的。广告位 id 来自"小程序管理后台的流量主模块新建"。来源：https://developers.weixin.qq.com/miniprogram/dev/component/ad.html （`unit-id` 属性说明）
- 官方文档**没有一页**讲开发者工具模拟器怎么展示广告：模拟器给不给广告、给什么样的、有没有测试广告位、有没有"模拟广告"开关，都没写。查过的页面：
  - 小游戏广告指南（激励 / 插屏 / Banner）：https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/rewarded-video-ad.html 、https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/interstitialAd-ad.html 、https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/banner-ad.html
  - 工具与真机的差异页（列了扫码、支付、转发等，没有广告）：https://developers.weixin.qq.com/miniprogram/dev/devtools/different.html
  - 测试号页（只讲怎么申请和建项目，没说哪些能力不可用）：https://developers.weixin.qq.com/miniprogram/dev/devtools/sandbox.html

### "no advertisement" 是 1002 还是 1004？

官方表格只按 `errCode` 列，**没有给每个码定 `errMsg`**。社区帖子里，不同错误码带的都是同一个 `errMsg: "no advertisement"`，所以它是通用文案，不能拿来判断是哪个码：
- 1002 + "no advertisement"（还带了 `errDetail: "广告单元无效，解决方案参考'…/component/ad.html'"`）：https://developers.weixin.qq.com/community/develop/doc/00022ed2e94ce04ac842a1feb66000 （社区·普通用户，2024）
- 1002 + "no advertisement"：https://developers.weixin.qq.com/community/develop/doc/000a4add854378f497e85d9b051c00 （2019；**社区·官方账号**的回答只贴了错误码文档链接）
- 1004 + "no advertisement"：https://developers.weixin.qq.com/community/develop/doc/0004ecd040cfa0fba9b9bcf7e5c800 （2020；**社区·官方账号**回复"系统会根据用户来推荐合适的广告，没有合适的广告则不会展示"）
- 1005 + "no advertisement"：https://developers.weixin.qq.com/community/develop/doc/000c8039834038a94d279d18156c00 （2018，社区·普通用户）

结论：我们看到的是 **1002**（广告单元无效），不是 1004。`errMsg` 本来就和 1004 一样，这不能说明它其实是"没有合适的广告"。

### 推断（没有一手资料直接证实）

- **1002 是怎么来的**：最直接的原因是 id 是编的，后台没有这个广告位。测试号又不能开流量主，所以它名下也不可能有真的广告位。两个条件分不开：这个 AppID 下拿不到任何能通过校验的 id。"用真 id 加测试号会怎样"不会出现：别的 AppID 的真 id 按官方说法同样是 1002（"误用了其他APP的广告ID"）。我们没测过"真 AppID + 真 id + 模拟器"，所以没法把两个因素拆开验证。
- **模拟器能不能展示广告**：官方文档没写。社区有用户说过"开发者工具ipad和电脑观看激励广告正常，广告组件正常已过审"：https://developers.weixin.qq.com/community/develop/doc/00020237cc85f833a99c38cf456000 （社区·普通用户，2021）。这说明 AppID 开了流量主、广告位真实存在时，工具里能拉到广告，但这条是旁证。**"开发者工具有一个'模拟广告'功能，任意 id 都能出模拟画面"这种说法没有找到任何来源。** 我们文档里"开发者工具的'模拟广告'"这个词本身就没有依据。
- 有一条相关的**社区·官方账号**回答，说的是小程序 `<ad>` 组件："暂无广告，具体指引查看小程序流量主功能"这个提示"只是在开发模式下会出现，方便开发者调试问题，上线后无广告的高度是0"：https://developers.weixin.qq.com/community/develop/doc/000ec27cfcc1e8574c278638c56000 （2018）。这说明开发版和线上版的广告表现本来就不同，但不是在讲小游戏模拟器。

---

## 2. 官方错误码表

### 激励视频 / 插屏 / Banner 的 onError（三页内容相同）

来源：https://developers.weixin.qq.com/minigame/dev/api/ad/RewardedVideoAd.onError.html （小程序 `<ad>` 组件页里也是同一张表：https://developers.weixin.qq.com/miniprogram/dev/component/ad.html ）

| 代码 | 异常情况 | 理由 | 解决方案 |
|---|---|---|---|
| 1000 | 后端错误调用失败（枚举里写作"后端接口调用失败"） | 该项错误不是开发者的异常情况 | 一般情况下忽略一段时间即可恢复。 |
| 1001 | 参数错误 | 使用方法错误 | 可以前往 developers.weixin.qq.com 确认具体教程 |
| 1002 | 广告单元无效 | 可能是拼写错误、或者误用了其他APP的广告ID | 请重新前往 mp.weixin.qq.com 确认广告位ID。 |
| 1003 | 内部错误 | 该项错误不是开发者的异常情况 | 一般情况下忽略一段时间即可恢复。 |
| 1004 | 无适合的广告（枚举里写作"无合适的广告"） | 广告不是每一次都会出现，这次没有出现可能是由于该用户不适合浏览广告 | 属于正常情况，且开发者需要针对这种情况做形态上的兼容。 |
| 1005 | 广告组件审核中 | 你的广告正在被审核，无法展现广告 | 请前往 mp.weixin.qq.com 确认审核状态，且开发者需要针对这种情况做形态上的兼容。 |
| 1006 | 广告组件被驳回 | 你的广告审核失败，无法展现广告 | 同上 |
| 1007 | 广告组件被封禁 | 你的广告能力已经被封禁，封禁期间无法展现广告 | 请前往 mp.weixin.qq.com 确认小程序广告封禁状态。 |
| 1008 | 广告单元已关闭 | 该广告位的广告能力已经被关闭 | 请前往 mp.weixin.qq.com 重新打开对应广告位的展现。 |

### 插屏 `show()` 被拒时的另一组错误码（2001–2005）

来源：https://developers.weixin.qq.com/minigame/dev/api/ad/InterstitialAd.show.html

| 代码 | 异常情况 | 理由 |
|---|---|---|
| 2001 | 触发频率限制 | 小程序启动一定时间内不允许展示插屏广告 |
| 2002 | 触发频率限制 | 距离小程序插屏广告或者激励视频广告上次播放时间间隔不足，不允许展示插屏广告 |
| 2003 | 触发频率限制 | 当前正在播放激励视频广告或者插屏广告，不允许再次展示插屏广告 |
| 2004 | 广告渲染失败 | 该项错误不是开发者的异常情况，或因小程序页面切换导致广告渲染失败 |
| 2005 | 广告调用异常 | 插屏广告实例不允许跨页面调用 |

社区·官方账号对 1004 的说明：系统按用户推荐广告，没有合适的就不展示：https://developers.weixin.qq.com/community/develop/doc/0004ecd040cfa0fba9b9bcf7e5c800 。社区·运营昵称的说明："在小程序/小游戏正式上线后，广告组件拉取广告时会受到广告内部策略控制……1004属于正常情况"：https://developers.weixin.qq.com/community/minigame/doc/0008044f4800306b2d4a45f365b400

---

## 3. 没开流量主时有没有官方的测试办法

### 官方文档能确认的

- **没有找到官方测试广告位 id、"模拟广告"开关或"广告调试"功能。** 第 1 节列的指南、API 页、工具差异页、测试号页都没提到。
- 广告位 id 只能在流量主后台新建：https://developers.weixin.qq.com/miniprogram/dev/component/ad.html

### 社区旁证（社区·普通用户）

- 有人问"未上线时有哪些测试 id 可以用"，用了一个现成的 id 收到 1002。回答都是"在自己流量主里创建广告位，用自己的 id，体验版就能拉到广告测试"，没有人给出公共测试 id：https://developers.weixin.qq.com/community/develop/doc/00022ed2e94ce04ac842a1feb66000
- "开发版、体验版能拉到广告，上线版报 1005（审核中）"：https://developers.weixin.qq.com/community/develop/doc/000c8039834038a94d279d18156c00 。说明开了流量主以后，开发版和体验版就能测，不用等广告位审核。

结论：开流量主之前，**真广告的成功路径没有官方测法**。只能测错误路径，或者用我们自己的 mock。

---

## 4. 小游戏开通流量主的条件

### 官方文档能确认的

来源：https://developers.weixin.qq.com/minigame/introduction/commercialization/ad/ （开发指南里同样内容：https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/ad.html ）。"满足以下任一条件"即可：

- **条件一**：小程序累计独立访客 (UV) **> 500**，无刷粉行为且未曾有严重违规记录。
- **条件二**：开通内置游戏圈并产生有效活跃（用户从小游戏内进入游戏圈产生消费 / 转评赞等行为），并发布官方帖 5 篇。
- **条件三**：同公司主体名下已有小程序，且它已开通流量主、从昨日开始持续 1 个季度有变现、历史没有流量主违规记录（主体迁移的，建议迁移完成 3 天后再开通）。
- 开通方法：mp.weixin.qq.com →"功能"→"流量主"。Q&A："流量主资格需要次日刷新，请于满足条件后次日再试"。

**我们写的"累计 1000 独立访客"已经过时**，现在是 UV > 500，另外还有两条不看 UV 的路径。

---

## 5. 其它相关点

### onClose 和 isEnded（官方文档能确认）

- `RewardedVideoAd.onClose` 的 `res.isEnded`："视频是否是在用户完整观看的情况下被关闭的"，基础库 2.1.0 起有。来源：https://developers.weixin.qq.com/minigame/dev/api/ad/RewardedVideoAd.onClose.html
- 低于 2.1.0 的基础库，关闭按钮要等视频播完才出现，`res` 是 `undefined`，可以当作看完了。官方示例写的是 `if (res && res.isEnded || res === undefined)` 发奖励。来源：https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/rewarded-video-ad.html 。我们的 `res?.isEnded !== false` 与它等价。
- 广告只能由用户点"关闭广告"关掉，开发者控制不了。关闭后组件会自动拉下一条广告。来源：同上。
- 自动拉取失败以后，`show()` 会一直被 reject，要手动 `load()` 重拉；拉取成功时 `load()` 直接 resolve，不会重新拉。来源：同上。
- 每个用户每天能看的激励视频次数有限，建议先判断拉取成功了再显示按钮。来源：同上。

### 1004 兜底分享页（官方文档能确认，我们还没处理）

- **基础库 ≥ 3.7.7**：拉取时遇到 1004，激励视频组件会**默认生成一个兜底分享页**，用户分享后可以拿奖励。这时**不会触发 `onError`**，而是触发 `onLoad(res)`，`res = { useFallbackSharePage: true }`。可以用 `wx.createRewardedVideoAd({ adUnitId, disableFallbackSharePage: true })` 按实例关掉；从兜底分享打开的启动 query 里带 `wxad_fallback_share=1`。来源：https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/rewarded-video-ad.html （"1004 兜底分享页"一节），参数表：https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createRewardedVideoAd.html
- 社区·运营昵称确认线上用户会看到这个分享页（"该功能是我们的兜底分享功能"）：https://developers.weixin.qq.com/community/develop/doc/000e0a21750040d4c65357ec466400
- 没查到的：兜底分享页关闭时 `onClose` 的 `isEnded` 取什么值。官方没写，要真机验证。

### 其它创建参数（官方文档能确认）

- `wx.createRewardedVideoAd` 从基础库 2.0.4 起支持，小游戏端是**全局单例**。`multiton`（多例模式）从 2.8.0 起有，默认 false。来源：https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createRewardedVideoAd.html
- `wx.createInterstitialAd` 从基础库 2.6.0 起支持，每次调用都返回新实例。`onClose` 没有参数。来源：https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createInterstitialAd.html 、https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/interstitialAd-ad.html

### Banner（官方文档能确认）

- **从基础库 3.5.5 开始，`wx.createBannerAd` 停止维护，官方建议改用 `wx.createCustomAd`（原生模板广告）。** 来源：https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createBannerAd.html 、https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/banner-ad.html
- `style.width` 最小 300，最大到屏幕宽度（逻辑像素，用 `wx.getSystemInfoSync()` 取）。小于 300 按 300，大于屏宽按屏宽，然后按标准比例等比缩放。真实尺寸从 `onResize` 或 `style.realWidth` / `realHeight` 取。来源：https://developers.weixin.qq.com/minigame/dev/api/ad/BannerAd.html 、https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/banner-ad.html
- 在 `onResize` 里改 width，而且每次都和上次缩放后的值不同，会让 `onResize` 一直触发、卡死。来源：同上（指南页）。
- `adIntervals` 是自动刷新间隔，单位秒，必须 ≥ 30；不传就不自动刷新。每个实例只拉一次广告，想换内容要新建实例、`destroy()` 旧的，不销毁会泄漏监听器。来源：同上。

### 插屏频率（官方文档能确认的部分）

- 官方只给了错误码（2001 启动后一定时间内不能展示、2002 距上次插屏或激励视频间隔不够、2003 正在播），**没有给具体秒数**。来源：https://developers.weixin.qq.com/minigame/dev/api/ad/InterstitialAd.show.html
- 每个用户每天能看的插屏次数也有限。来源：https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/interstitialAd-ad.html
- 网上流传的"启动后 30 秒 / 间隔 60 秒"是抖音小游戏的规则（https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/ad/interstitial-ad ），不是微信的。

### 激励视频会不会触发 wx.onHide（没查到）

- 官方广告文档和 API 页都**没提**广告播放和 `wx.onHide` / `wx.onShow` 的关系。社区里也没找到官方回答。spec 里"社区反馈不触发 `wx.onHide`"找不到一手来源，按待验证处理（04 的真机项）。插件自己暂停游戏的做法与结论无关，可以保留。

---

## 对 sapling2d 的影响

`packages/engine/docs/llms.template.md`（改完重新生成 `llms.txt`）：
1. 第 121 行"累计 1000 独立访客才能开通"→ 改为"累计 UV > 500，或开游戏圈 + 5 篇官方帖，或同主体已有变现中的流量主"（来源：minigame/introduction/commercialization/ad/）。
2. 第 121 行"开发者工具的'模拟广告'同样要真的 id——随便填的 id 会收到 error 1002" → 官方没有叫"模拟广告"的东西。建议改为："没有流量主就没有有效的广告位 id；随便填的 id（或别的 AppID 的 id）在开发者工具和真机上都是 `1002 广告单元无效`（`errMsg` 统一是 "no advertisement"，看 `errCode`）。成功路径要开通流量主后，用自己的 id 在开发版 / 体验版里测。"
3. 第 117 / 511 行的 banner：补一句"`wx.createBannerAd` 从基础库 3.5.5 起停止维护（官方建议 `createCustomAd`）"。实现里 `Math.max(300, screen.width)` 与官方的 300…屏宽规则一致，不用改。
4. 激励视频补一句：基础库 ≥ 3.7.7 遇到 1004 默认走兜底分享页，这时触发 `onLoad({ useFallbackSharePage: true })` 而不是 `onError`。插件要决定是传 `disableFallbackSharePage`，还是把它当作可以展示（这时 `ready.rewarded` 为 true，用户看到的是分享页）。

`.scratch/ads/`：
1. `spec.md` 第 109 行、`issues/04-simulator-and-device.md` 第 9 行："开发者工具的'模拟广告'也要真的 id"改成上面第 2 条的说法；"开通要累计 1000 独立访客"改为 UV > 500 等三条路径。第 17 行 1002 的观察本身没错（三种广告预加载都收到 1002）。
2. `spec.md` 第 72 行"社区反馈不触发 `wx.onHide`"标成"未证实，待真机"。
3. `spec.md` 第 92 行的错误码对照：1006 / 1007 / 1008 分别是"被驳回 / 被封禁 / 广告单元已关闭"，不要合并成"被封禁 / 关闭"。代码 `packages/engine/src/plugins/ads/wechat.ts` 的 `ERRORS` 表已经是对的，只有 spec 的文字要改。插屏 `show()` 被拒时再加上 2001–2005（频率限制等），插件 warn 文案里也要有。
4. 新的待办（spec / 02 issue）：`multiton` 和 `disableFallbackSharePage`（3.7.7）要不要暴露；兜底分享页关闭时 `isEnded` 的值要在真机上测；Banner 迁移到 `createCustomAd` 先记成后续项。
