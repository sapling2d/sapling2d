import { describe, expect, it } from 'vitest'
import { Node2D, Scene, tex, type Plugin, type Platform, type Resource, type Texture } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'
import { Container } from 'pixi.js'
import { PixiRenderer, registerNodeContent, type NodeContent, type RenderContext } from 'sapling2d/render'

/** 一个只实现 `Resource` 协议的假资源：读一个文本文件，里面列出它用到的图片。 */
class Manifest implements Resource {
  readonly kind = 'manifest'
  loads = 0
  unloads = 0
  private _list: Texture[] | null = null
  constructor(readonly path: string) {}
  get isLoaded(): boolean {
    return this._list !== null && this._list.every((t) => t.isLoaded)
  }
  async _load(platform: Platform): Promise<void> {
    this.loads++
    if (!this._list) this._list = (await platform.loadText(this.path)).split('\n').filter(Boolean).map((p) => tex(p))
  }
  _unload(): void {
    this.unloads++
  }
  _textures(): Texture[] {
    return this._list ?? []
  }
}

/** 文本资源从 assetsDir 读真实文件（和 Tiled 关卡一样）。 */
const ASSETS = 'test/fixtures/resource'

describe('Resource 协议（自定义资源）', () => {
  it('放进 static assets：_load 被调用，它声明的图片随后加载；isLoaded 在 ready 之前为 true', async () => {
    const res = new Manifest('a.txt')
    let loadedInReady = false
    class Main extends Scene {
      static override assets = { res }
      override ready() {
        loadedInReady = res.isLoaded
      }
    }
    await createTestGame({ main: Main, assetsDir: ASSETS })
    expect(loadedInReady).toBe(true)
    expect(res.loads).toBe(1)
    expect(res._textures().map((t) => t.path)).toEqual(['res-a.png', 'res-shared.png'])
    expect(res._textures().every((t) => t.isLoaded)).toBe(true)
  })

  it('切场景：旧场景独有的资源 _unload 并卸载它的图片；两个资源共用的图片保留；切回来时只重新加载图片（数据保留）', async () => {
    const a = new Manifest('a.txt')
    const b = new Manifest('b.txt')
    class SceneA extends Scene {
      static override assets = { a }
    }
    class SceneB extends Scene {
      static override assets = { b }
    }
    const g = await createTestGame({ main: SceneA, assetsDir: ASSETS })
    const shared = tex('res-shared.png')
    await g.tree.changeScene(SceneB)
    expect(a.unloads).toBe(1)
    expect(tex('res-a.png').isLoaded).toBe(false)
    expect(shared.isLoaded).toBe(true) // b 也用它
    expect(b.isLoaded).toBe(true)
    await g.tree.changeScene(SceneA)
    expect(a.loads).toBe(2) // 幂等：第二次只补图片
    expect(a.isLoaded).toBe(true)
    expect(tex('res-a.png').isLoaded).toBe(true)
    expect(tex('res-b.png').isLoaded).toBe(false)
  })

  it('插件 preload 钉住的资源：它的图片在切场景时也不卸载（哪怕旧场景列了同一张图）', async () => {
    const pinned = new Manifest('a.txt')
    const plugin: Plugin = { install: (ctx) => ctx.preload({ pinned }) }
    class SceneA extends Scene {
      static override assets = { a: tex('res-a.png') }
    }
    class SceneB extends Scene {}
    const g = await createTestGame({ main: SceneA, assetsDir: ASSETS, plugins: [plugin] })
    expect(pinned.isLoaded).toBe(true)
    await g.tree.changeScene(SceneB)
    expect(tex('res-a.png').isLoaded).toBe(true)
    expect(pinned.unloads).toBe(0)
  })
})

describe('registerNodeContent（sapling2d/render）', () => {
  class Blob extends Node2D {
    radius = 10
  }
  class Dot extends Blob {}

  it('登记的节点类型在首次同步时创建内容，每帧 sync；未登记的 Node2D 子类只有容器；重复登记覆盖', async () => {
    const log: string[] = []
    class BlobContent implements NodeContent<Blob> {
      readonly display = new Container({ label: '__content' })
      sync(node: Blob, ctx: RenderContext, changed: boolean) {
        log.push(`sync r=${node.radius} changed=${changed} pixelArt=${ctx.pixelArt}`)
      }
      destroy() {
        log.push('destroy')
      }
    }
    registerNodeContent(Blob, () => new BlobContent())
    const g = await createTestGame({ main: Scene })
    const r = PixiRenderer._createForSyncTests()
    const blob = g.scene.add(new Blob({ name: 'B' }))
    const dot = g.scene.add(new Dot({ name: 'D' })) // 子类也匹配（instanceof）
    const plain = g.scene.add(new Node2D({ name: 'P' }))
    r.sync(g.tree)
    expect((blob.unsafePixi as Container).children.map((c) => c.label)).toEqual(['__content'])
    expect((dot.unsafePixi as Container).children.map((c) => c.label)).toEqual(['__content'])
    expect((plain.unsafePixi as Container).children).toHaveLength(0)
    expect(log).toEqual(['sync r=10 changed=true pixelArt=false', 'sync r=10 changed=true pixelArt=false'])
    log.length = 0
    r.sync(g.tree)
    expect(log).toEqual(['sync r=10 changed=false pixelArt=false', 'sync r=10 changed=false pixelArt=false'])
    log.length = 0
    blob.queueFree()
    g.step()
    r.sync(g.tree)
    expect(log).toEqual(['sync r=10 changed=false pixelArt=false', 'destroy'])

    // 重复登记：后者覆盖
    registerNodeContent(Blob, () => ({ display: new Container({ label: '__other' }), sync() {}, destroy() {} }))
    const again = g.scene.add(new Blob())
    r.sync(g.tree)
    expect((again.unsafePixi as Container).children.map((c) => c.label)).toEqual(['__other'])
  })

  it('ctx.textures.get 把贴图句柄换成 Pixi 贴图：没加载时是 EMPTY，加载后是缓存的贴图', async () => {
    let seen: unknown[] = []
    class TexNode extends Node2D {
      texture = tex('rn-a.png')
    }
    registerNodeContent(TexNode, () => ({
      display: new Container(),
      sync(node: TexNode, ctx: RenderContext) {
        seen.push(ctx.textures.get(node.texture))
      },
      destroy() {},
    }))
    const g = await createTestGame({ main: Scene })
    const r = PixiRenderer._createForSyncTests()
    const n = g.scene.add(new TexNode())
    r.sync(g.tree)
    expect(seen[0]).toMatchObject({ label: 'EMPTY' })
    n.texture._setLoaded({ width: 8, height: 8 }, 8, 8)
    seen = []
    r.sync(g.tree)
    expect(seen[0]).not.toMatchObject({ label: 'EMPTY' })
    expect(r._textureCount).toBe(1)
  })
})

describe('Texture._premultiplied', () => {
  it('预乘过的图片创建的 ImageSource 不再预乘（alphaMode premultiplied-alpha），其它图片默认', async () => {
    class Pma extends Node2D {
      a = tex('pma-yes.png')
      b = tex('pma-no.png')
    }
    const sources: string[] = []
    registerNodeContent(Pma, () => ({
      display: new Container(),
      sync(node: Pma, ctx: RenderContext) {
        sources.push(ctx.textures.get(node.a).source.alphaMode, ctx.textures.get(node.b).source.alphaMode)
      },
      destroy() {},
    }))
    const g = await createTestGame({ main: Scene })
    const r = PixiRenderer._createForSyncTests()
    const n = g.scene.add(new Pma())
    n.a._premultiplied = true
    n.a._setLoaded({ width: 8, height: 8 }, 8, 8)
    n.b._setLoaded({ width: 8, height: 8 }, 8, 8)
    r.sync(g.tree)
    expect(sources).toEqual(['premultiplied-alpha', 'premultiply-alpha-on-upload'])
  })
})
