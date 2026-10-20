// 生成默认皮肤：node scripts/gen-assets.mjs → assets/*.png
// 灰白半透明的抗锯齿圆，不依赖任何包（PNG 用 zlib 自己编码）。改了参数就重新生成并提交结果。
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
/** 一张 RGBA 画布（直通 alpha）。 */
function canvas(size) {
  return { w: size, h: size, px: Buffer.alloc(size * size * 4) }
}
function png(c) {
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h)
  for (let y = 0; y < c.h; y++) c.px.copy(raw, y * (c.w * 4 + 1) + 1, y * c.w * 4, (y + 1) * c.w * 4)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(c.w, 0)
  ihdr.writeUInt32BE(c.h, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ---------------------------------------------------------------- 画圆

/**
 * 在画布中心画一个圆环（`inner` 为 0 就是实心圆），边缘按像素到圆心的距离抗锯齿。
 * 颜色叠在已有像素上（source-over），所以可以先画填充再画描边。
 */
function ring(c, outer, inner, rgb, alpha) {
  const cx = c.w / 2
  const cy = c.h / 2
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const coverage = clamp(outer + 0.5 - d) * (inner > 0 ? clamp(d - inner + 0.5) : 1)
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
const clamp = (v) => Math.max(0, Math.min(1, v))

const WHITE = [255, 255, 255]
const DARK = [40, 40, 48]

// 摇杆底座：200×200，淡淡的填充 + 明显的环
const base = canvas(200)
ring(base, 96, 0, WHITE, 0.14)
ring(base, 96, 80, WHITE, 0.55)
ring(base, 97, 95, DARK, 0.25)

// 摇杆头：96×96，实心圆 + 深色边
const knob = canvas(96)
ring(knob, 46, 0, WHITE, 0.85)
ring(knob, 46, 42, DARK, 0.35)

// 屏幕按钮：140×140，半透明实心圆 + 环
const button = canvas(140)
ring(button, 66, 0, WHITE, 0.3)
ring(button, 66, 58, WHITE, 0.7)
ring(button, 67, 65, DARK, 0.25)

for (const [name, c] of [
  ['joystick-base.png', base],
  ['joystick-knob.png', knob],
  ['button.png', button],
]) {
  const data = png(c)
  writeFileSync(new URL(name, OUT), data)
  console.log(`${name} ${c.w}×${c.h} ${(data.length / 1024).toFixed(1)} KB`)
}
