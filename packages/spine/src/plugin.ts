import type { Plugin } from 'sapling2d'
import { registerNodeContent } from 'sapling2d/render'
import { SpineContent } from './render'
import { SpineRuntime } from './runtime'
import { SpineSprite } from './SpineSprite'

/**
 * Spine 插件：登记 `SpineSprite` 的渲染内容、提供 `SpineRuntime` 服务。三个平台都能装（无头下登记没有渲染器用，无害）。
 * `startGame({ main, plugins: [spine()] })`。没装时 `SpineSprite` 进树报错。
 */
export function spine(): Plugin {
  return {
    install(ctx) {
      registerNodeContent(SpineSprite, (node, rc) => new SpineContent(node, rc))
      ctx.provide(SpineRuntime, new SpineRuntime())
    },
  }
}
