import { MaxRectsPacker } from 'maxrects-packer'

/**
 * @sapling2d/pack：把一组图片打成图集，输出 sapling2d 的 `atlas()` 直接能读的图集 JSON（JSON Hash，和 TexturePacker / Pixi / Phaser 同一种格式）。
 *
 * 核心是纯函数：输入 RGBA 像素，输出每页的 RGBA 像素和 JSON 对象，不读写文件、不编解码图片（编码由调用方决定：
 * 命令行 `sapling-pack` 用 pngjs，游戏自己的美术管线可以用 sharp 做调色板量化）。同样的输入得到同样的输出。
 */

/** RGBA 像素（每像素 4 字节，非预乘 alpha，按行存）。 */
export interface RawImage {
  data: Uint8Array
  width: number
  height: number
}

/** 要打包的一张图。 */
export interface PackSprite {
  /** 帧名（`atlas().get(name)` 用的名字），在整个图集里唯一。 */
  name: string
  image: RawImage
  /** 锚点（0–1，相对裁剪前的原始尺寸），原样写进 JSON 的 `pivot`。 */
  pivot?: { x: number; y: number }
}

export interface PackOptions {
  /** 单页的最大边长（像素）。默认 2048（小游戏上的安全值）。 */
  maxSize?: number
  /** 帧之间的间距（像素），避免采样时串到旁边的帧。默认 2。 */
  padding?: number
  /** 裁掉透明边（JSON 里 `trimmed: true`，帧的尺寸仍是原图的）。默认 true。 */
  trim?: boolean
  /** 附加到每页 `meta` 的字段（同名的覆盖默认值）。 */
  meta?: Record<string, unknown>
}

/** 一帧（JSON Hash 格式）。 */
export interface PackedFrame {
  frame: { x: number; y: number; w: number; h: number }
  rotated: false
  trimmed: boolean
  spriteSourceSize: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
  pivot?: { x: number; y: number }
}

/** 一页的图集 JSON：`atlas(image, json)` 直接读；多页时 `atlas([图…], [json…])`。 */
export interface PackedAtlasData {
  frames: Record<string, PackedFrame>
  meta: { app: string; image: string; format: 'RGBA8888'; size: { w: number; h: number }; [key: string]: unknown }
}

export interface PackedPage {
  /** 这一页的文件名（`meta.image`）：单页时是 `<name>.png`，多页时是 `<name>-0.png`、`<name>-1.png`…… */
  file: string
  image: RawImage
  json: PackedAtlasData
}

interface Placed {
  width: number
  height: number
  x: number
  y: number
  sprite: PackSprite
  /** 裁剪后留下的部分在原图里的位置。 */
  src: { x: number; y: number; w: number; h: number }
}

/**
 * 把 `sprites` 打成图集 `name`。按传入的顺序装箱（布局只取决于输入的顺序和内容，要确定的输出就先排好序），一页放不下时分页。
 * 不旋转帧。单张图（裁剪后）比 `maxSize` 还大、帧名重复时报错。
 */
export function packAtlas(name: string, sprites: readonly PackSprite[], options: PackOptions = {}): { pages: PackedPage[] } {
  const maxSize = options.maxSize ?? 2048
  const padding = options.padding ?? 2
  const trim = options.trim ?? true
  if (!sprites.length) throw new Error(`packAtlas('${name}'): no sprites to pack.`)
  const seen = new Set<string>()
  const packer = new MaxRectsPacker<Placed>(maxSize, maxSize, padding, { smart: true, pot: false, square: false, allowRotation: false, border: 0 })
  for (const sprite of sprites) {
    const { name: frame, image } = sprite
    if (seen.has(frame)) throw new Error(`packAtlas('${name}'): two sprites are named "${frame}".`)
    seen.add(frame)
    if (!(image.width >= 1 && image.height >= 1)) throw new Error(`packAtlas('${name}'): "${frame}" is ${image.width}×${image.height}; images must be at least 1×1.`)
    if (image.data.length !== image.width * image.height * 4) {
      throw new Error(`packAtlas('${name}'): "${frame}" has ${image.data.length} bytes, expected ${image.width}×${image.height}×4 (RGBA).`)
    }
    const src = trim ? opaqueBounds(image) : { x: 0, y: 0, w: image.width, h: image.height }
    if (src.w > maxSize || src.h > maxSize) {
      throw new Error(`packAtlas('${name}'): "${frame}" is ${src.w}×${src.h}${trim ? ' after trimming' : ''}, larger than maxSize ${maxSize}. Scale it down or raise maxSize.`)
    }
    packer.add({ width: src.w, height: src.h, x: 0, y: 0, sprite, src })
  }
  const bins = packer.bins
  const pages = bins.map((bin, i): PackedPage => {
    const file = bins.length === 1 ? `${name}.png` : `${name}-${i}.png`
    const page: RawImage = { data: new Uint8Array(bin.width * bin.height * 4), width: bin.width, height: bin.height }
    const frames: Record<string, PackedFrame> = {}
    for (const r of bin.rects) {
      const { sprite, src } = r
      blit(sprite.image, src, page, r.x, r.y)
      const trimmed = src.w !== sprite.image.width || src.h !== sprite.image.height
      frames[sprite.name] = {
        frame: { x: r.x, y: r.y, w: src.w, h: src.h },
        rotated: false,
        trimmed,
        spriteSourceSize: { x: src.x, y: src.y, w: src.w, h: src.h },
        sourceSize: { w: sprite.image.width, h: sprite.image.height },
        ...(sprite.pivot ? { pivot: sprite.pivot } : {}),
      }
    }
    const meta = { app: '@sapling2d/pack', image: file, format: 'RGBA8888' as const, size: { w: bin.width, h: bin.height }, ...options.meta }
    return { file, image: page, json: { frames, meta } }
  })
  return { pages }
}

/** 不透明部分（alpha > 0）的外接矩形。整张透明时返回左上角 1×1（空帧也要占一个位置，`atlas()` 才取得到它）。 */
export function opaqueBounds(image: RawImage): { x: number; y: number; w: number; h: number } {
  const { width: w, height: h, data } = image
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: Math.min(1, w), h: Math.min(1, h) }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

function blit(from: RawImage, src: { x: number; y: number; w: number; h: number }, to: RawImage, dx: number, dy: number): void {
  for (let row = 0; row < src.h; row++) {
    const start = ((src.y + row) * from.width + src.x) * 4
    to.data.set(from.data.subarray(start, start + src.w * 4), ((dy + row) * to.width + dx) * 4)
  }
}
