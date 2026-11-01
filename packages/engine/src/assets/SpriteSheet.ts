import { Rect2 } from '../math/Rect2'
import { Vector2 } from '../math/Vector2'
import type { Resource } from './Resource'
import { tex, Texture, type TextureFrame } from './Texture'

/**
 * 网格图集：一张大图按等大的格子切成多帧（从左到右、从上到下编号，从 0 开始）。用 `sheet(path, { columns, rows })` 创建。
 *
 * ```ts
 * static assets = { boom: sheet('explosion.png', { columns: 4, rows: 2 }) }
 * new AnimatedSprite2D({ frames: Main.assets.boom.frames(), fps: 16, loop: false })
 * ```
 *
 * 每帧的尺寸 = 整张图的尺寸 / 列数（行数），在图片加载后才确定；无头模式下为 0。
 */
export class SpriteSheet implements Resource {
  readonly kind = 'spritesheet'
  private readonly _frames: Texture[]

  /** @internal 请使用 sheet()。 */
  constructor(
    /** 整张图。 */
    readonly texture: Texture,
    readonly columns: number,
    readonly rows: number,
  ) {
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) {
      throw new Error(`sheet('${texture.path}'): columns and rows must be positive integers (got ${columns}×${rows}).`)
    }
    this._frames = Array.from({ length: columns * rows }, (_, i) => {
      const col = i % columns
      const row = Math.floor(i / columns)
      return new Texture(`${texture.path}#${i}`, texture, () => {
        const w = texture.width / columns
        const h = texture.height / rows
        return { region: new Rect2(col * w, row * h, w, h), rotated: false, width: w, height: h, trim: null, pivot: null }
      })
    })
  }

  /** 帧数（列数 × 行数）。 */
  get count(): number {
    return this._frames.length
  }

  get isLoaded(): boolean {
    return this.texture.isLoaded
  }

  /** 第 `index` 帧（从 0 开始）。 */
  frame(index: number): Texture {
    const t = this._frames[index]
    if (!t) throw new Error(`sheet('${this.texture.path}'): frame ${index} is out of range (0–${this.count - 1}).`)
    return t
  }

  /** 第 `start` 到第 `end` 帧（都包含）；不传参数时是全部帧。 */
  frames(start = 0, end = this.count - 1): Texture[] {
    return frameRange(`sheet('${this.texture.path}')`, start, end, (i) => this.frame(i))
  }

  /** 整张图的路径（`Resource`）。 */
  get path(): string {
    return this.texture.path
  }

  /** @internal 自己没有文件要读（`Resource`）：图片由引擎按 `_textures()` 加载。 */
  _load(): Promise<void> {
    return Promise.resolve()
  }

  /** @internal 图片是单独的资源，这里没有自己的数据要释放。 */
  _unload(): void {}

  /** @internal */
  _textures(): Texture[] {
    return [this.texture]
  }
}

/** 图集 JSON 里的一帧（TexturePacker 等工具导出的 “JSON Hash” / “JSON Array” 格式，Pixi、Phaser 使用的也是这种格式）。 */
export interface AtlasFrameData {
  /** 帧在图里的位置。旋转打包的帧（`rotated`）这里的 `w` / `h` 仍是**未旋转**的尺寸，图里实际占 `h` 宽、`w` 高（TexturePacker 的约定，Pixi 也这样读）。 */
  frame: { x: number; y: number; w: number; h: number }
  /** 打包时把这一帧顺时针转了 90° 放进图里（TexturePacker 的 Allow rotation）；渲染时转回来，游戏代码看到的尺寸和方向都是原图的。 */
  rotated?: boolean
  trimmed?: boolean
  spriteSourceSize?: { x: number; y: number; w: number; h: number }
  sourceSize?: { w: number; h: number }
  /** 锚点（0–1，相对裁剪前的原始尺寸）：TexturePacker 打开 pivot points 时导出。 */
  pivot?: { x: number; y: number }
  /** 同 `pivot`：TexturePacker 的 PixiJS / Phaser 3 格式用这个名字。 */
  anchor?: { x: number; y: number }
}

/** 图集 JSON 里的帧列表：名字 → 帧（JSON Hash），或带 `filename` 的帧数组（JSON Array）。 */
export type AtlasFrames<F extends AtlasFrameData = AtlasFrameData> = Record<string, F> | (F & { filename: string })[]

/** 一页图集的 JSON（TexturePacker 的 JSON Hash / JSON Array / PixiJS 格式）。多页打包（multipack）时每页一个这样的文件。 */
export interface AtlasData {
  frames: AtlasFrames
  meta?: {
    /** 这一页的图片文件名；多页图集用它检查页的顺序对不对。 */
    image?: string
    /** TexturePacker 多页打包时同一套图集的其他 JSON 文件名（只作参考：引擎按 `atlas()` 传入的顺序对应页）。 */
    related_multi_packs?: string[]
    [key: string]: unknown
  }
}

/** Phaser 3 格式的图集 JSON（TexturePacker 的 “Phaser 3”）：所有页在一个文件里，`textures` 每项一页。 */
export interface AtlasTexturesData {
  textures: { image?: string; frames: AtlasFrames }[]
  meta?: Record<string, unknown>
}

/**
 * 打包图集：很多张大小不一的小图打包在一张（或几张）大图里，每张小图有名字。用 `atlas(path, data)` 创建，
 * `data` 是打包工具导出的 JSON（直接 import 进代码）：
 *
 * ```ts
 * import spritesData from './sprites.json'
 * static assets = { sprites: atlas('sprites.png', spritesData) }
 * new Sprite2D({ texture: Main.assets.sprites.get('enemy_red') })
 * new AnimatedSprite2D({ frames: Main.assets.sprites.frames('explosion_'), fps: 16 })
 * ```
 *
 * 多页打包（TexturePacker 的 Multipack：一页放不下时自动分页）每页一张图、一个 JSON，按同样的顺序传两个数组；
 * Phaser 3 格式是一个 JSON 带所有页（`textures`），只传它：
 *
 * ```ts
 * static assets = { items: atlas(['items-0.png', 'items-1.png'], [page0, page1]) }
 * ```
 *
 * 帧的尺寸来自 JSON，无头模式下也正确。支持裁剪透明边（trimmed）、旋转打包（rotated：渲染时转回来）和锚点（pivot）。
 * 加载、卸载以页为单位（每页一张图）。
 */
export class Atlas implements Resource {
  readonly kind = 'atlas'
  /** 每一页的图（单页图集只有一项）。 */
  readonly pages: readonly Texture[]
  /** 第一页的图（单页图集就是整张图）。 */
  readonly texture: Texture
  private readonly _frames = new Map<string, Texture>()
  private readonly _who: string

  /** @internal 请使用 atlas()。 */
  constructor(paths: string | string[], data: AtlasData | AtlasData[] | AtlasTexturesData) {
    const list = Array.isArray(paths) ? paths : [paths]
    const who = (this._who = list.length === 1 ? `atlas('${list[0]}')` : `atlas(['${list.join("', '")}'])`)
    if (!list.length) throw new Error(`atlas([]): give at least one image path.`)
    const pages = atlasPages(data)
    if (pages.length !== list.length) {
      throw new Error(`${who}: ${list.length} image path(s) but the frame data has ${pages.length} page(s). Pass one image path per page, in the order the packer numbered them.`)
    }
    const owner = new Map<string, string>()
    this.pages = list.map((path, i) => {
      if (owner.has(path)) throw new Error(`${who}: the same image is listed twice ('${path}').`)
      owner.set(path, path)
      const page = pages[i]!
      // 多页时按 JSON 里记的图片名检查顺序：两个数组错位的话帧会画成另一页的像素，很难看出来
      if (list.length > 1 && page.image && baseName(page.image) !== baseName(path)) {
        throw new Error(`${who}: page ${i + 1} is '${path}' but its frame data is for '${page.image}'. List the images in the same order as their JSON files.`)
      }
      return tex(path)
    })
    this.texture = this.pages[0]!
    const pageOf = new Map<string, string>()
    this.pages.forEach((texture, i) => {
      for (const [name, f] of atlasEntries(pages[i]!)) {
        const other = pageOf.get(name)
        if (other !== undefined) throw new Error(`${who}: frame "${name}" is in both '${other}' and '${texture.path}'.`)
        pageOf.set(name, texture.path)
        const frame = atlasFrame(who, name, f)
        this._frames.set(name, new Texture(`${texture.path}#${name}`, texture, () => frame))
      }
    })
  }

  /** 所有帧的名字（按 JSON 中的顺序，多页时按页的顺序）。 */
  get names(): string[] {
    return [...this._frames.keys()]
  }

  /** 所有页的图都加载完。 */
  get isLoaded(): boolean {
    return this.pages.every((p) => p.isLoaded)
  }

  has(name: string): boolean {
    return this._frames.has(name)
  }

  /** 按名字取一帧。名字不存在时报错，并列出最相近的名字。 */
  get(name: string): Texture {
    const t = this._frames.get(name)
    if (t) return t
    const similar = this.names.filter((n) => n.includes(name) || name.includes(n)).slice(0, 5)
    throw new Error(`${this._who}: no frame named "${name}".` + (similar.length ? ` Similar: ${similar.join(', ')}.` : ` Frames: ${this.names.slice(0, 10).join(', ')}${this._frames.size > 10 ? ', …' : ''}.`))
  }

  /**
   * 一段动画的所有帧：名字是 `prefix` + 编号（前面可以有一个分隔符 `_` / `-` / 空格，后面可以有扩展名），按编号排序。
   * `frames('explosion_')` 和 `frames('explosion')` 都取 `explosion_1.png`、`explosion_2.png`……，
   * 但不会取到 `explosion_big_1.png`（前缀后面不是编号）。多页图集的帧可以分散在不同页里。一帧都没有时报错。
   */
  frames(prefix: string): Texture[] {
    const frameNumber = (n: string) => Number(/\d+/.exec(n.slice(prefix.length))![0])
    const names = this.names
      .filter((n) => n.startsWith(prefix) && FRAME_NUMBER.test(n.slice(prefix.length)))
      .sort((x, y) => frameNumber(x) - frameNumber(y) || naturalCompare(x, y))
    if (!names.length) {
      const loose = this.names.filter((n) => n.startsWith(prefix))
      const hint = loose.length
        ? ` Frames starting with it, but not followed by a number: ${loose.slice(0, 5).join(', ')}${loose.length > 5 ? ', …' : ''}. Use a longer prefix (e.g. "${longerPrefix(loose[0]!, prefix)}").`
        : ''
      throw new Error(`${this._who}: no frames named "${prefix}" + a number.${hint}`)
    }
    return names.map((n) => this._frames.get(n)!)
  }

  /** 第一页的图的路径（`Resource`）。 */
  get path(): string {
    return this.texture.path
  }

  /** @internal 自己没有文件要读（`Resource`）：图片由引擎按 `_textures()` 加载。 */
  _load(): Promise<void> {
    return Promise.resolve()
  }

  /** @internal 图片是单独的资源，这里没有自己的数据要释放。 */
  _unload(): void {}

  /** @internal 每一页的图。 */
  _textures(): Texture[] {
    return [...this.pages]
  }
}

/** @internal 图集 JSON 的帧：JSON Array 和 JSON Hash 都整理成 [名字, 帧] 的列表，保持导出顺序。 */
export function atlasEntries<F extends AtlasFrameData>(data: { frames: Record<string, F> | (F & { filename: string })[] }): [string, F][] {
  return Array.isArray(data.frames) ? data.frames.map((f) => [f.filename, f]) : Object.entries(data.frames)
}

/** 图集数据整理成页的列表：一页的 JSON、每页一个 JSON 的数组，或 Phaser 3 格式（`textures`）。 */
function atlasPages(data: AtlasData | AtlasData[] | AtlasTexturesData): { image?: string; frames: AtlasFrames }[] {
  if (Array.isArray(data)) return data.map((d) => ({ image: d.meta?.image, frames: d.frames }))
  if ('textures' in data && Array.isArray(data.textures)) return data.textures
  const d = data as AtlasData
  return [{ image: d.meta?.image, frames: d.frames }]
}

/** 路径最后一段（`ui/items-0.png` → `items-0.png`）。 */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** @internal 第 `start` 到第 `end` 帧（都包含）。`frame(i)` 负责检查越界；`start > end` 时报错，不返回空列表。 */
export function frameRange(who: string, start: number, end: number, frame: (i: number) => Texture): Texture[] {
  if (start > end) throw new Error(`${who}: frames(${start}, ${end}): start must not be greater than end.`)
  const out: Texture[] = []
  for (let i = start; i <= end; i++) out.push(frame(i))
  return out
}

/** @internal 图集 JSON 里的一帧 → 子区域。`who` 用在错误信息里（如 `atlas('a.png')`）。 */
export function atlasFrame(who: string, name: string, f: AtlasFrameData): TextureFrame {
  if (!f.frame) throw new Error(`${who}: frame "${name}" has no "frame" rectangle. Export the atlas as JSON (Hash) or JSON (Array).`)
  const { x, y, w, h } = f.frame
  const rotated = f.rotated === true
  const src = f.trimmed ? f.spriteSourceSize : undefined
  const pivot = f.pivot ?? f.anchor
  if (pivot && !(Number.isFinite(pivot.x) && Number.isFinite(pivot.y))) throw new Error(`${who}: frame "${name}" has an invalid pivot (${pivot.x}, ${pivot.y}).`)
  return {
    // 旋转打包的帧：JSON 里的 w / h 是未旋转的尺寸，图里实际占 h 宽、w 高
    region: new Rect2(x, y, rotated ? h : w, rotated ? w : h),
    rotated,
    width: src ? (f.sourceSize?.w ?? w) : w,
    height: src ? (f.sourceSize?.h ?? h) : h,
    trim: src ? new Vector2(src.x, src.y) : null,
    // 正好是中心的锚点当作没有：和默认行为一样，dump 里也不多一项
    pivot: pivot && !(pivot.x === 0.5 && pivot.y === 0.5) ? new Vector2(pivot.x, pivot.y) : null,
  }
}

/** 网格图集：把 `path` 这张图切成 `columns` × `rows` 个等大的格子。路径相对于资源目录。 */
export function sheet(path: string, grid: { columns: number; rows: number }): SpriteSheet {
  return new SpriteSheet(tex(path), grid.columns, grid.rows)
}

/** 打包图集：`path` 是图集图片（相对于资源目录），`data` 是打包工具导出的 JSON（JSON Hash / JSON Array / PixiJS / Phaser 3）。 */
export function atlas(path: string, data: AtlasData | AtlasTexturesData): Atlas
/** 多页图集（TexturePacker 的 Multipack）：每页一张图、一个 JSON，两个数组顺序一致；或者 Phaser 3 格式的一个 JSON（`textures` 每项一页）。 */
export function atlas(paths: string[], data: AtlasData[] | AtlasTexturesData): Atlas
export function atlas(paths: string | string[], data: AtlasData | AtlasData[] | AtlasTexturesData): Atlas {
  return new Atlas(paths, data)
}

/** `frames(prefix)` 里前缀后面剩下的部分：可选的分隔符 + 编号 + 可选的扩展名（`_01.png`、`-3`、` 12`）。 */
const FRAME_NUMBER = /^[_\- ]?\d+(\.[A-Za-z0-9]+)?$/

/** 报错提示：`name` 里 `prefix` 之后、编号之前的那一段也算进前缀（`hero_attack_heavy_01` → `hero_attack_heavy_`）。 */
function longerPrefix(name: string, prefix: string): string {
  const m = /^(.*?)\d+(\.[A-Za-z0-9]+)?$/.exec(name)
  return m && m[1]!.length > prefix.length ? m[1]! : name
}

/** 字符串比较，其中的数字按数值比较。 */
function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g
  const pa = a.match(re) ?? []
  const pb = b.match(re) ?? []
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i]!
    const y = pb[i]!
    if (x === y) continue
    const nx = Number(x)
    const ny = Number(y)
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) return nx - ny
    return x < y ? -1 : 1
  }
  return pa.length - pb.length
}
