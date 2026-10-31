import type { Platform } from '../platform/Platform'
import type { AssetMap, Resource } from './assets'

/** 启动时准备资源包（`Platform.prepareAssets`）占加载进度的比例，其余是加载入口场景的资源。 */
const PREPARE_SHARE = 0.7

/**
 * 资源的加载、钉住和卸载，通过 `tree.assets` 访问。场景切换（`changeScene`）、启动序列和插件的 `preload` 都走它；
 * 游戏也可以在运行中按需加载：`await this.tree.assets.load({ boss: tex('boss.png') })`。
 *
 * 所有资源都按 `Resource` 协议处理，加载器不认识具体类型：先 `_load`，再加载 `_textures()` 列出的图片；
 * 已加载的跳过，同一资源并发请求只加载一次（整张图在 `Texture` 里去重）；加载失败时报错（指出是哪个文件）。
 */
export class AssetLoader {
  private readonly _platform: Platform | null
  private _progress = 1
  /** 钉住的资源（`preload`）：切场景时不卸载。存声明的句柄，判断时再展开（自定义资源的图片要加载后才知道）。 */
  private readonly _pinned: Resource[] = []
  /** 插件登记的资源：和入口场景的资源一起在启动时加载。 */
  private readonly _preloaded: Resource[] = []

  /** `platform` 为 null 时什么都不加载（裸 SceneTree 的默认）：`load` 立即完成，贴图宽高为 0。 */
  constructor(platform: Platform | null) {
    this._platform = platform
  }

  /**
   * 加载进度，0..1：每次 `load`（包括 `changeScene`）从 0 增加到 1（按资源个数），平时是 1。
   * 启动时（启动页显示期间）包括准备资源包（微信小游戏下载资源分包）和加载入口场景的资源。
   * 启动页里用它画进度条：`this.bar.scale = v(this.tree.assets.progress, 1)`。
   */
  get progress(): number {
    return this._progress
  }

  /** 加载一组资源（`static assets` 那样的声明）。期间 `progress` 从 0 走到 1。 */
  async load(assets: AssetMap | undefined): Promise<void> {
    this._progress = 0
    await this._loadAll(Object.values(assets ?? {}), (done) => (this._progress = done))
    this._progress = 1
  }

  /**
   * 登记插件自己的资源（`PluginContext.preload`）：和入口场景的资源一起在启动时加载，并且钉住——
   * 切场景时不卸载，哪怕某个场景也列了同一张图又切走了。
   */
  preload(assets: AssetMap): void {
    const list = Object.values(assets)
    this._preloaded.push(...list)
    this._pinned.push(...list)
  }

  /**
   * @internal 启动序列（由 Game 在启动页进入树之后调用）：先准备资源包（`Platform.prepareAssets`，占进度的前 70%），
   * 再把插件登记的资源和入口场景的资源一起加载完（占其余 30%；没有准备这一步时占全部）。
   */
  async _startup(main: AssetMap | undefined): Promise<void> {
    let from = 0
    if (this._platform?.prepareAssets) {
      this._progress = 0
      await this._platform.prepareAssets((done) => (this._progress = done * PREPARE_SHARE))
      from = PREPARE_SHARE
    }
    this._progress = from
    await this._loadAll([...this._preloaded, ...Object.values(main ?? {})], (done) => (this._progress = from + done * (1 - from)))
    this._progress = 1
  }

  /**
   * @internal 切换场景后卸载旧场景独有的资源。判断的单位是资源和它用到的整张图（`_textures()`）：
   * 新场景用到的（哪怕是另一种写法：`tex()` 和 `sheet()` 同一张图）、插件钉住的（和它们的图片）都保留。
   */
  _unloadUnused(oldAssets: AssetMap | undefined, newAssets: AssetMap | undefined): void {
    if (!oldAssets) return
    const keep = new Set(expand([...Object.values(newAssets ?? {}), ...this._pinned]))
    for (const r of new Set(expand(Object.values(oldAssets)))) if (!keep.has(r)) r._unload()
  }

  /** `onProgress(done)`：每完成一个资源回调一次，`done` 是已完成的比例（0..1，按资源个数）。 */
  private async _loadAll(assets: Resource[], onProgress: (done: number) => void): Promise<void> {
    const platform = this._platform
    if (!platform || assets.length === 0) return
    const resources = [...new Set(assets)]
    let finished = 0
    const report = () => onProgress(++finished / resources.length)
    await Promise.all(
      resources.map((r) => {
        const p = loadResource(r, platform)
        return p ? p.then(report) : report()
      }),
    )
  }
}

/** 资源和它用到的整张图（子区域再归结到整张图）。 */
function expand(list: Resource[]): Resource[] {
  return list.flatMap((r) => [r, ...r._textures().flatMap((t) => [t, ...t._textures()])])
}

/** 已加载的跳过（返回 undefined，调用方同步计进度）；否则先 `_load`，再加载它声明的图片。 */
function loadResource(r: Resource, platform: Platform): Promise<void> | undefined {
  if (r.isLoaded) return undefined
  return r
    ._load(platform)
    .then(() => Promise.all(r._textures().map((t) => t._load(platform))))
    .then(() => undefined)
}
