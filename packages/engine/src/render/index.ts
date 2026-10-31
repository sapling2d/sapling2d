/**
 * `sapling2d/render`：渲染层的扩展点，给带自己节点类型的插件（如 `@sapling2d/spine`）用。
 * - `registerNodeContent(cls, create)`：给一个 Node2D 子类登记它的 Pixi 内容（见 `NodeContent`、`RenderContext`）。
 * - `PixiRenderer`：引擎的渲染器；`_createForSyncTests()` 在 Node 里只做场景树到显示对象的同步，用来测试插件的内容。
 * 这个入口依赖 pixi.js；游戏代码不需要它。
 */
export { registerNodeContent, CONTENT_LABEL, type NodeContent, type RenderContext } from './NodeContent'
export { PixiRenderer, type PixiRendererOptions } from './PixiRenderer'
