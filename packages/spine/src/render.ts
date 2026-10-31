import { ClippingAttachment, MeshAttachment, RegionAttachment, SkeletonClipping, type Attachment, type Slot } from '@esotericsoftware/spine-core'
import { Container, Mesh, MeshGeometry, Texture as PixiTexture, type BLEND_MODES } from 'pixi.js'
import type { Texture } from 'sapling2d'
import { CONTENT_LABEL, type NodeContent, type RenderContext } from 'sapling2d/render'
import { SpinePageTexture } from './resource'
import type { SpineSprite } from './SpineSprite'

/** 同一时间只有一个节点在同步（单线程）：裁剪器共用一个，它的输出缓冲区在用完前拷走。 */
const clipper = new SkeletonClipping()
const QUAD = [0, 1, 2, 2, 3, 0]
/** spine 的 BlendMode（Normal 0、Additive 1、Multiply 2、Screen 3）→ Pixi。Normal 跟随节点（`inherit`），整只角色设成叠加时也对。 */
const BLEND: readonly BLEND_MODES[] = ['inherit', 'add', 'multiply', 'screen']

/** 一个（slot, 附件）对应的 Pixi 网格和它的顶点缓存。附件固定时顶点数固定：每帧只往同一个数组里写。 */
interface SlotView {
  mesh: Mesh
  geometry: MeshGeometry
  /** 未裁剪的世界顶点（x, y 交错）。 */
  vertices: Float32Array
  indices: Uint16Array
  /** 几何当前用的 uv 数组（spine 按 sequence 帧缓存的对象，变了才赋值）。 */
  uvs: Float32Array | null
  /** 裁剪后的几何（只在被裁剪时分配、按需扩容）；几何正在用它时 `clipped` 为 true。 */
  clipped: boolean
  cVertices: Float32Array
  cUvs: Float32Array
  cIndices: Uint16Array
  handle: Texture | null
  resource: unknown
  tint: number
  alpha: number
  blend: BLEND_MODES | null
}

/**
 * `SpineSprite` 的渲染内容：按绘制顺序每个 slot 一个 Pixi `Mesh`（标准着色器、`batchMode: 'batch'`，和精灵一起合批），
 * 顶点由 spine-core 算（`computeWorldVertices`），裁剪用 `SkeletonClipping`，颜色 = 骨架 × slot × 附件 × `selfModulate`，混合模式按 slot。
 * 只在姿势变了（`_poseVersion`）、`selfModulate` 变了或页图加载完成时重算；每帧不分配内存（附件第一次出现、裁剪后顶点数变化时除外）。
 * 双色染色（tint black）不支持：忽略 dark color，每个资源警告一次。
 */
export class SpineContent implements NodeContent<SpineSprite> {
  readonly display: Container
  private readonly _views: Map<Attachment, SlotView>[] = []
  /** 本次同步可见的网格，按绘制顺序（复用）。 */
  private readonly _order: Mesh[] = []
  private _poseVersion = -1
  private _modulate = -1
  /** 上次同步时各页图背后的资源：页图后来才加载完成时要重新取贴图。 */
  private readonly _pageResources: unknown[] = []
  private readonly _pixelArt: boolean

  constructor(node: SpineSprite, ctx: RenderContext) {
    this.display = new Container({ label: CONTENT_LABEL })
    this._pixelArt = ctx.pixelArt
    const n = node.spine.slots.length
    for (let i = 0; i < n; i++) this._views.push(new Map())
  }

  sync(node: SpineSprite, ctx: RenderContext): void {
    if (!node.visible) return
    const modulate = node.selfModulate
    // 页图的检查每次都做（不能短路）：第一次同步就记下各页的资源，之后只在真的变了时重算
    const pagesChanged = this._pagesChanged(node)
    if (node._poseVersion === this._poseVersion && modulate === this._modulate && !pagesChanged) return
    this._poseVersion = node._poseVersion
    this._modulate = modulate
    const skeleton = node.spine
    const drawOrder = skeleton.drawOrder.appliedPose
    const order = this._order
    order.length = 0
    const skeletonColor = skeleton.color
    for (let i = 0; i < drawOrder.length; i++) {
      const slot = drawOrder[i]!
      const pose = slot.appliedPose
      const attachment = pose.attachment
      if (!slot.bone.active) {
        clipper.clipEnd(slot)
        continue
      }
      if (attachment instanceof ClippingAttachment) {
        clipper.clipEnd(slot)
        clipper.clipStart(skeleton, slot, attachment)
        continue
      }
      if (attachment instanceof RegionAttachment || attachment instanceof MeshAttachment) {
        const slotColor = pose.color
        const attachmentColor = attachment.color
        const alpha = skeletonColor.a * slotColor.a * attachmentColor.a
        if (alpha > 0) {
          const view = this._view(slot, attachment)
          if (attachment instanceof RegionAttachment) attachment.computeWorldVertices(slot, attachment.getOffsets(pose), view.vertices, 0, 2)
          else attachment.computeWorldVertices(skeleton, slot, 0, attachment.worldVerticesLength, view.vertices, 0, 2)
          const sequence = attachment.sequence
          const index = sequence.resolveIndex(pose)
          const uvs = sequence.getUVs(index)
          if (this._upload(view, uvs)) {
            const mesh = view.mesh
            const r = skeletonColor.r * slotColor.r * attachmentColor.r
            const g = skeletonColor.g * slotColor.g * attachmentColor.g
            const b = skeletonColor.b * slotColor.b * attachmentColor.b
            const tint = multiplyColor(rgb(r, g, b), modulate)
            if (tint !== view.tint) mesh.tint = view.tint = tint
            if (alpha !== view.alpha) mesh.alpha = view.alpha = alpha
            const blend = BLEND[slot.data.blendMode] ?? 'inherit'
            if (blend !== view.blend) mesh.blendMode = view.blend = blend
            if (pose.darkColor && !node.skeleton._darkTintWarned) {
              node.skeleton._darkTintWarned = true
              console.warn(`[@sapling2d/spine] ${node.skeleton.path}: slot "${slot.data.name}" uses tint black (two-color tinting), which is not rendered; the dark color is ignored.`)
            }
            const page = sequence.regions[index]?.texture as SpinePageTexture | null | undefined
            const handle = page?.handle ?? null
            const resource = handle?._resource
            if (handle !== view.handle || resource !== view.resource) {
              view.handle = handle
              view.resource = resource
              mesh.texture = handle ? ctx.textures.get(handle) : PixiTexture.EMPTY
            }
            order.push(mesh)
          }
        }
      }
      clipper.clipEnd(slot)
    }
    clipper.clipEnd()
    this._reorder()
  }

  destroy(): void {
    for (const views of this._views) {
      for (const view of views.values()) {
        view.mesh.destroy()
        view.geometry.destroy()
      }
      views.clear()
    }
    this.display.destroy({ children: false })
  }

  /** 页图的资源变了（加载完成、卸载后重载）。 */
  private _pagesChanged(node: SpineSprite): boolean {
    const pages = node.skeleton.pages
    const seen = this._pageResources
    let changed = seen.length !== pages.length
    for (let i = 0; i < pages.length; i++) {
      const resource = pages[i]!._resource
      if (seen[i] !== resource) {
        seen[i] = resource
        changed = true
      }
    }
    seen.length = pages.length
    return changed
  }

  private _view(slot: Slot, attachment: RegionAttachment | MeshAttachment): SlotView {
    const views = this._views[slot.data.index]!
    let view = views.get(attachment)
    if (view) return view
    const vertices = new Float32Array(attachment instanceof RegionAttachment ? 8 : attachment.worldVerticesLength)
    const indices = new Uint16Array(attachment instanceof RegionAttachment ? QUAD : attachment.triangles)
    // 索引用 16 位：iOS 小游戏的 WebGL1 没有 32 位索引
    const geometry = new MeshGeometry({ positions: vertices, uvs: new Float32Array(vertices.length), indices: indices as unknown as Uint32Array })
    geometry.batchMode = 'batch'
    const mesh = new Mesh({ geometry, texture: PixiTexture.EMPTY, roundPixels: this._pixelArt, label: `${slot.data.name}/${attachment.name}` })
    view = { mesh, geometry, vertices, indices, uvs: null, clipped: false, cVertices: EMPTY_F32, cUvs: EMPTY_F32, cIndices: EMPTY_U16, handle: null, resource: undefined, tint: -1, alpha: -1, blend: null }
    views.set(attachment, view)
    return view
  }

  /** 把本帧的顶点（裁剪过的或原始的）写进几何。返回 false 表示整个被裁掉，不显示。 */
  private _upload(view: SlotView, uvs: Float32Array): boolean {
    const geometry = view.geometry
    if (clipper.isClipping()) {
      clipper.clipTrianglesUnpacked(view.vertices, 0, view.indices, view.indices.length, uvs)
      const nv = clipper.clippedVerticesLength
      const ni = clipper.clippedTrianglesLength
      if (ni === 0) return false
      // 裁剪后顶点数每帧都可能变：按精确长度分配（Pixi 按数组长度算顶点数和索引数）
      if (view.cVertices.length !== nv) {
        view.cVertices = new Float32Array(nv)
        view.cUvs = new Float32Array(nv)
      }
      if (view.cIndices.length !== ni) view.cIndices = new Uint16Array(ni)
      const cv = view.cVertices
      const cu = view.cUvs
      const ci = view.cIndices
      const sv = clipper.clippedVerticesTyped
      const su = clipper.clippedUVsTyped
      const si = clipper.clippedTrianglesTyped
      for (let i = 0; i < nv; i++) {
        cv[i] = sv[i]!
        cu[i] = su[i]!
      }
      for (let i = 0; i < ni; i++) ci[i] = si[i]!
      // 同一个数组对象重新赋值也会上传（Buffer.data 的 setter 不比较引用）
      geometry.positions = cv
      geometry.uvs = cu
      geometry.indices = ci as unknown as Uint32Array
      view.clipped = true
      view.uvs = null
      return true
    }
    if (view.clipped) {
      geometry.positions = view.vertices
      geometry.indices = view.indices as unknown as Uint32Array
      view.clipped = false
    } else {
      geometry.getBuffer('aPosition').update()
    }
    if (view.uvs !== uvs) {
      geometry.uvs = uvs
      view.uvs = uvs
    }
    return true
  }

  /** 子对象 = 本次可见的网格，按绘制顺序；不一致时才重建。 */
  private _reorder(): void {
    const order = this._order
    const children = this.display.children
    let same = children.length === order.length
    for (let i = 0; same && i < order.length; i++) same = children[i] === order[i]
    if (same) return
    this.display.removeChildren()
    for (let i = 0; i < order.length; i++) this.display.addChild(order[i]!)
  }
}

const EMPTY_F32 = new Float32Array(0)
const EMPTY_U16 = new Uint16Array(0)

/** 0–1 的 r、g、b → 0xRRGGBB。 */
function rgb(r: number, g: number, b: number): number {
  return ((r * 255 + 0.5) << 16) | ((g * 255 + 0.5) << 8) | (b * 255 + 0.5)
}

/** 两个 0xRRGGBB 按通道相乘。 */
function multiplyColor(a: number, b: number): number {
  if (b === 0xffffff) return a
  let out = 0
  for (let shift = 16; shift >= 0; shift -= 8) out |= Math.round((((a >> shift) & 0xff) * ((b >> shift) & 0xff)) / 255) << shift
  return out
}
