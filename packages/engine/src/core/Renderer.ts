import type { SceneTree } from './SceneTree'

/** 渲染器接口：每帧把场景树同步到画面。无头模式没有渲染器；`sapling2d/render` 的 `PixiRenderer` 是它的实现。 */
export interface Renderer {
  render(tree: SceneTree): void
  destroy(): void
}
