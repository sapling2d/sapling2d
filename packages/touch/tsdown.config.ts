import { defineConfig } from 'tsdown'

// 发布构建：一个 ESM 文件 + 打包好的类型声明，输出到 dist/。sapling2d 是 peer 依赖，不打进包里。
// 仓库内开发直接用 src/index.ts（package.json 的 exports），发布时由 publishConfig.exports 换成 dist/。
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: { tsconfig: 'tsconfig.build.json' },
  tsconfig: 'tsconfig.build.json',
  sourcemap: true,
  clean: true,
  deps: { neverBundle: ['sapling2d'] },
})
