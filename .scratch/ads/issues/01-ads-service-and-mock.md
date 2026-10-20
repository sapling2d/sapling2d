# 01 — `sapling2d/ads`：服务、mock 覆盖层、暂停 / 静音、`PluginContext.autoload`

**What to build:** 插件的平台无关部分：`Ads` 服务和三态 API、场景树里画的 mock、播放期间的暂停 / 静音，以及核心的 `PluginContext.autoload`。做完这张，浏览器和无头测试里整个广告流程就能跑。规格见 `../spec.md`。

- 核心：`PluginContext.autoload<T extends Node>(cls: NodeClass<T>): T`，包一层 `tree._addAutoload`（`Game.create` 里插件安装在加载页之前，满足"第一个场景之前"的约束）。
- 新入口 `sapling2d/ads`（`package.json` 的 `exports` / `publishConfig.exports`、tsdown 入口）：`src/plugins/ads/index.ts`（`ads()`、`Ads`、类型）、`mock.ts`（覆盖层和 banner 条）、`provider.ts`（`FullscreenAd` / `AdBanner` 接口：02 的小游戏实现和这里的 mock 实现同一个接口）。
- `Ads`：`isMock`、`ready`、`showRewarded` / `showInterstitial`（同时只允许一个：播放中再调用返回 `unavailable`）、`banner`。`pauseGame`（默认 true）：记下 `tree.paused` 和 `audio.isBusMuted('Master')`，播放中暂停 + 静音，关闭后恢复再 resolve。
- mock：`AdHost extends CanvasLayer`（`layer: 1000`、`processMode: 'always'`）由插件 `autoload`；`mock: 'ui'` 弹覆盖层（遮罩吞点击、面板、两个按钮，坐标按 spec，导出 `MOCK_LAYOUT`）；`'rewarded' | 'skipped' | 'unavailable'` 直接返回；banner mock 是底部一条 + "广告"（导出 `MOCK_BANNER_RATIO`）。
- 非 wechat 平台一律 mock；wechat 的接法留给 02（这张工单里 `kind === 'wechat'` 也先走 mock，02 再换）。

**Blocked by:** None — can start immediately

**Status:** done（2026-10-20）

- [x] `createTestGame({ plugins: [ads({ mock: 'rewarded' })] })`：`showRewarded()` 直接返回 `'rewarded'`；`'skipped'` / `'unavailable'` 同理；`ready.rewarded` 在 `'unavailable'` 时为 false，其余 true；`isMock` 为 true
- [x] `mock: 'ui'`（默认）：调用后 `dump()` 里有 `Ads (AdHost)`、`AdMock`、`Finish`、`Close`；`g.tap` 看完按钮 → `'rewarded'`，关闭按钮 → `'skipped'`；点遮罩别处没反应、下面场景的可点击节点收不到；覆盖层在结果返回后移除
- [x] 插屏 mock：一个关闭按钮 → `'shown'`
- [x] 暂停 / 静音：播放中 `tree.paused === true`、`audio.isBusMuted('Master') === true`，节点的 `process` 不跑；关闭后两者恢复；本来就暂停 / 静音的游戏关闭后仍然暂停 / 静音；`pauseGame: false` 时都不动
- [x] 播放中再次 `showRewarded()` / `showInterstitial()` 立即返回 `'unavailable'`，不弹第二层；结束后又能播
- [x] banner：`show()` 返回 true，`visible`、`height === 203`（750×1334、DPR 1：round(0.27 × 750)），`resized` 发一次；`hide()` 后 `height` 为 0 并发 `resized(0)`；重复 `show()` 幂等；402×874 / DPR 3 的屏幕按缩放换算
- [x] `PluginContext.autoload`：插件注册的节点在 `tree` 里排在游戏 `autoloads` 之前；`changeScene` 之后还在；`tree.autoload(Cls)` 能取到；覆盖层在切场景后仍在
- [x] 每帧热路径不分配：没有广告在播时插件没有每帧代码
- [x] `pnpm check` 绿；`pnpm --filter sapling2d build` 产出 `dist/ads.js` / `ads.d.ts`

## Comments

**实现（2026-10-20）：** `test/ads.test.ts` 12 个用例，`test/plugins.test.ts` 加 1 个（`ctx.autoload`）。和 spec 的几处出入：

- **直接返回的 mock 不是"下一帧"而是立即 resolve**（`Promise.resolve`）：测试和游戏写 `await ads.showRewarded()` 就够，不用夹一个 `step()`。
- **`AdBanner` 是接口不是类**：mock 和 02 的小游戏实现各自实现它，游戏只通过 `tree.get(Ads).banner` 用；对外差别为零。
- `Ads.ready` 是一个带 getter 的对象（构造时建一次），不是每次访问新建。
- 覆盖层的所有子节点坐标相对遮罩（遮罩原点在可见区域左上角），`MOCK_LAYOUT` 里的偏移以可见区域中心为准，测试直接用它算 `g.tap` 的点。
- `game.destroy()` 卸载插件时 `dispose` 掉还在的覆盖层和 banner。
- 02 要做的接口已经留好：`FullscreenAd { ready; show(); dispose() }`、`AdBanner { show(); hide(); visible; height; resized; dispose() }`；`ads()` 里按 `kind === 'wechat'` 和 id 有无换成小游戏实现，`isMock` 改为"三种都是 mock 才算"。
