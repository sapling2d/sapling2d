import { cpSync, createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'
import { discoverAssetMounts, mimeOf, MOUNT_PREFIX, parseMountPath } from './mounts.ts'

export interface SaplingPluginOptions {
  /**
   * 资源目录（相对于 Vite 的 root）。默认 `public/assets`：Vite 会把 public/ 原样发布，
   * 页面上的地址是 `assets/<path>`，与 `startGame` 的默认 `assetsBaseUrl` 一致。
   * 游戏代码里的 `tex('fruit.png')` 对应 `<root>/public/assets/fruit.png`。
   */
  assetsDir?: string
  /**
   * 额外挂载资源的包。默认挂载游戏 package.json 的 dependencies / devDependencies 里声明了
   * `"sapling2d": { "assets": "<dir>" }` 的包；间接依赖不自动挂载，在这里列出。
   * 挂载的包的资源路径是 `~<包名>/<包内路径>`，如 `tex('~@foo/joystick/knob.png')`（ADR 0011）。
   */
  assetPackages?: string[]
}

/**
 * 匹配 tex('...') / sfx("...") / music(`...`) 的字面量路径（模板字符串里有 ${} 的跳过），
 * 以及 sheet('...', {...}) / atlas('...', data) / aseprite('...', data) / tileset('...', {...}) 的第一个参数（图片路径），tiledMap('...')（关卡文件）。
 * 函数名后面可以带类型参数（可以跨行，格式化工具会把长的联合类型拆开）：aseprite<'idle' | 'attack'>('hero.png', data)。
 */
const ASSET_CALL = /\b(tex|sfx|music|sheet|atlas|aseprite|tileset|tiledMap)(?:<[^()]*?>)?\(\s*(['"`])((?:(?!\2)[^\\\n$]|\\.)+)\2\s*[,)]/g
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/

export interface AssetReference {
  fn: 'tex' | 'sfx' | 'music' | 'sheet' | 'atlas' | 'aseprite' | 'tileset' | 'tiledMap'
  path: string
  /** 1 起始的行号和 0 起始的列号（与 Rollup 的 loc 一致）。 */
  line: number
  column: number
}

/** sapling2d 包自身的源码目录：不检查（文档注释里有示例路径）。 */
const ENGINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 找出源码中所有字面量资源路径（注释里的不算）。 */
export function findAssetReferences(code: string): AssetReference[] {
  const refs: AssetReference[] = []
  for (const m of stripComments(code).matchAll(ASSET_CALL)) {
    const before = code.slice(0, m.index)
    const line = before.split('\n').length
    const column = m.index - (before.lastIndexOf('\n') + 1)
    refs.push({ fn: m[1] as AssetReference['fn'], path: m[3]!, line, column })
  }
  return refs
}

/**
 * sapling2d 的 Vite 插件：在构建和开发时检查 `tex()` / `sfx()` / `music()` / `sheet()` / `atlas()` / `aseprite()` / `tileset()` / `tiledMap()` 引用的资源文件是否存在
 * （Tiled 关卡还检查它引用的外部图块集和图块集图片）。
 * 文件缺失时构建失败、开发服务器显示错误浮层，并指出文件、行列和最相近的现有文件名。
 *
 * 插件包的资源（ADR 0011）：依赖里声明了 `"sapling2d": { "assets": "<dir>" }` 的包被挂载到 `~<包名>/`，
 * 同样检查；开发服务器从 node_modules serve，`vite build` 把整个目录拷到输出目录的资源目录下。
 *
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite'
 * import { sapling } from 'sapling2d/vite'
 * export default defineConfig({ plugins: [sapling()] })
 * ```
 */
export function sapling(options: SaplingPluginOptions = {}): Plugin {
  let root = ''
  let assetsRoot = ''
  /** 资源目录在页面上的路径（`/assets`）；挂载的包在它下面的 `~<包名>/`。 */
  let assetsUrl = '/assets'
  let outDir = ''
  /** 构建时是否把挂载目录拷进输出：跟随 public 目录（`saplingWechat` 关掉了它，自己负责拷贝）。 */
  let copyMounts = false
  /** 包名 → 挂载的资源目录。 */
  let mounts = new Map<string, string>()
  let server: ViteDevServer | null = null
  /** 资源文件的绝对路径 → 引用它的模块 */
  const dependents = new Map<string, Set<string>>()

  return {
    name: 'sapling2d',
    enforce: 'pre',

    configResolved(config) {
      root = config.root
      assetsRoot = resolve(config.root, options.assetsDir ?? join('public', 'assets'))
      const publicDir = config.publicDir
      assetsUrl = publicDir && assetsRoot.startsWith(publicDir + sep) ? '/' + relative(publicDir, assetsRoot).split(sep).join('/') : '/assets'
      outDir = resolve(config.root, config.build.outDir)
      copyMounts = !!publicDir && config.build.copyPublicDir !== false
      mounts = discoverAssetMounts(root, options.assetPackages ?? [], (m) => config.logger.warn(m))
    },

    buildStart() {
      // `~` 是插件资源的保留前缀：游戏自己的资源目录顶层不能有以它开头的条目
      if (!existsSync(assetsRoot)) return
      const reserved = readdirSync(assetsRoot).filter((name) => name.startsWith(MOUNT_PREFIX))
      if (reserved.length) {
        this.error(`${relative(process.cwd(), assetsRoot)}/${reserved[0]} starts with "${MOUNT_PREFIX}", which is reserved for plugin assets (~<package>/...). Rename it.`)
      }
    },

    configureServer(s) {
      server = s
      // 资源文件新增或删除时，让引用它的模块重新检查
      const onChange = (file: string) => {
        const ids = dependents.get(resolve(file))
        if (!ids || !server) return
        for (const id of ids) {
          const mod = server.moduleGraph.getModuleById(id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      s.watcher.add(assetsRoot)
      for (const dir of mounts.values()) s.watcher.add(dir)
      s.watcher.on('add', onChange)
      s.watcher.on('unlink', onChange)
      const gamePackageJson = join(root, 'package.json')
      s.watcher.add(gamePackageJson)
      s.watcher.on('change', (file) => {
        // Tiled 关卡和图块集的内容变了（比如改了引用的图片）也要重新检查
        if (/\.(json|tmj|tsj)$/i.test(file)) onChange(file)
        // 依赖变了：重新找挂载的包
        if (resolve(file) === gamePackageJson) {
          mounts = discoverAssetMounts(root, options.assetPackages ?? [], (m) => s.config.logger.warn(m))
          for (const dir of mounts.values()) s.watcher.add(dir)
          s.ws.send({ type: 'full-reload' })
        }
      })
      // 挂载的包的资源从 node_modules serve：/assets/~<包名>/<路径>。排在 Vite 自己的 public 目录处理之前
      const prefix = `${assetsUrl}/${MOUNT_PREFIX}`
      s.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!
        if (!url.startsWith(prefix)) return next()
        const mount = parseMountPath(decodeURIComponent(url.slice(assetsUrl.length + 1)))
        const dir = mount && mounts.get(mount.pkg)
        if (!dir) return next()
        const file = resolve(dir, mount.rest)
        if (!file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader('Content-Type', mimeOf(file))
        createReadStream(file).pipe(res)
      })
    },

    transform(code, id) {
      const file = id.split('?')[0]!
      if (!SOURCE_FILE.test(file) || file.includes(`${sep}node_modules${sep}`) || file.startsWith(ENGINE_ROOT + sep)) return null
      if (!/\b(?:tex|sfx|music|sheet|atlas|aseprite|tileset|tiledMap)[<(]/.test(code)) return null
      for (const ref of findAssetReferences(code)) {
        // 内嵌的图片：不是文件，不检查
        if (ref.path.startsWith('data:')) continue
        const loc = { line: ref.line, column: ref.column }
        // 插件包的资源：对照它挂载的目录检查，提示里的路径带上 ~<包名>/
        const mount = parseMountPath(ref.path)
        let base = assetsRoot
        let wanted = ref.path
        let where = `the assets directory (${relative(process.cwd(), assetsRoot)})`
        let shown = (p: string) => p
        if (mount) {
          const dir = mounts.get(mount.pkg)
          if (!dir) {
            this.error({
              message:
                `${ref.fn}('${ref.path}'): package "${mount.pkg}" is not installed, or its package.json does not declare "sapling2d": { "assets": "<dir>" }. ` +
                `Install it; if it is not a direct dependency of the game, list it in sapling({ assetPackages: ['${mount.pkg}'] }).`,
              id,
              loc,
            })
          }
          base = dir
          wanted = mount.rest
          where = `the assets directory of "${mount.pkg}"`
          shown = (p) => `${MOUNT_PREFIX}${mount.pkg}/${p}`
        }
        const abs = resolve(base, wanted)
        let set = dependents.get(abs)
        if (!set) dependents.set(abs, (set = new Set()))
        set.add(id)
        if (abs !== base && !abs.startsWith(base + sep)) {
          this.error({ message: `${ref.fn}('${ref.path}') points outside ${where}.`, id, loc })
        }
        if (!existsSync(abs) || !statSync(abs).isFile()) {
          const hint = closestAsset(base, wanted)
          this.error({
            message:
              `Asset not found: ${ref.fn}('${ref.path}') → ${relative(process.cwd(), abs)}` +
              (hint ? `. Did you mean '${shown(hint)}'?` : mount ? `. Check ${where}.` : `. Put the file in ${relative(process.cwd(), assetsRoot)}/.`),
            id,
            loc,
          })
        }
        if (ref.fn === 'tiledMap') {
          const { problems, files } = checkTiledFiles(abs, base)
          // 关卡引用的文件变了也要重新检查这个模块
          for (const f of files) {
            let deps = dependents.get(f)
            if (!deps) dependents.set(f, (deps = new Set()))
            deps.add(id)
          }
          const rel = (p: string) => relative(process.cwd(), p)
          for (const p of problems) this.error({ message: `tiledMap('${ref.path}'): ${rel(p.from)} references ${p.ref}, which ${p.reason} (${rel(p.abs)}).`, id, loc })
        }
      }
      return null
    },

    /** 构建：挂载的包的资源目录整个拷到输出目录的资源目录下（`dist/assets/~<包名>/`），和 public/ 一起发布。 */
    writeBundle() {
      if (!copyMounts) return
      const dest = join(outDir, ...assetsUrl.split('/').filter(Boolean))
      for (const [pkg, dir] of mounts) {
        cpSync(dir, join(dest, `${MOUNT_PREFIX}${pkg}`), { recursive: true, filter: (src) => !src.endsWith('.DS_Store') })
      }
    },
  }
}

/**
 * 把注释替换成空格（保留换行，行列号不变）。识别字符串和模板字符串，
 * 所以 `'http://...'` 里的 // 不会被当成注释。
 */
function stripComments(code: string): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]!
    const next = code[i + 1]
    if (c === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') {
        out += ' '
        i++
      }
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      const stop = end === -1 ? code.length : end + 2
      for (; i < stop; i++) out += code[i] === '\n' ? '\n' : ' '
    } else if (c === "'" || c === '"' || c === '`') {
      out += c
      i++
      while (i < code.length && code[i] !== c) {
        if (code[i] === '\\') {
          out += code[i]! + (code[i + 1] ?? '')
          i += 2
        } else {
          out += code[i]
          i++
        }
      }
      if (i < code.length) out += code[i++]
    } else {
      out += c
      i++
    }
  }
  return out
}

/** 资源目录里与 `wanted` 最相近的文件（编辑距离），用于报错提示。 */
function closestAsset(root: string, wanted: string): string | null {
  const files = listFiles(root).map((f) => relative(root, f).split(sep).join('/'))
  let best: string | null = null
  let bestScore = Infinity
  for (const f of files) {
    const d = editDistance(f.toLowerCase(), wanted.toLowerCase())
    if (d < bestScore) {
      bestScore = d
      best = f
    }
  }
  // 差得太远的建议没有意义
  return best !== null && bestScore <= Math.max(3, Math.floor(wanted.length / 3)) ? best : null
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(p))
    else out.push(p)
  }
  return out
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]!
}

// Vite 配置由 Node 原生加载：相对导入必须带 .ts 扩展名
export { saplingWechat, startLogServer, type SaplingWechatOptions, type LogServerOptions } from './wechat.ts'
export { discoverAssetMounts, parseMountPath, MOUNT_PREFIX, type MountPath } from './mounts.ts'

/**
 * 检查 Tiled 关卡引用的文件：外部图块集（相对于关卡文件）和图块集的图片（相对于引用它的文件）要存在、在资源目录里，外部图块集要是 JSON。
 * 返回问题列表和涉及的所有文件（开发服务器据此在它们变化时重新检查）。关卡文件本身读不了或不是 JSON 时不报（加载时会报更清楚的错误）。
 */
export function checkTiledFiles(mapFile: string, assetsRoot: string): { problems: { from: string; ref: string; abs: string; reason: string }[]; files: string[] } {
  const problems: { from: string; ref: string; abs: string; reason: string }[] = []
  const files = [mapFile]
  const read = (file: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    } catch {
      return null
    }
  }
  const inside = (abs: string) => abs === assetsRoot || abs.startsWith(assetsRoot + sep)
  /** 引用的文件：不在资源目录里或不存在时记为问题，返回绝对路径（有问题时为 null）。 */
  const reference = (from: string, ref: string): string | null => {
    const abs = resolve(dirname(from), ref)
    files.push(abs)
    if (!inside(abs)) problems.push({ from, ref, abs, reason: 'is outside the assets directory' })
    else if (!existsSync(abs)) problems.push({ from, ref, abs, reason: 'does not exist' })
    else return abs
    return null
  }
  const map = read(mapFile)
  if (!map) return { problems, files }
  for (const ts of (map.tilesets as Record<string, unknown>[] | undefined) ?? []) {
    if (typeof ts.source === 'string') {
      const abs = reference(mapFile, ts.source)
      if (!abs) continue
      const ext = read(abs)
      if (!ext) {
        problems.push({ from: mapFile, ref: ts.source, abs, reason: 'is not a JSON tileset (save tilesets in JSON format)' })
        continue
      }
      if (typeof ext.image === 'string') reference(abs, ext.image)
    } else if (typeof ts.image === 'string') {
      reference(mapFile, ts.image)
    }
  }
  return { problems, files }
}
