import { defineConfig } from 'vite'
import { sapling } from 'sapling2d/vite'

// 资源放在 public/assets/：spineSkeleton('spineboy/spineboy-pro.json') 对应 public/assets/spineboy/spineboy-pro.json，
// 路径写错时构建失败（@sapling2d/spine 的 package.json 声明了 assetFunctions，sapling() 连它一起检查）
export default defineConfig({ plugins: [sapling()] })
