import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { PNG } from 'pngjs'
import { packAtlas, type PackOptions, type RawImage } from './index.ts'

/** 编码好的一页：PNG 字节和 JSON 文本（写文件由调用方做）。 */
export interface EncodedPage {
  /** 图片文件名（`items.png` / `items-0.png`…）；JSON 的文件名把 `.png` 换成 `.json`。 */
  file: string
  png: Uint8Array
  jsonText: string
  width: number
  height: number
}

/** 目录里所有 PNG（含子目录），按相对路径排序；帧名是相对路径，分隔符用 `/`。 */
export function listPngs(dir: string): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const path = join(d, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.png$/i.test(entry)) out.push({ name: relative(dir, path).split(sep).join('/'), path })
    }
  }
  walk(dir)
  if (!out.length) throw new Error(`no .png files in ${dir}`)
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

export function decodePng(bytes: Uint8Array): RawImage {
  const png = PNG.sync.read(Buffer.from(bytes))
  return { data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length), width: png.width, height: png.height }
}

export function encodePng(image: RawImage): Uint8Array {
  const png = new PNG({ width: image.width, height: image.height })
  png.data = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length)
  return PNG.sync.write(png, { colorType: 6 })
}

/** 打包一个目录：读 PNG、装箱、编码（写文件由调用方做）。 */
export function packDirectory(dir: string, name: string, options: PackOptions = {}): { pages: EncodedPage[]; count: number } {
  const files = listPngs(dir)
  const sprites = files.map((f) => {
    try {
      return { name: f.name, image: decodePng(readFileSync(f.path)) }
    } catch (e) {
      throw new Error(`${f.path}: ${(e as Error).message}`)
    }
  })
  const { pages } = packAtlas(name, sprites, options)
  return {
    count: sprites.length,
    pages: pages.map((p) => ({ file: p.file, png: encodePng(p.image), jsonText: `${JSON.stringify(p.json, null, 2)}\n`, width: p.image.width, height: p.image.height })),
  }
}
