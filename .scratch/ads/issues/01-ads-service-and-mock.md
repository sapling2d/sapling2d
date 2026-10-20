# 01 — `sapling2d/ads`：服务、mock 覆盖层、暂停 / 静音、`PluginContext.autoload`

**What to build:** 插件的平台无关部分：`Ads` 服务和三态 API、场景树里画的 mock、播放期间的暂停 / 静音，以及核心的 `PluginContext.autoload`。做完这张，浏览器和无头测试里整个广告流程就能跑。规格见 `../spec.md`。

- 核心：`PluginContext.autoload<T extends Node>(cls: NodeClass<T>): T`，包一层 `tree._addAutoload`（`Game.create` 里插件安装在加载页之前，满足"第一个场景之前"的约束）。
- 新入口 `sapling2d/ads`（`package.json` 的 `exports` / `publishConfig.exports`、tsdown 入口）：`src/plugins/ads/index.ts`（`ads()`、`Ads`、`AdBanner`、类型）、`mock.ts`（覆盖层和 banner 条）、`provider.ts`（生产者接口：`AdProvider { showRewarded(): Promise<RewardedResult>; showInterstitial(): Promise<InterstitialResult>; banner: { show(): Promise<boolean>; hide(): void; … } }`，02 的小游戏实现和这里的 mock 实现同一个接口）。
- `Ads`：`isMock`、`ready`、`showRewarded` / `showInterstitial`（同时只允许一个：播放中再调用返回 `unavailable`）、`banner`。`pauseGame`（默认 true）：记下 `tree.paused` 和 `audio.isBusMuted('Master')`，播放中暂停 + 静音，关闭后恢复再 resolve。
- mock：`AdHost extends CanvasLayer`（`layer: 1000`、`processMode: 'always'`）由插件 `autoload`；`mock: 'ui'` 弹覆盖层（遮罩吞点击、面板、两个按钮，坐标按 spec）；`'rewarded' | 'skipped' | 'unavailable'` 下一帧直接返回；banner mock 是底部一条 + "广告"。
- 非 wechat 平台一律 mock；wechat 的接法留给 02（这张工单里 `kind === 'wechat'` 也先走 mock，02 再换）。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `createTestGame({ plugins: [ads({ mock: 'rewarded' })] })`：`showRewarded()` 下一帧返回 `'rewarded'`；`'skipped'` / `'unavailable'` 同理；`ready.rewarded` 在 `'unavailable'` 时为 false，其余 true；`isMock` 为 true
- [ ] `mock: 'ui'`（默认）：调用后 `dump()` 里有 `Ads` 层和两个按钮；`g.tap` 看完按钮 → `'rewarded'`，关闭按钮 → `'skipped'`；点遮罩别处没反应、下面场景的可点击节点收不到；覆盖层在结果返回后移除
- [ ] 插屏 mock：一个关闭按钮 → `'shown'`
- [ ] 暂停 / 静音：播放中 `tree.paused === true`、`audio.isBusMuted('Master') === true`，节点的 `process` 不跑；关闭后两者恢复；本来就暂停 / 静音的游戏关闭后仍然暂停 / 静音；`pauseGame: false` 时都不动
- [ ] 播放中再次 `showRewarded()` / `showInterstitial()` 立即返回 `'unavailable'`，不弹第二层
- [ ] banner：`show()` 返回 true，`visible`、`height > 0`（0.27 × 屏幕宽换算成设计像素，用默认 750×1334 屏幕算出具体数字写进断言），`resized` 发一次；`hide()` 后 `height` 为 0；重复 `show()` 幂等
- [ ] `PluginContext.autoload`：插件注册的节点在 `tree` 里排在游戏 `autoloads` 之前；`changeScene` 之后还在；`tree.autoload(Cls)` 能取到
- [ ] 每帧热路径不分配：没有广告在播时插件没有每帧代码
- [ ] `pnpm check` 绿；`pnpm --filter sapling2d build` 产出 `dist/ads.js` / `ads.d.ts`

**实现提示**

- 覆盖层按钮用 `inputPickable` 的 `ColorRect` + `clicked` 信号，不依赖 `sapling2d-touch`（引擎包不能依赖外部包）。遮罩本身也 `inputPickable: true`，让指针被它捕获而不落到下面的节点。
- `tree.paused` 期间 `pausable` 节点收不到指针：宿主 `processMode: 'always'`，子节点继承。
- 结果 resolve 放在恢复暂停 / 静音之后、覆盖层 `queueFree` 之后；无头测试里 `await` 之后再 `step()` 一帧才看得到节点消失（`queueFree` 帧末执行），断言时注意。
- `Ads` 的方法内部都 `try/catch`：mock 也可能因为树状态异常抛错，一律变成 `unavailable` + warn。
