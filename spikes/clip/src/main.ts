// 浏览器入口：?hold=correct|masked|plain 停在某个阶段（截图用），否则依次跑完三个阶段；?camera=1 在 correct 阶段加一个平移的相机。
import { startGame } from 'sapling2d/browser'
import { CorrectScene, gameOptions, runPhases, type Phase } from './game'

const params = new URLSearchParams(location.search)
const hold = (params.get('hold') as Phase | null) ?? null
CorrectScene.camera = params.get('camera') === '1'

startGame({ ...gameOptions, background: 0x000000 }).then((game) => {
  Object.assign(globalThis, { sapling: game })
  return runPhases(game, { hold, snapshot: () => {}, log: (line) => console.log(line) })
})
