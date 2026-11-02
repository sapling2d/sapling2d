import { defineConfig } from 'tsdown'

// 发布构建：库（index）和命令行（cli）各一个 ESM 文件，依赖不打进包里。
// 仓库内开发直接用 src/*.ts（package.json 的 exports / bin），发布时由 publishConfig 换成 dist/。
export default defineConfig({
  entry: { index: 'src/index.ts', cli: 'src/cli.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: { tsconfig: 'tsconfig.build.json' },
  tsconfig: 'tsconfig.build.json',
  sourcemap: true,
  clean: true,
  deps: { neverBundle: ['maxrects-packer', 'pngjs'] },
})
