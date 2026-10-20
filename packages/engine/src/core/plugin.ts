import type { Platform } from '../platform/Platform'
import type { AssetMap } from './assets'
import type { SceneTree } from './SceneTree'

/** 服务的 token：通常就是服务的类本身（`tree.get(Keyboard)`）。 */
export type ServiceToken<T> = abstract new (...args: never[]) => T

/** 插件安装时拿到的东西。 */
export interface PluginContext {
  readonly tree: SceneTree
  /** 平台。插件按 `platform.kind` 选择自己的实现；不支持的平台用 mock，不要抛错。 */
  readonly platform: Platform
  /** 提供一个服务，游戏之后用 `tree.get(token)` 取。同一个 token 提供两次报错。 */
  provide<T>(token: ServiceToken<T>, service: T): void
  /**
   * 登记插件自己的资源（默认皮肤之类，路径一般是 `~<包名>/...`，见 ADR 0011）：和入口场景的资源一起在启动时加载
   * （资源分包下载之后，进度合并成一条），并且钉住——切场景时不卸载，哪怕某个场景也列了同一张图又切走了。
   */
  preload(assets: AssetMap): void
}

/**
 * 插件：平台差异化的能力（键盘、传感器、手柄、小游戏的广告 / 分享）都以插件的形式接入，核心不认识它们。
 * 在启动参数里安装：`startGame({ main, plugins: [motion()] })`。
 *
 * - `install` 在 `Game.create` 建好场景树之后、定义动作和加入口场景之前按顺序调用一次；返回的函数在 `game.destroy()` 时调用。
 * - 输入类插件把自己登记成 `tree.input.addSource(...)`，向 `window` / `wx` 自己注册监听，事件用 `tree.input.enqueue` 入队。
 * - 必须在浏览器、小游戏、无头三个平台上都能安装：不支持的平台装一个 mock（`console.info` 一次），游戏照常跑。
 */
export interface Plugin {
  install(ctx: PluginContext): (() => void) | void
}
