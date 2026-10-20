import { defineConfig } from 'vite'
import { sapling, saplingWechat } from 'sapling2d/vite'

// pnpm dev:wechat → 用微信开发者工具打开 dist-wechat/（开发构建；真机预览用 pnpm build:wechat 发布构建。环境变量：WX_APPID、SAPLING_LOG_URL）
export default defineConfig({
  plugins: [sapling(), saplingWechat({ entry: 'src/main.wechat.ts', projectName: 'sapling2d-merge' })],
})
