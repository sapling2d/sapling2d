// 小游戏入口：依次跑三个阶段，每 5 秒一行 [perf]，每阶段中点 snapshot（需要构建时设置 SAPLING_LOG_URL）。
import { snapshot, startGame } from 'sapling2d/wechat'
import { gameOptions, runPhases } from './game'

void startGame({ ...gameOptions, background: 0x000000 }).then((game) => {
  const info = wx.getSystemInfoSync() as unknown as Record<string, unknown>
  console.log(`[clip] start ${info.brand} ${info.model} · ${info.system} · ${info.platform} · SDK ${info.SDKVersion} · screen ${JSON.stringify(game.tree.viewport.screen)}`)
  return runPhases(game, { snapshot, log: (line) => console.log(line) })
})
