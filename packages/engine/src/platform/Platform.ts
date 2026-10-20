import type { AudioBackend } from '../audio/backend'
import type { RawPointerEvent } from '../core/Input'
import type { StorageBackend } from '../storage/backend'
import type { ScreenInfo } from '../core/Viewport'

/** 平台加载出的图片：原始对象只由渲染层使用，核心代码只看宽高。 */
export interface LoadedImage {
  resource: unknown
  width: number
  height: number
}

/** 平台种类。插件按它选择自己的实现（见 `Plugin`）；核心不看它。 */
export type PlatformKind = 'browser' | 'wechat' | 'headless'

/**
 * 引擎访问外部世界的唯一接口。核心代码不允许直接使用 window、document 或 wx，
 * 一律通过 Platform（见 CONTEXT.md）。平台只提供每个平台都有的东西；键盘、传感器这类平台差异化的能力由插件自己接入。
 */
export interface Platform {
  readonly kind: PlatformKind
  /** 平台的音频实现。 */
  readonly audio: AudioBackend
  /** 平台的键值存储。 */
  readonly storage: StorageBackend
  /** 单调递增的时间，单位毫秒。 */
  now(): number
  /** 在下一帧调用 callback，返回可用于取消的 id。 */
  requestFrame(callback: (timeMs: number) => void): number
  cancelFrame(id: number): void
  /** 加载一张图片。`path` 相对于游戏的资源目录。 */
  loadImage(path: string): Promise<LoadedImage>
  /**
   * 可选：启动时、加载入口场景的资源之前准备资源包（微信小游戏下载资源分包）。`onProgress` 汇报 0..1。
   * 启动页的资源在这之前加载，所以必须不依赖这一步（小游戏里放在主包）。
   */
  prepareAssets?(onProgress: (done: number) => void): Promise<void>
  /** 读取一个文本文件（关卡 JSON 等）。`path` 相对于游戏的资源目录。 */
  loadText(path: string): Promise<string>
  /** 当前屏幕信息（窗口逻辑像素）。 */
  getScreenInfo(): ScreenInfo
  /** 屏幕尺寸、方向或 DPR 变化时回调。返回取消订阅的函数。 */
  onScreenChange(callback: (screen: ScreenInfo) => void): () => void
  /** 订阅原始指针事件（坐标为窗口逻辑像素）。平台只产指针事件，其它设备由插件自己监听。返回取消订阅的函数。 */
  onInput(callback: (event: RawPointerEvent) => void): () => void
  /** 游戏切到后台（false）或回到前台（true）。浏览器是 visibilitychange，小游戏是 wx.onHide / onShow。 */
  onFocusChange(callback: (focused: boolean) => void): () => void
}
