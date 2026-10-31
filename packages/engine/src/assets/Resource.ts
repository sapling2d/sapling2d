import type { Platform } from '../platform/Platform'
import type { Texture } from './Texture'

/**
 * 资源协议：能放进 `static assets` / `PluginContext.preload` / `tree.assets.load()` 的东西。引擎按同一套规则加载、去重、切场景时卸载。
 * 内置的贴图、图集、图块集、音效都实现它；插件自己的资源格式（Spine 骨骼、Live2D 模型……）实现它就能一样用，`TiledMap` 就是这样一个资源。
 *
 * - `_load(platform)`：读文件、解析；要幂等（已经解析过就只补没加载的部分），同一个资源并发调用只做一次。
 *   它用到的图片用 `tex()` 声明成句柄并从 `_textures()` 返回，引擎在 `_load` 之后加载它们（无头模式下宽高为 0）。
 * - `isLoaded`：解析完且 `_textures()` 里的图片都加载完；为 true 时引擎跳过加载。
 * - `_unload()`：切场景时旧场景独有的资源会被调用，释放自己的数据；图片是单独的资源，由引擎按 `_textures()` 另外判断、另外卸载，
 *   所以这里通常只需要把解析好的数据留着（切回来时只重新加载图片）。
 * - `_textures()`：用到的图片句柄；还没解析时返回空数组。整张图自己返回空数组，子区域返回它所在的整张图。
 */
export interface Resource {
  /** 资源种类（插件自己起名，如 `'spine'`），dump 和报错用。 */
  readonly kind: string
  /** 主文件的路径（相对资源目录）。 */
  readonly path: string
  readonly isLoaded: boolean
  _load(platform: Platform): Promise<void>
  _unload(): void
  _textures(): Texture[]
}

/** 场景的 `static assets` 声明：贴图（tex）、图集（sheet / atlas / aseprite）、图块集（tileset）、Tiled 关卡（tiledMap）、音效（sfx）、音乐（music），以及插件的资源，都是 `Resource`。 */
export type AssetMap = Record<string, Resource>
