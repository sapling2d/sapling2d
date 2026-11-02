#!/usr/bin/env node
/**
 * sapling-pack：目录里的 PNG → 图集图片 + JSON。
 *
 *   sapling-pack art/items public/assets            # → public/assets/items.png + items.json（放不下时 items-0 / items-1…）
 *   sapling-pack art/items public/assets --json src  # JSON 写到 src/（代码里 import 它）
 *
 * 选项：--name <图集名>（默认输入目录名）、--json <目录>、--max-size <px>（默认 2048）、--padding <px>（默认 2）、--no-trim。
 * 子目录里的 PNG 也打包，帧名是相对输入目录的路径（`hero/attack_01.png`）；按帧名排序，同样的输入得到逐字节相同的输出。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { packDirectory } from './files.ts'

const USAGE = 'usage: sapling-pack <input dir> <output dir> [--name <atlas>] [--json <dir>] [--max-size 2048] [--padding 2] [--no-trim]'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    json: { type: 'string' },
    'max-size': { type: 'string' },
    padding: { type: 'string' },
    'no-trim': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help || positionals.length !== 2) {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
}

const [input, output] = positionals.map((p) => resolve(p)) as [string, string]
const number = (flag: string, v: string | undefined) => {
  if (v === undefined) return undefined
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${flag} must be a non-negative integer, got "${v}"`)
  return n
}

try {
  const name = values.name ?? basename(input)
  const { pages, count } = packDirectory(input, name, {
    maxSize: number('max-size', values['max-size']),
    padding: number('padding', values.padding),
    trim: !values['no-trim'],
  })
  const jsonDir = values.json ? resolve(values.json) : output
  mkdirSync(output, { recursive: true })
  mkdirSync(jsonDir, { recursive: true })
  for (const page of pages) {
    writeFileSync(join(output, page.file), page.png)
    writeFileSync(join(jsonDir, page.file.replace(/\.png$/, '.json')), page.jsonText)
    console.log(`  ${page.file} ${page.width}×${page.height}`)
  }
  console.log(`packed ${count} image(s) into ${pages.length} page(s)`)
} catch (e) {
  console.error(`sapling-pack: ${(e as Error).message}`)
  process.exit(1)
}
