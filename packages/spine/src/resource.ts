import { AtlasAttachmentLoader, Physics, Skeleton, SkeletonJson, TextureAtlas, Texture as SpineTexture, Vector2 as SpineVector2, type SkeletonData } from '@esotericsoftware/spine-core'
import { Rect2, tex, type Platform, type Resource, type Texture } from 'sapling2d'
import { SUPPORTED_VERSION } from './runtime'

// 引擎的 y 轴向下：让 spine-core 直接算出 y 向下的世界坐标（骨架的 scaleY 取负），顶点和骨骼位置不用再翻转
Skeleton.yDown = true

/** 图集页的贴图：spine-core 只要一个 `Texture` 对象挂在 region 上；真正的图片走引擎的贴图管线（`tex()` 句柄）。 */
export class SpinePageTexture extends SpineTexture {
  constructor(readonly handle: Texture) {
    super(null)
  }
  // 采样和环绕方式由引擎的贴图缓存决定（pixelArt 最近邻，其余线性；小游戏下 wrap 只支持 clamp）
  setFilters(): void {}
  setWraps(): void {}
  dispose(): void {}
}

export interface SpineSkeletonOptions {
  /** 图集文件（相对资源目录），默认把骨架文件的扩展名换成 `.atlas`。 */
  atlas?: string
  /** 加载时整体缩放骨架（美术按 2× 出图、运行时缩小），默认 1。作用于骨骼位置、附件尺寸和包围盒。 */
  scale?: number
}

/**
 * Spine 骨架资源：骨架 JSON + 图集 + 图集页的图片。用 `spineSkeleton(path)` 声明，放进场景的 `static assets` 预加载：
 *
 * ```ts
 * class Arena extends Scene {
 *   static assets = { hero: spineSkeleton('hero/hero.json') } // 同目录的 hero.atlas；页图按图集里的文件名（hero.png）在同目录
 *   override ready() {
 *     this.add(new SpineSprite({ skeleton: Arena.assets.hero, animation: 'idle' }))
 *   }
 * }
 * ```
 *
 * 只读 **Spine 4.3** 导出的 JSON（版本不对加载时报错，请用 4.3 的编辑器重新导出；`.skel` 二进制暂不支持）。
 * 图集的 `pma: true`（导出时勾了 premultiply alpha）和不勾都正确。页图走引擎的贴图管线：小游戏分包、切场景卸载都和 `tex()` 一样；
 * 无头测试里页图宽高为 0，但图集文件里带尺寸，UV、包围盒、骨骼位置都正确。
 */
export class SpineSkeleton implements Resource {
  readonly kind = 'spine'
  /** 图集文件的路径。 */
  readonly atlasPath: string
  readonly scale: number
  private _data: SkeletonData | null = null
  private _pages: Texture[] = []
  private _rect = new Rect2(0, 0, 0, 0)
  private _loading: Promise<void> | null = null
  /** @internal 有 slot 用了双色染色（dark tint）：渲染不支持，警告一次。 */
  _darkTintWarned = false

  /** @internal 请使用 spineSkeleton()。 */
  constructor(
    /** 骨架 JSON 的路径（相对资源目录）。 */
    readonly path: string,
    options: SpineSkeletonOptions = {},
  ) {
    this.atlasPath = options.atlas ?? path.replace(/\.[^./]+$/, '') + '.atlas'
    this.scale = options.scale ?? 1
    if (!(this.scale > 0)) throw new Error(`spineSkeleton('${path}'): scale must be > 0, got ${this.scale}.`)
  }

  /** 骨架解析完成且所有页图加载完成。 */
  get isLoaded(): boolean {
    return this._data !== null && this._pages.every((p) => p.isLoaded)
  }

  /** spine-core 的 `SkeletonData`（骨骼、slot、皮肤、动画、事件的定义，所有实例共享）。没加载时报错。 */
  get data(): SkeletonData {
    if (!this._data) throw new Error(`spineSkeleton('${this.path}') is not loaded yet; declare it in the scene's static assets (or preload it from a plugin).`)
    return this._data
  }

  /** 图集页的贴图句柄（加载后）。 */
  get pages(): readonly Texture[] {
    return this._pages
  }

  /** 设置姿势的包围盒（节点局部坐标，y 向下，已含 `scale`）：`SpineSprite` 默认的点击区域。 */
  get rect(): Rect2 {
    this.data
    return this._rect
  }

  get animationNames(): string[] {
    return this.data.animations.map((a) => a.name)
  }

  get skinNames(): string[] {
    return this.data.skins.map((s) => s.name)
  }

  get boneNames(): string[] {
    return this.data.bones.map((b) => b.name)
  }

  get slotNames(): string[] {
    return this.data.slots.map((s) => s.name)
  }

  get eventNames(): string[] {
    return this.data.events.map((e) => e.name)
  }

  /** @internal 由资源加载调用：读骨架和图集文件（只解析一次），页图由引擎按 `_textures()` 加载。 */
  _load(platform: Platform): Promise<void> {
    this._loading ??= this._parse(platform).finally(() => (this._loading = null))
    return this._loading
  }

  /** @internal 图集页的图片：切换场景时按图片判断要不要卸载；还没解析时为空。 */
  _textures(): Texture[] {
    return this._pages
  }

  /** @internal 解析好的数据保留（和 Tiled 关卡一样），切回来时只重新加载页图。 */
  _unload(): void {}

  private async _parse(platform: Platform): Promise<void> {
    if (this._data) return
    const [jsonText, atlasText] = await Promise.all([platform.loadText(this.path), platform.loadText(this.atlasPath)])
    const who = `spineSkeleton('${this.path}')`
    let json: { skeleton?: { spine?: unknown }; bones?: unknown }
    try {
      json = JSON.parse(jsonText) as typeof json
    } catch (err) {
      throw new Error(`${who}: ${this.path} is not valid JSON (${err instanceof Error ? err.message : String(err)}). Export the skeleton as JSON from Spine; .skel binary files are not supported.`)
    }
    if (!json || typeof json !== 'object' || !Array.isArray(json.bones)) throw new Error(`${who}: ${this.path} is not a Spine skeleton export (no "bones").`)
    const version = typeof json.skeleton?.spine === 'string' ? json.skeleton.spine : null
    const majorMinor = version ? version.split('.').slice(0, 2).join('.') : null
    if (majorMinor !== SUPPORTED_VERSION) {
      throw new Error(
        `${who}: exported from Spine ${version ?? '(unknown version)'}, but @sapling2d/spine reads Spine ${SUPPORTED_VERSION} exports (the runtime version must match the editor's major.minor). Re-export it from Spine ${SUPPORTED_VERSION}.`,
      )
    }
    let atlas: TextureAtlas
    try {
      atlas = new TextureAtlas(atlasText)
    } catch (err) {
      throw new Error(`${who}: cannot read the atlas ${this.atlasPath}: ${err instanceof Error ? err.message : String(err)}`)
    }
    const dir = this.atlasPath.includes('/') ? this.atlasPath.slice(0, this.atlasPath.lastIndexOf('/') + 1) : ''
    const pages: Texture[] = []
    for (const page of atlas.pages) {
      const handle = tex(dir + page.name.replace(/^\.\//, ''))
      handle._premultiplied = page.pma
      page.setTexture(new SpinePageTexture(handle))
      pages.push(handle)
    }
    const parser = new SkeletonJson(new AtlasAttachmentLoader(atlas))
    parser.scale = this.scale
    let data: SkeletonData
    try {
      data = parser.readSkeletonData(json)
    } catch (err) {
      throw new Error(`${who}: ${err instanceof Error ? err.message : String(err)} (atlas: ${this.atlasPath})`)
    }
    this._rect = setupBounds(data)
    this._pages = pages
    this._data = data
  }
}

/** 设置姿势的包围盒（y 向下）；没有任何可见附件时为空矩形。 */
function setupBounds(data: SkeletonData): Rect2 {
  const skeleton = new Skeleton(data)
  skeleton.setupPose()
  skeleton.updateWorldTransform(Physics.none)
  const offset = new SpineVector2()
  const size = new SpineVector2()
  skeleton.getBounds(offset, size)
  if (!Number.isFinite(offset.x) || !Number.isFinite(size.x)) return new Rect2(0, 0, 0, 0)
  return new Rect2(offset.x, offset.y, size.x, size.y)
}

const cache = new Map<string, SpineSkeleton>()

/**
 * 声明一个 Spine 骨架（JSON + 图集 + 页图）。路径相对资源目录；图集默认同目录同名 `.atlas`。
 * 同一路径（和同样的选项）返回同一个句柄。
 */
export function spineSkeleton(path: string, options: SpineSkeletonOptions = {}): SpineSkeleton {
  const key = `${path}\0${options.atlas ?? ''}\0${options.scale ?? 1}`
  let r = cache.get(key)
  if (!r) {
    r = new SpineSkeleton(path, options)
    cache.set(key, r)
  }
  return r
}
