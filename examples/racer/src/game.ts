import { key } from 'sapling2d'
import { motion, tilt } from 'sapling2d/motion'
import { Road } from './scenes/Road'

declare module 'sapling2d' {
  interface ActionRegistry {
    steerLeft: true
    steerRight: true
  }
}

/** 浏览器和小游戏共用的启动参数：竖屏 750×1334（默认）。倾斜和键盘共用两个转向动作。 */
export const gameOptions = {
  main: Road,
  background: 0x3a7d2c,
  plugins: [motion()],
  actions: {
    steerLeft: [key('ArrowLeft'), key('KeyA'), tilt('left')],
    steerRight: [key('ArrowRight'), key('KeyD'), tilt('right')],
  },
}
