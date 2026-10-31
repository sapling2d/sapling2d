import type { AudioServer } from '../audio/AudioServer'
import { AudioStream } from '../audio/AudioStream'
import type { Platform } from '../platform/Platform'
import { assetResources, assetRoot, loadTexture, type AssetMap, type Resource, type Texture } from './assets'

/** 启动时准备资源包（`Platform.prepareAssets`）占加载进度的比例，其余是加载入口场景的资源。 */
const PREPARE_SHARE = 0.7

/**
 * 资源的加载、钉住和卸载，通过 `tree.assets` 访问。场景切换（`changeScene`）、启动序列和插件的 `preload` 都走它；
 * 游戏也可以在运行中按需加载：`await this.tree.assets.load({ boss: tex('boss.png') })`。
 *
 * - 已加载的跳过，同一资源并发请求只加载一次；图集和子区域归结到整张图；音乐是流式的，不预加载。
 * - 加载失败时 `load` 报错（指出是哪个文件）。
 */
export class AssetLoader {
  private readonly _platform: Platform | null
  private readonly _audio: AudioServer
  private _progress = 1
  /** 钉住的资源（`preload`）：切场景时不卸载。存声明的句柄，判断时再展开（自定义资源的图片要加载后才知道）。 */
  private readonly _pinned: AssetMap[string][] = []
  /** 插件登记的资源：和入口场景的资源一起在启动时加载。 */
  private readonly _preloaded: AssetMap[string][] = []

  /** `platform` 为 null 时什么都不加载（裸 SceneTree 的默认）：`load` 立即完成，贴图宽高为 0。 */
  constructor(platform: Platform | null, audio: AudioServer) {
    this._platform = platform
    this._audio = audio
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

  /** @internal 切换场景后卸载旧场景独有的资源：新场景用到的（哪怕是另一种写法）、插件钉住的（和它们的图片）都保留。 */
  _unloadUnused(oldAssets: AssetMap | undefined, newAssets: AssetMap | undefined): void {
    if (!oldAssets) return
    // 图集、子区域、Tiled 关卡的图块集都归结到整张图
    const keep = new Set([...Object.values(newAssets ?? {}), ...this._pinned].flatMap(assetResources))
    for (const asset of new Set(Object.values(oldAssets).flatMap(assetResources))) if (!keep.has(asset)) asset._unload()
  }

  /** `onProgress(done)`：每完成一个资源回调一次，`done` 是已完成的比例（0..1，按资源个数）。 */
  private async _loadAll(assets: AssetMap[string][], onProgress: (done: number) => void): Promise<void> {
    const platform = this._platform
    if (!platform || assets.length === 0) return
    const roots = [...new Set(assets.map(assetRoot))]
    let finished = 0
    const report = () => onProgress(++finished / roots.length)
    await Promise.all(
      roots.map((asset) => {
        const p = this._loadOne(asset, platform)
        return p ? p.then(report) : report()
      }),
    )
  }

  private _loadOne(asset: Texture | AudioStream | Resource, platform: Platform): Promise<void> | undefined {
    if (asset.isLoaded) return undefined
    if (asset instanceof AudioStream) {
      return this._audio._load(asset).catch((err: unknown) => {
        throw new Error(`Failed to load sound "${asset.path}": ${err instanceof Error ? err.message : String(err)}`)
      })
    }
    // 自定义资源：先解析，再加载它声明的图片（已加载的跳过）
    if ('_load' in asset) return asset._load(platform).then(() => Promise.all((asset._textures?.() ?? []).map((t) => loadTexture(t._base ?? t, platform)))).then(() => undefined)
    return loadTexture(asset, platform)
  }
}
