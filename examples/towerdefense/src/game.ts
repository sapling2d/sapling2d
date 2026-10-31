import { key, pointerPress } from 'sapling2d'
import { ui } from '@sapling2d/ui'
import { Battle } from './scenes/Battle'

declare module 'sapling2d' {
  interface ActionRegistry {
    confirm: true
  }
}

/** 浏览器和小游戏共用的启动参数：竖屏 750×1334（默认）。 */
export const gameOptions = {
  main: Battle,
  background: 0x1c2620,
  plugins: [ui()], // 升级卡片是 @sapling2d/ui 的 Button：预加载默认皮肤
  actions: {
    /** 失败后点屏幕或按空格重来。 */
    confirm: [pointerPress(), key('Space'), key('Enter')],
  },
}
