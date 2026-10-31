import { snapshot, startGame } from 'sapling2d/wechat'
import { gameOptions, type Main } from './game'

// 小游戏构建是 CommonJS，不能用顶层 await
void startGame(gameOptions).then((game) => {
  // 每 5 秒打印一次帧耗时（构建时设置 SAPLING_LOG_URL 就能在电脑上看到真机的数字）
  let phase = '1 boy'
  const perf = () => {
    const s = game.frameStats
    if (s.frames === 0) return
    const f = (x: number) => x.toFixed(2)
    console.log(`[perf ${phase}] fps ${s.fps.toFixed(1)} interval max ${f(s.intervalMax)} | logic ${f(s.logicAvg)} max ${f(s.logicMax)} | render ${f(s.renderAvg)} max ${f(s.renderMax)} ms`)
    game.resetFrameStats()
  }
  setInterval(perf, 5000)
  // 真机 / 模拟器验证：5 秒时截一张（站着的 spineboy），15 秒时再加 9 个跑步的（压力），21 秒再截一张
  setTimeout(() => snapshot('idle'), 5000)
  setTimeout(() => {
    ;(game.scene as Main).addBenchBoys(9)
    phase = '10 boys'
    game.resetFrameStats()
    console.log('[bench] 10 spineboys on screen')
  }, 15000)
  setTimeout(() => snapshot('bench'), 21000)
})
