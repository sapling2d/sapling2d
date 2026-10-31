import type { Rect2 } from '../math/Rect2'
import type { Vector2 } from '../math/Vector2'
import type { Platform } from '../platform/Platform'
import type { Resource } from './Resource'

/**
 * 贴图资源句柄。用 `tex(path)` 创建，路径相对于游戏的资源目录（默认 `assets/`）。
 * 同一路径永远返回同一个句柄，所以可以在任何地方引用：
 *
 * ```ts
 * class GameScene extends Scene {
 *   static assets = { fruit: tex('fruit.png') }   // 进入场景前加载完成
 *   override ready() {
 *     this.add(new Sprite2D({ texture: GameScene.assets.fruit }))
 *   }
 * }
 * ```
 *
 * 也可以是一张大图里的子区域（图集的一帧）：由 `sheet()` / `atlas()` 切出，用法和整张图完全相同。
 */
export class Texture implements Resource {
  readonly kind = 'texture'
  private _width = 0
  private _height = 0
  private _loaded = false
  private _ownResource: unknown = null
  /** @internal 子区域所在的整张图；整张图自己为 null。 */
  readonly _base: Texture | null
  /**
   * @internal 图片文件里的颜色已经预乘了透明度（Spine 图集的 `pma: true` 页）：渲染层上传到 GPU 时不再预乘。
   * 由声明这张图的资源（如 `spineSkeleton`）在加载前设置；整张图的属性，子区域不单独设。
   */
  _premultiplied = false
  private readonly _frameOf: (() => TextureFrame) | null

  /** @internal 请使用 tex(path)、sheet() 或 atlas()。 */
  constructor(path: string)
  /** @internal 子区域：`frame` 在用到时才计算（网格切片要等整张图加载后才知道尺寸）。 */
  constructor(path: string, base: Texture, frame: () => TextureFrame)
  constructor(
    readonly path: string,
    base?: Texture,
    frame?: () => TextureFrame,
  ) {
    this._base = base ?? null
    this._frameOf = frame ?? null
  }

  /** 宽度（像素）：整张图的原始宽度，或子区域裁剪前的宽度；未加载或无头模式下整张图为 0。 */
  get width(): number {
    return this._frameOf ? this._frameOf().width : this._width
  }

  get height(): number {
    return this._frameOf ? this._frameOf().height : this._height
  }

  get isLoaded(): boolean {
    return this._base ? this._base.isLoaded : this._loaded
  }

  /** @internal 平台加载出的原始图片对象（浏览器是 HTMLImageElement，小游戏是 wx Image）；子区域返回整张图的。 */
  get _resource(): unknown {
    return this._base ? this._base._resource : this._ownResource
  }

  /**
   * 打包工具给这一帧设置的锚点（0–1，相对裁剪前的原始尺寸；TexturePacker 里打开 pivot points 导出）。
   * `Sprite2D` 默认（`centered: true`）以它为原点，没有时以中心为原点。整张图和网格图集的帧为 null。
   */
  get pivot(): Vector2 | null {
    return this._frameOf ? this._frameOf().pivot : null
  }

  /** @internal 子区域在整张图里的位置；整张图为 null。 */
  get _frame(): TextureFrame | null {
    return this._frameOf ? this._frameOf() : null
  }

  /** @internal */
  _setLoaded(resource: unknown, width: number, height: number): void {
    if (this._base) return this._base._setLoaded(resource, width, height)
    this._ownResource = resource
    this._width = width
    this._height = height
    this._loaded = true
  }

  /** @internal 加载图片（`Resource`）：子区域加载它所在的整张图；同一张图并发请求只加载一次。 */
  _load(platform: Platform): Promise<void> {
    return loadTexture(this._base ?? this, platform)
  }

  /** @internal 释放图片；再次用到时需要重新加载。子区域没有自己的图片（整张图是单独的资源），什么都不做。 */
  _unload(): void {
    if (this._base) return
    this._ownResource = null
    this._loaded = false
  }

  /** @internal 子区域依赖整张图；整张图自己没有依赖。 */
  _textures(): Texture[] {
    return this._base ? [this._base] : []
  }
}

/**
 * @internal 子区域：`region` 是它在整张图里的矩形；`width` / `height` 是裁剪前的原始尺寸，`trim` 是 region 在原始尺寸里的偏移（图集打包时裁掉了透明边），
 * `pivot` 是打包工具设置的锚点（0–1，相对原始尺寸），没有时为 null。
 */
export interface TextureFrame {
  region: Rect2
  width: number
  height: number
  trim: Vector2 | null
  pivot: Vector2 | null
}

const textureCache = new Map<string, Texture>()

/** 声明一张贴图。同一路径返回同一个句柄。 */
export function tex(path: string): Texture {
  let t = textureCache.get(path)
  if (!t) {
    t = new Texture(path)
    textureCache.set(path, t)
  }
  return t
}

const pending = new Map<Texture, Promise<void>>()

/** 加载一张整张图（同一张图并发请求只加载一次）；`Texture._load` 走这里。 */
function loadTexture(asset: Texture, platform: Platform): Promise<void> {
  if (asset.isLoaded) return Promise.resolve()
  let p = pending.get(asset)
  if (!p) {
    p = platform.loadImage(asset.path).then(
      (img) => {
        asset._setLoaded(img.resource, img.width, img.height)
        pending.delete(asset)
      },
      (err: unknown) => {
        pending.delete(asset)
        throw new Error(`Failed to load texture "${asset.path}": ${err instanceof Error ? err.message : String(err)}`)
      },
    )
    pending.set(asset, p)
  }
  return p
}
