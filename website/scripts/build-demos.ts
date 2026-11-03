// 把 examples/* 构建成可以嵌进文档站的 demo：website/public/demos/<名字>/
// 引擎在浏览器里按页面的相对路径（assets/）加载资源，所以用 --base ./ 构建就能放在任意子路径下。
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { demos } from '../.vitepress/demos.ts'

const website = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(website, 'public/demos')
const only = process.argv.slice(2)

rmSync(out, { recursive: true, force: true })
for (const demo of demos) {
  if (only.length && !only.includes(demo.name)) continue
  console.log(`\n▶ ${demo.name}`)
  execFileSync(
    'pnpm',
    ['--filter', `example-${demo.name}`, 'exec', 'vite', 'build', '--base', './', '--outDir', join(out, demo.name), '--emptyOutDir'],
    { stdio: 'inherit' },
  )
}
