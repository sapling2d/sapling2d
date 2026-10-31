// 生成默认皮肤：node scripts/gen-assets.mjs → assets/*.png
// 中性的灰白圆角九宫格，可被 modulate 染色；不依赖任何包（PNG 用 zlib 自己编码）。改了参数就重新生成并提交结果。
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OUT = new URL('../assets/', import.meta.url)
mkdirSync(OUT, { recursive: true })

// ---------------------------------------------------------------- PNG

function crc32(buf) {
  let c
  let crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function canvas(size) {
  return { w: size, h: size, px: Buffer.alloc(size * size * 4) }
}
function png(c) {
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h)
  for (let y = 0; y < c.h; y++) c.px.copy(raw, y * (c.w * 4 + 1) + 1, y * c.w * 4, (y + 1) * c.w * 4)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(c.w, 0)
  ihdr.writeUInt32BE(c.h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ---------------------------------------------------------------- 圆角矩形

const clamp = (v) => Math.max(0, Math.min(1, v))

/**
 * 画一个向内缩 `inset` 像素、圆角半径 `radius` 的圆角矩形，边缘按有符号距离抗锯齿，颜色叠在已有像素上（source-over）。
 * 先画边框色的大矩形、再画填充色的小矩形，就得到带边框的九宫格。
 */
function roundedRect(c, inset, radius, rgb, alpha, offsetY = 0) {
  const hw = c.w / 2 - inset
  const hh = c.h / 2 - inset
  const cx = c.w / 2
  const cy = c.h / 2 + offsetY
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const dx = Math.max(Math.abs(x + 0.5 - cx) - (hw - radius), 0)
      const dy = Math.max(Math.abs(y + 0.5 - cy) - (hh - radius), 0)
      const d = Math.hypot(dx, dy) - radius
      const coverage = clamp(0.5 - d)
      if (coverage <= 0) continue
      const a = alpha * coverage
      const o = (y * c.w + x) * 4
      const da = c.px[o + 3] / 255
      const na = a + da * (1 - a)
      for (let i = 0; i < 3; i++) c.px[o + i] = Math.round((rgb[i] * a + c.px[o + i] * da * (1 - a)) / na)
      c.px[o + 3] = Math.round(na * 255)
    }
  }
}

const WHITE = [255, 255, 255]
const LIGHT = [236, 236, 242]
const PRESSED = [198, 198, 210]
const DARK = [40, 40, 48]

// 按钮：64×64，深色边 + 浅灰填充，底边略深一点（有一点立体感）。margins 20。
const button = canvas(64)
roundedRect(button, 1, 16, DARK, 0.6)
roundedRect(button, 3, 14, [150, 150, 165], 1)
roundedRect(button, 3, 14, LIGHT, 1, -2)

// 按下态：同样的形状，填充更深、没有立体感。
const pressed = canvas(64)
roundedRect(pressed, 1, 16, DARK, 0.6)
roundedRect(pressed, 3, 14, PRESSED, 1)

// 面板 / 进度条底：64×64，深色半透明填充 + 淡边。margins 16。
const panel = canvas(64)
roundedRect(panel, 1, 14, WHITE, 0.35)
roundedRect(panel, 3, 12, DARK, 0.88)

// 进度条填充：32×32，纯白圆角（用 modulate 染色）。margins 10。
const fill = canvas(32)
roundedRect(fill, 2, 8, WHITE, 1)

for (const [name, c] of [
  ['button.png', button],
  ['button-pressed.png', pressed],
  ['panel.png', panel],
  ['bar-fill.png', fill],
]) {
  const data = png(c)
  writeFileSync(new URL(name, OUT), data)
  console.log(`${name} ${c.w}×${c.h} ${(data.length / 1024).toFixed(1)} KB`)
}
