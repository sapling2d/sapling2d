# @sapling2d/ads

Ads for [sapling2d](https://github.com/kwoktung/sapling2d): WeChat Mini Game rewarded video, interstitial and banner (流量主), installed as a plugin. In the browser, in headless tests, and on WeChat for ad types without an ad unit id, it draws a mock in the scene tree, so the flow runs everywhere.

```sh
npm install @sapling2d/ads
```

```ts
import { ads, Ads } from '@sapling2d/ads'

startGame({ main, plugins: [ads({ rewarded: 'adunit-…', interstitial: 'adunit-…', banner: 'adunit-…' })] })

const result = await this.tree.get(Ads).showRewarded() // 'rewarded' | 'skipped' | 'unavailable'
if (result === 'rewarded') this.revive()               // only 'rewarded' grants the reward
```

- Never throws: failures return `'unavailable'` and warn once with the 流量主 error-code meaning.
- One fullscreen ad at a time; the scene tree is paused and the `Master` bus muted while it shows (`pauseGame: false` to opt out).
- Tests: `ads({ mock: 'rewarded' })` returns without UI; the default `'ui'` mock can be tapped (`MOCK_LAYOUT`).
- Real ads need 流量主 and your own ad unit ids; made-up ids fail with 1002. See `spikes/wechat-ads/RESEARCH.md` in the repo.

Documented with a runnable example in the engine's [`llms.txt`](https://github.com/kwoktung/sapling2d/blob/main/packages/engine/llms.txt).
