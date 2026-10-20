import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * 插件资源路径的前缀：`~<包名>/<包内资源目录下的相对路径>`，包名含 scope（ADR 0011）。
 * `~` 在 webpack / Sass 里就是 node_modules，URL 里不用转义，文件名里到处合法；游戏自己的资源目录顶层不得以它开头。
 */
export const MOUNT_PREFIX = '~'

export interface MountPath {
  /** 完整的 npm 包名，如 `@foo/joystick`、`foo-sfx`。 */
  pkg: string
  /** 包内资源目录下的相对路径；只写了包名时为空串。 */
  rest: string
}

/** 拆开插件资源路径：`~@a/b/x/y.png` → `{ pkg: '@a/b', rest: 'x/y.png' }`，`~a/x.png` → `{ pkg: 'a', rest: 'x.png' }`。不以 `~` 开头返回 null。 */
export function parseMountPath(path: string): MountPath | null {
  if (!path.startsWith(MOUNT_PREFIX)) return null
  const segments = path.slice(MOUNT_PREFIX.length).split('/')
  const n = segments[0]?.startsWith('@') ? 2 : 1
  const name = segments.slice(0, n)
  if (name.length < n || name.some((s) => !s)) return { pkg: name.join('/'), rest: '' }
  return { pkg: name.join('/'), rest: segments.slice(n).join('/') }
}

/**
 * 挂载的插件资源目录：游戏 `package.json` 的 dependencies / devDependencies（加 `extra`）里，
 * 自己的 `package.json` 声明了 `"sapling2d": { "assets": "<dir>" }` 的包 → 资源目录的绝对路径（已解析符号链接）。
 * 不递归到间接依赖，不扫描 node_modules。
 */
export function discoverAssetMounts(root: string, extra: readonly string[] = [], warn: (message: string) => void = (m) => console.warn(m)): Map<string, string> {
  const mounts = new Map<string, string>()
  const game = readJson(join(root, 'package.json')) ?? {}
  const names = new Set<string>([...Object.keys(asRecord(game.dependencies)), ...Object.keys(asRecord(game.devDependencies)), ...extra])
  for (const name of names) {
    const pkgJson = findPackageJson(root, name)
    if (!pkgJson) {
      if (extra.includes(name)) warn(`[sapling2d] assetPackages: "${name}" is not installed.`)
      continue
    }
    const dir = asRecord(readJson(pkgJson)?.sapling2d).assets
    if (typeof dir !== 'string') {
      if (extra.includes(name)) warn(`[sapling2d] assetPackages: "${name}" does not declare "sapling2d": { "assets": "<dir>" } in its package.json.`)
      continue
    }
    const abs = resolve(dirname(pkgJson), dir)
    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      warn(`[sapling2d] "${name}" declares sapling2d.assets = "${dir}" but ${abs} is not a directory; its assets are not mounted.`)
      continue
    }
    mounts.set(name, abs)
  }
  return mounts
}

/**
 * 包的 package.json。不用 `require.resolve('<name>/package.json')`：很多包的 exports 不暴露 package.json
 * （ERR_PACKAGE_PATH_NOT_EXPORTED）。沿 node_modules 向上找，pnpm 的符号链接解析成真实路径。
 */
function findPackageJson(root: string, name: string): string | null {
  for (let dir = resolve(root); ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name, 'package.json')
    if (existsSync(candidate)) return realpathSync(candidate)
    if (dirname(dir) === dir) return null
  }
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** 开发服务器 serve 挂载资源时用的 Content-Type。 */
export function mimeOf(file: string): string {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}
