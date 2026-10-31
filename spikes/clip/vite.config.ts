// 裁剪 spike（浏览器）：直接引用引擎源码（spikes/ 不在 workspace 里）。
// 运行：pnpm --filter example-sprite exec vite --config ../../spikes/clip/vite.config.ts
import { fileURLToPath } from 'node:url'

const engine = fileURLToPath(new URL('../../packages/engine', import.meta.url))
const here = fileURLToPath(new URL('.', import.meta.url))

export default {
  root: here,
  resolve: {
    alias: [
      { find: /^sapling2d$/, replacement: `${engine}/src/index.ts` },
      { find: /^sapling2d\/browser$/, replacement: `${engine}/src/runtime/browser.ts` },
      // spike 直接用到 pixi.js 的 Graphics：用引擎依赖的那一份，避免两份 Pixi
      { find: /^pixi\.js$/, replacement: `${engine}/node_modules/pixi.js` },
    ],
  },
  server: { port: 5199, strictPort: true, fs: { allow: [engine, here] } },
}
