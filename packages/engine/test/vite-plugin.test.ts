import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { checkTiledFiles, discoverAssetMounts, findAssetReferences, parseMountPath, sapling } from 'sapling2d/vite'

describe('findAssetReferences', () => {
  it('找出 tex / sfx / music 的字面量路径及行列号', () => {
    const code = ["const a = tex('fruit.png')", 'class S {', '  static assets = { pop: sfx("sfx/pop.mp3"), bgm: music(`bgm.mp3`) }', '}'].join('\n')
    expect(findAssetReferences(code)).toEqual([
      { fn: 'tex', path: 'fruit.png', line: 1, column: 10 },
      { fn: 'sfx', path: 'sfx/pop.mp3', line: 3, column: 25 },
      { fn: 'music', path: 'bgm.mp3', line: 3, column: 50 },
    ])
  })

  it('sheet / atlas：检查第一个参数（图片路径）', () => {
    const code = "sheet('boom.png', { columns: 4, rows: 2 }); atlas(\"ui/sprites.png\", data); sheet(path, grid)"
    expect(findAssetReferences(code)).toEqual([
      { fn: 'sheet', path: 'boom.png', line: 1, column: 0 },
      { fn: 'atlas', path: 'ui/sprites.png', line: 1, column: 44 },
    ])
  })

  it('aseprite：检查第一个参数；函数名后面可以带类型参数', () => {
    const code = "aseprite('hero.png', heroData); aseprite<'idle' | 'attack'>('boss.png', bossData)"
    expect(findAssetReferences(code)).toEqual([
      { fn: 'aseprite', path: 'hero.png', line: 1, column: 0 },
      { fn: 'aseprite', path: 'boss.png', line: 1, column: 32 },
    ])
    // 格式化工具把长的联合类型拆成多行
    const wrapped = ['const hero = aseprite<', "  | 'idle'", "  | 'attack'", ">('hero.png', heroData)"].join('\n')
    expect(findAssetReferences(wrapped)).toEqual([{ fn: 'aseprite', path: 'hero.png', line: 1, column: 13 }])
  })

  it('tileset：检查第一个参数（图集图片路径）', () => {
    expect(findAssetReferences("const T = tileset('tiles/ground.png', { tileSize: 16 })")).toEqual([{ fn: 'tileset', path: 'tiles/ground.png', line: 1, column: 10 }])
  })

  it('tiledMap：检查关卡文件路径；关卡引用的外部图块集和图片也要存在', () => {
    expect(findAssetReferences("tiledMap('levels/1-1.json')")).toEqual([{ fn: 'tiledMap', path: 'levels/1-1.json', line: 1, column: 0 }])
    const fixtures = fileURLToPath(new URL('fixtures/tiled', import.meta.url))
    // 测试用的关卡引用了 tiles/terrain.png 和 tiles/sky.png，这两张图故意没有放
    const { problems, files } = checkTiledFiles(join(fixtures, 'levels/1-1.json'), fixtures)
    expect(problems.map((p) => `${p.ref} ${p.reason}`)).toEqual(['terrain.png does not exist', '../tiles/sky.png does not exist'])
    expect(files.map((f) => f.slice(fixtures.length + 1))).toEqual(['levels/1-1.json', 'tiles/terrain.json', 'tiles/terrain.png', 'tiles/sky.png'])
    // 资源目录外的图片
    expect(checkTiledFiles(join(fixtures, 'levels/1-1.json'), join(fixtures, 'levels')).problems[0]!.reason).toBe('is outside the assets directory')
  })

  it('忽略注释里的示例；字符串里的 // 不影响后面的识别', () => {
    const code = ["/** 用法：tex('doc.png') */", "// sfx('commented.mp3')", "const u = 'http://cdn/x'; tex('real.png')"].join('\n')
    expect(findAssetReferences(code)).toEqual([{ fn: 'tex', path: 'real.png', line: 3, column: 26 }])
  })

  it('跳过动态路径（变量、带 ${} 的模板字符串）和其他同名调用', () => {
    const code = 'tex(name); tex(`fruit-${level}.png`); context.tex2("a"); retex("b.png")'
    expect(findAssetReferences(code)).toEqual([])
  })
})

describe('vite build', () => {
  let dir = ''
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  function fixture(main: string) {
    dir = mkdtempSync(join(tmpdir(), 'sapling-vite-'))
    mkdirSync(join(dir, 'public', 'assets', 'sfx'), { recursive: true })
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'public', 'assets', 'fruit.png'), '')
    writeFileSync(join(dir, 'public', 'assets', 'sfx', 'pop.mp3'), '')
    writeFileSync(join(dir, 'index.html'), '<script type="module" src="/src/main.ts"></script>')
    writeFileSync(join(dir, 'src', 'main.ts'), main)
    return () => build({ root: dir, logLevel: 'silent', plugins: [sapling()], build: { write: false } })
  }

  const prelude = 'const tex = (p: string) => p; const sfx = (p: string) => p\n'

  it('资源都存在时构建成功', async () => {
    const run = fixture(prelude + "console.log(tex('fruit.png'), sfx('sfx/pop.mp3'))")
    await expect(run()).resolves.toBeDefined()
  })

  it('资源缺失时构建失败，报错指出文件、行列和最相近的文件名', async () => {
    const run = fixture(prelude + "console.log(tex('frut.png'))")
    // Vite 8（Rolldown）把插件错误包在 errors 数组里；消息里带有 文件:行:列
    const err = (await run().catch((e: unknown) => e)) as Error & { errors?: { id: string; loc: { line: number; column: number } }[] }
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain("Asset not found: tex('frut.png')")
    expect(err.message).toContain("Did you mean 'fruit.png'?")
    expect(err.message).toMatch(/src[/\\]main\.ts:2:12/)
    expect(err.errors?.[0]?.id).toMatch(/src[/\\]main\.ts$/)
    expect(err.errors?.[0]?.loc).toEqual({ line: 2, column: 12 })
  })

  it('路径跑出资源目录时报错', async () => {
    const run = fixture(prelude + "console.log(tex('../../secret.png'))")
    await expect(run()).rejects.toThrow(/outside the assets directory/)
  })

  it("内嵌的图片 tex('data:…') 不检查", async () => {
    const run = fixture(prelude + "console.log(tex('data:image/png;base64,iVBORw0KGgo='))")
    await expect(run()).resolves.toBeDefined()
  })
})

describe('插件资源挂载（~<包名>/）', () => {
  let dir = ''
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  /** 一个假的插件包：node_modules/<name>/package.json（可选 sapling2d.assets 字段）+ assets/ 里的文件。 */
  function pkg(name: string, files: string[], declare = true) {
    const base = join(dir, 'node_modules', name)
    mkdirSync(join(base, 'assets'), { recursive: true })
    writeFileSync(join(base, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...(declare ? { sapling2d: { assets: 'assets' } } : {}) }))
    for (const f of files) {
      mkdirSync(join(base, 'assets', f, '..'), { recursive: true })
      writeFileSync(join(base, 'assets', f), 'png')
    }
  }

  /** 游戏工程：依赖 @foo/joystick（声明了资源）、plain-dep（没声明）；another-pkg 装了但不在依赖里。 */
  function project(main: string, options: { assetPackages?: string[]; reservedDir?: boolean } = {}) {
    dir = mkdtempSync(join(tmpdir(), 'sapling-mounts-'))
    mkdirSync(join(dir, 'public', 'assets'), { recursive: true })
    mkdirSync(join(dir, 'src'))
    if (options.reservedDir) mkdirSync(join(dir, 'public', 'assets', '~mine'))
    writeFileSync(join(dir, 'public', 'assets', 'fruit.png'), 'png')
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'game', private: true, type: 'module', dependencies: { '@foo/joystick': '1.0.0', 'plain-dep': '1.0.0' } }))
    pkg('@foo/joystick', ['knob.png', 'skins/dark/base.png'])
    pkg('plain-dep', ['x.png'], false)
    pkg('another-pkg', ['click.mp3'])
    writeFileSync(join(dir, 'index.html'), '<script type="module" src="/src/main.ts"></script>')
    writeFileSync(join(dir, 'src', 'main.ts'), 'const tex = (p: string) => p; const sfx = (p: string) => p\n' + main)
    const plugins = [sapling(options.assetPackages ? { assetPackages: options.assetPackages } : {})]
    return {
      build: () => build({ root: dir, logLevel: 'silent', plugins, build: { outDir: 'dist' } }),
      serve: () => createServer({ root: dir, logLevel: 'silent', plugins, server: { port: 20000 + Math.floor(Math.random() * 20000), strictPort: false, host: '127.0.0.1' } }),
    }
  }

  it('parseMountPath：scope 包取两段，普通包取一段，不以 ~ 开头返回 null', () => {
    expect(parseMountPath('~@foo/joystick/skins/dark/base.png')).toEqual({ pkg: '@foo/joystick', rest: 'skins/dark/base.png' })
    expect(parseMountPath('~foo-sfx/click.mp3')).toEqual({ pkg: 'foo-sfx', rest: 'click.mp3' })
    expect(parseMountPath('~@foo/joystick')).toEqual({ pkg: '@foo/joystick', rest: '' })
    expect(parseMountPath('fruit.png')).toBeNull()
  })

  it('按 package.json 字段挂载：依赖里声明了的挂载，没声明的不挂，不在依赖里的要靠 assetPackages', () => {
    project('')
    const warnings: string[] = []
    const mounts = discoverAssetMounts(dir, [], (m) => warnings.push(m))
    expect([...mounts.keys()]).toEqual(['@foo/joystick'])
    expect(mounts.get('@foo/joystick')).toMatch(/node_modules[/\\]@foo[/\\]joystick[/\\]assets$/)
    expect(warnings).toEqual([])
    expect([...discoverAssetMounts(dir, ['another-pkg']).keys()]).toEqual(['@foo/joystick', 'another-pkg'])
    // assetPackages 里列了没装的、没声明的：警告
    discoverAssetMounts(dir, ['missing-pkg', 'plain-dep'], (m) => warnings.push(m))
    expect(warnings.sort()).toEqual([expect.stringContaining('"missing-pkg" is not installed'), expect.stringContaining('"plain-dep" does not declare')])
  })

  it('构建：挂载的资源通过检查，整个目录拷到 dist/assets/~<包名>/', async () => {
    const p = project("console.log(tex('~@foo/joystick/knob.png'), tex('~@foo/joystick/skins/dark/base.png'), tex('fruit.png'))")
    await p.build()
    expect(existsSync(join(dir, 'dist', 'assets', '~@foo', 'joystick', 'knob.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist', 'assets', '~@foo', 'joystick', 'skins', 'dark', 'base.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist', 'assets', 'fruit.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist', 'assets', '~plain-dep'))).toBe(false)
  })

  it('缺文件：报错带 ~<包名>/ 前缀的最相近文件名', async () => {
    const p = project("console.log(tex('~@foo/joystick/knb.png'))")
    const err = (await p.build().catch((e: unknown) => e)) as Error
    expect(err.message).toContain("Asset not found: tex('~@foo/joystick/knb.png')")
    expect(err.message).toContain("Did you mean '~@foo/joystick/knob.png'?")
  })

  it('没挂载的包：报错同时提到没安装和没声明字段；路径跑出包的资源目录也报错', async () => {
    const p = project("console.log(tex('~@bar/x/a.png'))")
    await expect(p.build()).rejects.toThrow(/package "@bar\/x" is not installed, or its package\.json does not declare "sapling2d"/)
    const q = project("console.log(tex('~plain-dep/x.png'))")
    await expect(q.build()).rejects.toThrow(/package "plain-dep" is not installed, or/)
    const r = project("console.log(tex('~@foo/joystick/../../secret.png'))")
    await expect(r.build()).rejects.toThrow(/outside the assets directory of "@foo\/joystick"/)
  })

  it('assetPackages 追加挂载不在依赖里的包', async () => {
    const p = project("console.log(sfx('~another-pkg/click.mp3'))", { assetPackages: ['another-pkg'] })
    await p.build()
    expect(existsSync(join(dir, 'dist', 'assets', '~another-pkg', 'click.mp3'))).toBe(true)
  })

  it('游戏资源目录顶层以 ~ 开头的条目：构建开始时报错（保留前缀）', async () => {
    const p = project("console.log(tex('fruit.png'))", { reservedDir: true })
    await expect(p.build()).rejects.toThrow(/~mine starts with "~", which is reserved for plugin assets/)
  })

  it('开发服务器从 node_modules serve 挂载的资源，带 Content-Type；没有的文件不归它管', async () => {
    const p = project("console.log(tex('~@foo/joystick/knob.png'))")
    const server = await p.serve()
    await server.listen()
    try {
      const base = server.resolvedUrls!.local[0]!.replace(/\/$/, '')
      const ok = await fetch(`${base}/assets/~@foo/joystick/knob.png`)
      expect([ok.status, ok.headers.get('content-type'), await ok.text()]).toEqual([200, 'image/png', 'png'])
      const nested = await fetch(`${base}/assets/~@foo/joystick/skins/dark/base.png`)
      expect(nested.status).toBe(200)
      const missing = await fetch(`${base}/assets/~@foo/joystick/nope.png`)
      expect(missing.headers.get('content-type')).not.toBe('image/png')
      const unmounted = await fetch(`${base}/assets/~plain-dep/x.png`)
      expect(unmounted.headers.get('content-type')).not.toBe('image/png')
    } finally {
      await server.close()
    }
  })
})
