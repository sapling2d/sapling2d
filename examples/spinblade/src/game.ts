import { key, pointerPress } from 'sapling2d'
import { ads } from 'sapling2d/ads'
import { touch } from 'sapling2d-touch'
import { Arena } from './scenes/Arena'

declare module 'sapling2d' {
  interface ActionRegistry {
    left: true
    right: true
    up: true
    down: true
    confirm: true
  }
}

/**
 * 浏览器和小游戏共用的启动参数：竖屏 750×1334（默认）。
 * 广告位 id 从构建环境变量读（`VITE_AD_REWARDED` 等）：没配就是 mock——浏览器里弹模拟覆盖层，测试里（`MODE === 'test'`）直接当作没广告，
 * 要测广告流程的用例自己传 `ads({ mock: 'rewarded' })`。
 */
export const gameOptions = {
  main: Arena,
  background: 0x2b2420,
  plugins: [
    touch(),
    ads({
      rewarded: import.meta.env.VITE_AD_REWARDED as string | undefined,
      interstitial: import.meta.env.VITE_AD_INTERSTITIAL as string | undefined,
      banner: import.meta.env.VITE_AD_BANNER as string | undefined,
      mock: import.meta.env.MODE === 'test' ? 'unavailable' : 'ui',
    }),
  ],
  actions: {
    left: [key('ArrowLeft'), key('KeyA')],
    right: [key('ArrowRight'), key('KeyD')],
    up: [key('ArrowUp'), key('KeyW')],
    down: [key('ArrowDown'), key('KeyS')],
    /** 结果画面：点屏幕或按空格再来一局。 */
    confirm: [pointerPress(), key('Space'), key('Enter')],
  },
}
