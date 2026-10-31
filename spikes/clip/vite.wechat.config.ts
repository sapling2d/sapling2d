// 裁剪 spike 的微信小游戏构建（真机看 stencil 裁剪是否正确、开销多大）。见 REPORT.md。
// WX_APPID=... SAPLING_LOG_URL=http://<局域网 IP>:7777/log \
//   pnpm --filter example-sprite exec vite build -c ../../spikes/clip/vite.wechat.config.ts
import { fileURLToPath } from 'node:url'
import { saplingWechat } from '../../packages/engine/src/vite/wechat.ts'

const engine = fileURLToPath(new URL('../../packages/engine', import.meta.url))

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: [
      { find: /^sapling2d$/, replacement: `${engine}/src/index.ts` },
      { find: /^sapling2d\/wechat$/, replacement: `${engine}/src/runtime/wechat.ts` },
      { find: /^sapling2d\/wechat-polyfills$/, replacement: `${engine}/src/platform/wechat/polyfills.ts` },
      { find: /^pixi\.js$/, replacement: `${engine}/node_modules/pixi.js` },
    ],
  },
  plugins: [saplingWechat({ entry: 'src/main.wechat.ts', projectName: 'sapling2d-clip' })],
}
