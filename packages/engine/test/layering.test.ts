import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

/**
 * 分层规则：每个目录不准 import 的目录（前缀匹配；类型导入也算，分层说的是概念上的依赖）。
 *
 * 方向（上面的不认识下面的）：
 *   math
 *   assets（资源格式，只认识 math 和 Platform 接口）  audio / storage / physics（子系统）
 *   core（树、主循环、Signal、Tween、Viewport、注册表）↔ input（类型互引，运行时 input → core）
 *   nodes（内置节点，含 CameraManager / TileLayers 子系统）
 *   render（Pixi；只认识 core 的 Renderer 接口）  platform/browser、platform/wechat（Platform 实现）  plugins
 *   runtime（组合根：Game，以及 browser.ts / wechat.ts 两个入口）  testing  vite
 *   node（只在 Node 里跑的共用规则，如资源挂载）：只有 testing 和 vite 能用，它自己不认识引擎
 */
const NODE_ONLY = ['node', 'testing', 'vite']
const FORBIDDEN: Record<string, string[]> = {
  math: ['assets', 'core', 'input', 'nodes', 'physics', 'audio', 'storage', 'render', 'runtime', 'platform', 'plugins', ...NODE_ONLY],
  assets: ['core', 'input', 'nodes', 'physics', 'audio', 'storage', 'render', 'runtime', 'platform/browser', 'platform/wechat', 'plugins', ...NODE_ONLY],
  physics: ['assets', 'input', 'nodes', 'audio', 'storage', 'render', 'runtime', 'platform', 'plugins', ...NODE_ONLY],
  audio: ['input', 'nodes', 'physics', 'storage', 'render', 'runtime', 'platform', 'plugins', ...NODE_ONLY],
  storage: ['assets', 'input', 'nodes', 'physics', 'audio', 'render', 'runtime', 'platform', 'plugins', ...NODE_ONLY],
  core: ['nodes', 'render', 'runtime', 'platform/browser', 'platform/wechat', 'plugins', ...NODE_ONLY],
  input: ['assets', 'nodes', 'physics', 'audio', 'storage', 'render', 'runtime', 'platform/browser', 'platform/wechat', 'plugins', ...NODE_ONLY],
  nodes: ['render', 'runtime', 'platform/browser', 'platform/wechat', 'plugins', ...NODE_ONLY],
  render: ['runtime', 'platform', 'plugins', ...NODE_ONLY],
  platform: ['nodes', 'render', 'runtime', 'plugins', ...NODE_ONLY],
  plugins: ['render', 'runtime', ...NODE_ONLY],
  runtime: ['render', 'platform/browser', 'platform/wechat', 'plugins', ...NODE_ONLY],
  testing: ['vite'],
  vite: ['math', 'assets', 'core', 'input', 'nodes', 'physics', 'audio', 'storage', 'render', 'runtime', 'platform', 'plugins', 'testing'],
  node: ['math', 'assets', 'core', 'input', 'nodes', 'physics', 'audio', 'storage', 'render', 'runtime', 'platform', 'plugins', 'testing', 'vite'],
}

/** 组合根的例外：两个平台入口把渲染器、默认插件和自己平台的实现拼起来。 */
const EXEMPT: Record<string, string[]> = {
  'runtime/browser.ts': ['render', 'plugins', 'platform/browser'],
  'runtime/wechat.ts': ['render', 'plugins', 'platform/wechat'],
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.endsWith('.d.ts') ? [p] : []
  })
}

const posix = (p: string) => p.split('\\').join('/')
/** 文件所在的目录（相对 src，`/` 分隔），顶层文件是 ''。 */
const dirOf = (file: string) => posix(relative(src, dirname(file)))
const inDir = (target: string, dir: string) => target === dir || target.startsWith(dir + '/')

it('目录之间只能按分层方向 import', () => {
  const offenders: string[] = []
  for (const file of files(src)) {
    const from = dirOf(file)
    const rules = Object.entries(FORBIDDEN).find(([dir]) => inDir(from, dir))
    if (!rules) continue
    const exempt = EXEMPT[posix(relative(src, file))] ?? []
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/g)) {
      if (/\.(json|png|mp3)$/.test(m[1]!)) continue // 注释里的示例（`import data from './sprites.json'`）
      const target = dirOf(normalize(join(dirname(file), m[1]!)))
      if (rules[1].some((dir) => inDir(target, dir) && !exempt.some((e) => inDir(target, e)))) offenders.push(`${posix(relative(src, file))} -> ${m[1]}`)
    }
  }
  expect(offenders).toEqual([])
})
