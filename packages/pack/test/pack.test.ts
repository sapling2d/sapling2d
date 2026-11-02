import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atlas } from 'sapling2d'
import { describe, expect, it } from 'vitest'
import { decodePng, encodePng, packDirectory } from '../src/files.ts'
import { opaqueBounds, packAtlas, type PackedPage, type PackSprite, type RawImage } from '../src/index.ts'

/** w×h 的图：`opaque` 范围内的像素不透明，颜色由 `seed` 和坐标决定（用来检查像素拷贝到了哪里）。 */
function image(w: number, h: number, seed: number, opaque = { x: 0, y: 0, w, h }): RawImage {
  const data = new Uint8Array(w * h * 4)
  for (let y = opaque.y; y < opaque.y + opaque.h; y++) {
    for (let x = opaque.x; x < opaque.x + opaque.w; x++) data.set([seed, x, y, 255], (y * w + x) * 4)
  }
  return { data, width: w, height: h }
}

const pixel = (img: RawImage, x: number, y: number) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)]

/** 每一帧在页里的像素和原图（裁剪后的部分）逐个相同。 */
function expectPixelsCopied(pages: PackedPage[], sprites: PackSprite[]) {
  for (const s of sprites) {
    const page = pages.find((p) => s.name in p.json.frames)!
    const f = page.json.frames[s.name]!
    for (let y = 0; y < f.frame.h; y++) {
      for (let x = 0; x < f.frame.w; x++) {
        expect(pixel(page.image, f.frame.x + x, f.frame.y + y)).toEqual(pixel(s.image, f.spriteSourceSize.x + x, f.spriteSourceSize.y + y))
      }
    }
  }
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

describe('packAtlas', () => {
  const sprites: PackSprite[] = [
    { name: 'a.png', image: image(10, 20, 1) },
    { name: 'b.png', image: image(30, 12, 2) },
    { name: 'c.png', image: image(16, 16, 3) },
    { name: 'd.png', image: image(8, 40, 4) },
  ]

  it('packs every sprite into one page without overlap and copies the pixels', () => {
    const { pages } = packAtlas('items', sprites)
    expect(pages).toHaveLength(1)
    const [page] = pages as [PackedPage]
    expect(page.file).toBe('items.png')
    expect(page.json.meta).toMatchObject({ app: '@sapling2d/pack', image: 'items.png', size: { w: page.image.width, h: page.image.height } })
    const rects = Object.values(page.json.frames).map((f) => f.frame)
    expect(rects).toHaveLength(4)
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(page.image.width)
      expect(r.y + r.h).toBeLessThanOrEqual(page.image.height)
    }
    // 间距 2：任意两帧往外扩 1 像素也不重叠
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const grow = (r: (typeof rects)[number]) => ({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 })
        expect(overlaps(grow(rects[i]!), grow(rects[j]!))).toBe(false)
      }
    }
    expectPixelsCopied(pages, sprites)
  })

  it('trims transparent edges and records the offset in the original image', () => {
    const s = { name: 'trimmed.png', image: image(40, 30, 7, { x: 5, y: 8, w: 12, h: 10 }) }
    const { pages } = packAtlas('t', [s])
    const f = pages[0]!.json.frames['trimmed.png']!
    expect(f).toMatchObject({ trimmed: true, rotated: false, spriteSourceSize: { x: 5, y: 8, w: 12, h: 10 }, sourceSize: { w: 40, h: 30 } })
    expect([f.frame.w, f.frame.h]).toEqual([12, 10])
    expectPixelsCopied(pages, [s])
    // trim: false 原样放
    const g = packAtlas('t', [s], { trim: false }).pages[0]!.json.frames['trimmed.png']!
    expect(g).toMatchObject({ trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 40, h: 30 }, frame: { w: 40, h: 30 } })
  })

  it('keeps a fully transparent sprite as a 1×1 frame with its original size', () => {
    const f = packAtlas('t', [{ name: 'blank.png', image: image(20, 20, 0, { x: 0, y: 0, w: 0, h: 0 }) }]).pages[0]!.json.frames['blank.png']!
    expect(f).toMatchObject({ trimmed: true, frame: { w: 1, h: 1 }, sourceSize: { w: 20, h: 20 } })
    expect(opaqueBounds(image(3, 3, 1, { x: 1, y: 2, w: 2, h: 1 }))).toEqual({ x: 1, y: 2, w: 2, h: 1 })
  })

  it('splits into numbered pages when one page is not enough', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `s${i}.png`, image: image(30, 30, i + 1) }))
    const { pages } = packAtlas('items', many, { maxSize: 64 })
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.map((p) => p.file)).toEqual(pages.map((_, i) => `items-${i}.png`))
    expect(pages.map((p) => p.json.meta.image)).toEqual(pages.map((p) => p.file))
    for (const p of pages) expect(Math.max(p.image.width, p.image.height)).toBeLessThanOrEqual(64)
    expect(pages.flatMap((p) => Object.keys(p.json.frames)).sort()).toEqual(many.map((s) => s.name))
    expectPixelsCopied(pages, many)
  })

  it('writes pivot and extra meta fields as given', () => {
    const { pages } = packAtlas('hero', [{ name: 'idle.png', image: image(4, 4, 1), pivot: { x: 0.5, y: 0.9 } }], { meta: { app: 'my-game', scale: '0.5' } })
    expect(pages[0]!.json.frames['idle.png']!.pivot).toEqual({ x: 0.5, y: 0.9 })
    // 同名字段覆盖默认值、位置不变；新字段跟在后面
    expect(Object.keys(pages[0]!.json.meta)).toEqual(['app', 'image', 'format', 'size', 'scale'])
    expect(pages[0]!.json.meta.app).toBe('my-game')
  })

  it('rejects empty input, duplicate names, oversized sprites and malformed pixel data', () => {
    expect(() => packAtlas('x', [])).toThrow(/no sprites/)
    expect(() => packAtlas('x', [sprites[0]!, sprites[0]!])).toThrow(/two sprites are named "a.png"/)
    expect(() => packAtlas('x', [{ name: 'big.png', image: image(100, 10, 1) }], { maxSize: 64 })).toThrow(/"big.png" is 100×10 after trimming, larger than maxSize 64/)
    // 透明边裁掉之后放得下就行
    expect(() => packAtlas('x', [{ name: 'pad.png', image: image(100, 10, 1, { x: 40, y: 0, w: 20, h: 10 }) }], { maxSize: 64 })).not.toThrow()
    expect(() => packAtlas('x', [{ name: 'bad.png', image: { data: new Uint8Array(10), width: 2, height: 2 } }])).toThrow(/expected 2×2×4/)
    expect(() => packAtlas('x', [{ name: 'empty.png', image: { data: new Uint8Array(0), width: 0, height: 4 } }])).toThrow(/at least 1×1/)
  })

  it('is deterministic: the same input gives the same output', () => {
    const a = packAtlas('items', sprites)
    const b = packAtlas('items', sprites)
    expect(JSON.stringify(a.pages.map((p) => p.json))).toBe(JSON.stringify(b.pages.map((p) => p.json)))
    expect(Buffer.from(encodePng(a.pages[0]!.image)).equals(Buffer.from(encodePng(b.pages[0]!.image)))).toBe(true)
  })

  it('produces JSON that atlas() reads with the original sizes, single page and multipack', () => {
    const trimmed = { name: 'hero_01.png', image: image(40, 30, 1, { x: 5, y: 8, w: 12, h: 10 }) }
    const single = packAtlas('hero', [trimmed, { name: 'hero_02.png', image: image(40, 30, 2) }]).pages[0]!
    const a = atlas(single.file, single.json)
    expect(a.frames('hero_').map((t) => [t.width, t.height])).toEqual([[40, 30], [40, 30]])
    expect(a.get('hero_01.png')._frame).toMatchObject({ rotated: false, region: { x: single.json.frames['hero_01.png']!.frame.x, width: 12, height: 10 }, trim: { x: 5, y: 8 } })

    const many = Array.from({ length: 6 }, (_, i) => ({ name: `s_${i}.png`, image: image(30, 30, i + 1) }))
    const { pages } = packAtlas('items', many, { maxSize: 64 })
    const multi = atlas(pages.map((p) => p.file), pages.map((p) => p.json))
    expect(multi.pages).toHaveLength(pages.length)
    expect(multi.frames('s').map((t) => t.width)).toEqual(many.map(() => 30))
  })
})

describe('packDirectory and the sapling-pack CLI', () => {
  function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), 'sapling-pack-'))
    mkdirSync(join(dir, 'items', 'weapons'), { recursive: true })
    writeFileSync(join(dir, 'items', 'coin.png'), encodePng(image(12, 12, 1)))
    writeFileSync(join(dir, 'items', 'weapons', 'sword.png'), encodePng(image(20, 40, 2, { x: 4, y: 0, w: 12, h: 40 })))
    writeFileSync(join(dir, 'items', 'notes.txt'), 'not an image')
    return dir
  }

  it('packs every PNG under a directory, named by relative path and sorted', () => {
    const dir = fixture()
    const { pages, count } = packDirectory(join(dir, 'items'), 'items')
    expect(count).toBe(2)
    const json = JSON.parse(pages[0]!.jsonText)
    expect(Object.keys(json.frames).sort()).toEqual(['coin.png', 'weapons/sword.png'])
    expect(json.frames['weapons/sword.png']).toMatchObject({ trimmed: true, sourceSize: { w: 20, h: 40 }, spriteSourceSize: { x: 4, w: 12 } })
    // PNG 编码往返后像素不变
    const page = decodePng(pages[0]!.png)
    const sword = json.frames['weapons/sword.png'].frame
    expect(pixel(page, sword.x, sword.y)).toEqual([2, 4, 0, 255])
    expect(() => packDirectory(join(dir, 'items', 'weapons', 'missing'), 'x')).toThrow()
  })

  it('writes the atlas PNG and JSON, the same bytes on every run', () => {
    const dir = fixture()
    const cli = join(dirname(fileURLToPath(import.meta.url)), '../src/cli.ts')
    const run = (out: string) => execFileSync(process.execPath, [cli, join(dir, 'items'), join(dir, out), '--json', join(dir, out, 'json')], { encoding: 'utf8' })
    expect(run('a')).toContain('packed 2 image(s) into 1 page(s)')
    run('b')
    for (const file of ['items.png', 'json/items.json']) {
      expect(readFileSync(join(dir, 'a', file)).equals(readFileSync(join(dir, 'b', file)))).toBe(true)
    }
    expect(JSON.parse(readFileSync(join(dir, 'a', 'json', 'items.json'), 'utf8')).meta.image).toBe('items.png')
    expect(() => execFileSync(process.execPath, [cli, join(dir, 'nope'), join(dir, 'c')], { stdio: 'pipe' })).toThrow()
  })
})
