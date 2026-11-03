import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { MarkdownRenderer } from 'vitepress'

/**
 * `<<< path/to/file.ts#region` for the engine's example tests.
 *
 * VitePress's own snippet import only closes a region at `// #endregion <name>`;
 * the examples use a bare `// #endregion` (that is what `build-llms.ts` reads),
 * so lines with a `#region` are handled here, the same way `extractRegion` does it.
 * Lines without `#region` fall through to VitePress.
 */
export function exampleSnippet(md: MarkdownRenderer) {
  md.block.ruler.before('snippet', 'example-snippet', (state, startLine, _endLine, silent) => {
    const pos = state.bMarks[startLine]! + state.tShift[startLine]!
    const max = state.eMarks[startLine]!
    const line = state.src.slice(pos, max).trim()
    const m = /^<<<\s+(\S+?\.(\w+))#([\w-]+)$/.exec(line)
    if (!m) return false
    if (silent) return true

    const [, file, ext, region] = m as unknown as [string, string, string, string]
    const env = state.env as { realPath?: string; path: string }
    const path = resolve(dirname(env.realPath ?? env.path), file)
    const token = state.push('fence', 'code', 0)
    token.info = ext
    token.content = extractRegion(readFileSync(path, 'utf8'), region, path) + '\n'
    token.map = [startLine, startLine + 1]
    state.line = startLine + 1
    return true
  })
}

function extractRegion(source: string, region: string, file: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((l) => l.trim() === `// #region ${region}`)
  if (start === -1) throw new Error(`${file}: no "// #region ${region}"`)
  const end = lines.findIndex((l, i) => i > start && /^\/\/ #endregion\b/.test(l.trim()))
  if (end === -1) throw new Error(`${file}: "// #region ${region}" is not closed`)
  const body = lines.slice(start + 1, end)
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length))
  return body.map((l) => l.slice(indent)).join('\n')
}
