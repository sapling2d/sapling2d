import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

/**
 * 分层规则：每个目录不准 import 的目录（前缀匹配；类型导入也算，分层说的是概念上的依赖）。
 * 方向是 math → core → nodes → render / runtime，platform 只有接口和无头实现给 core 用，浏览器 / 小游戏实现和插件在最外层。
 */
const FORBIDDEN: Record<string, string[]> = {
  math: ['core', 'nodes', 'physics', 'audio', 'storage', 'render', 'runtime', 'platform', 'plugins', 'testing', 'vite'],
  core: ['nodes', 'render', 'runtime', 'platform/browser', 'platform/wechat', 'plugins', 'testing', 'vite'],
  physics: ['nodes', 'render', 'runtime', 'platform', 'plugins', 'testing', 'vite'],
  audio: ['nodes', 'render', 'runtime', 'platform', 'plugins', 'testing', 'vite'],
  storage: ['nodes', 'render', 'runtime', 'platform', 'plugins', 'testing', 'vite'],
  nodes: ['render', 'runtime', 'platform/browser', 'platform/wechat', 'plugins', 'testing', 'vite'],
  render: ['platform', 'plugins', 'testing', 'vite'],
  runtime: ['render', 'platform/browser', 'platform/wechat', 'plugins', 'testing', 'vite'],
  plugins: ['render', 'runtime', 'testing', 'vite'],
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.endsWith('.d.ts') ? [p] : []
  })
}

/** 文件所在的目录（相对 src，`/` 分隔），顶层文件是 ''。 */
const dirOf = (file: string) => relative(src, dirname(file)).split('\\').join('/')

it('目录之间只能按分层方向 import', () => {
  const offenders: string[] = []
  for (const file of files(src)) {
    const from = dirOf(file)
    const rules = Object.entries(FORBIDDEN).find(([dir]) => from === dir || from.startsWith(dir + '/'))
    if (!rules) continue
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const target = dirOf(normalize(join(dirname(file), m[1]!)))
      if (rules[1].some((dir) => target === dir || target.startsWith(dir + '/'))) offenders.push(`${relative(src, file)} -> ${m[1]}`)
    }
  }
  expect(offenders).toEqual([])
})
