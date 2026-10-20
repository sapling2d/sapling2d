import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, createLogger } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { saplingWechat, type SaplingWechatOptions } from 'sapling2d/vite'
import { checkPackageSize, MAIN_PACKAGE_LIMIT, mainAssetsMatcher, TOTAL_PACKAGE_LIMIT } from '../src/vite/wechat'
import { _createClock } from '../src/platform/wechat/clock'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

describe('saplingWechat', () => {
  let dir = ''
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  function fixture(main: string, pluginOptions: Partial<SaplingWechatOptions> = {}) {
    dir = mkdtempSync(join(tmpdir(), 'sapling-wechat-'))
    mkdirSync(join(dir, 'src'))
    mkdirSync(join(dir, 'public', 'assets'), { recursive: true })
    writeFileSync(join(dir, 'public', 'assets', 'fruit.png'), 'png')
    writeFileSync(join(dir, 'src', 'main.ts'), main)
    return (opts: { release?: boolean | 'default'; logUrl?: string | null; warnings?: string[] } = {}) =>
      build({
        root: dir,
        logLevel: opts.warnings ? 'warn' : 'silent',
        ...(opts.warnings ? { customLogger: { ...createLogger('silent'), warn: (msg: string) => opts.warnings!.push(msg), warnOnce: (msg: string) => opts.warnings!.push(msg) } } : {}),
        // 临时目录不在工作区里：把 sapling2d 指向源码
        resolve: {
          alias: [
            { find: /^sapling2d$/, replacement: join(SRC, 'index.ts') },
            { find: /^sapling2d\/wechat-polyfills$/, replacement: join(SRC, 'platform', 'wechat', 'polyfills.ts') },
          ],
        },
        plugins: [saplingWechat({ entry: 'src/main.ts', appid: 'wx-test', orientation: 'landscape', ...(opts.release === 'default' ? {} : { release: opts.release ?? false }), logUrl: opts.logUrl ?? null, ...pluginOptions })],
      })
  }

  const read = (f: string) => readFileSync(join(dir, 'dist-wechat', f), 'utf8')
  /** game.js 里的资源清单：`GameGlobal.__saplingAssets = JSON.parse("...")`。 */
  const manifestOf = (js: string) => JSON.parse(JSON.parse(/__saplingAssets = JSON\.parse\(("(?:[^"\\]|\\.)*")\)/.exec(js)![1]!))
  /** 给工程加一个声明了资源的依赖包 @foo/joystick（假的 node_modules）。 */
  function mountPackage(files: Record<string, Buffer | string> = { 'knob.png': 'png', 'skins/dark/base.png': 'png' }) {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'game', private: true, dependencies: { '@foo/joystick': '1.0.0' } }))
    const base = join(dir, 'node_modules', '@foo', 'joystick')
    mkdirSync(join(base, 'assets'), { recursive: true })
    writeFileSync(join(base, 'package.json'), JSON.stringify({ name: '@foo/joystick', version: '1.0.0', sapling2d: { assets: 'assets' } }))
    for (const [f, content] of Object.entries(files)) {
      mkdirSync(dirname(join(base, 'assets', f)), { recursive: true })
      writeFileSync(join(base, 'assets', f), content)
    }
  }

  it('产出单个 CommonJS 的 game.js、game.json、project.config.json，并拷贝资源', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())")
    await run()
    const js = read('game.js')
    expect(js).not.toMatch(/^\s*(import|export)\s/m) // 不是 ESM
    expect(js).toContain('__saplingLog') // 启动代码在最前面
    expect(js.indexOf('__saplingLog')).toBeLessThan(js.indexOf('Vector2'))
    expect(js).toContain('sourceMappingURL=data:') // 开发构建：内联 sourcemap
    expect(JSON.parse(read('game.json'))).toEqual({
      deviceOrientation: 'landscape',
      showStatusBar: false,
      iOSHighPerformance: true,
      subpackages: [{ name: 'assets', root: 'assets-sub/' }],
    })
    const project = JSON.parse(read('project.config.json'))
    expect(project.appid).toBe('wx-test')
    expect(project.compileType).toBe('game')
    expect(project.setting.urlCheck).toBe(true)
    // 不在 boot/ 里的资源进资源分包，分包目录里有入口 game.js
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', 'fruit.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', 'game.js'))).toBe(true)
    expect(existsSync(join(dir, 'dist-wechat', 'assets', 'fruit.png'))).toBe(false)
  })

  it('boot/ 里的资源留在主包；资源清单写进 game.js，在游戏代码之前执行', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())")
    mkdirSync(join(dir, 'public', 'assets', 'boot', 'ui'), { recursive: true })
    writeFileSync(join(dir, 'public', 'assets', 'boot', 'ui', 'logo.png'), 'png')
    await run()
    expect(existsSync(join(dir, 'dist-wechat', 'assets', 'boot', 'ui', 'logo.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', 'boot'))).toBe(false)
    const js = read('game.js')
    expect(manifestOf(js)).toEqual({ main: ['boot/ui/logo.png'], subpackage: { name: 'assets', root: 'assets-sub/' } })
    expect(js.indexOf('__saplingAssets')).toBeLessThan(js.indexOf('Vector2'))
  })

  it('发布构建：主包超过 4 MB 时构建失败，指出最大的文件；开发构建只汇总', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())")
    mkdirSync(join(dir, 'public', 'assets', 'boot'))
    writeFileSync(join(dir, 'public', 'assets', 'boot', 'huge.png'), Buffer.alloc(MAIN_PACKAGE_LIMIT))
    await expect(run({ release: true })).rejects.toThrow(/main package is .* over the 4\.00 MB limit\. Largest: assets\/boot\/huge\.png 4\.00 MB/)
    await run({ release: false }) // 开发构建不报错
  })

  it('不传 release：vite build 是发布构建（压缩、无 sourcemap、超限失败），--watch 是开发构建', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())")
    await run({ release: 'default' })
    expect(read('game.js')).not.toContain('sourceMappingURL')
    mkdirSync(join(dir, 'public', 'assets', 'boot'))
    writeFileSync(join(dir, 'public', 'assets', 'boot', 'huge.png'), Buffer.alloc(MAIN_PACKAGE_LIMIT))
    await expect(run({ release: 'default' })).rejects.toThrow(/over the 4\.00 MB limit/)
    // --watch 会一直监听：只看 config 钩子给 Vite 的选项
    const configOf = (plugin: ReturnType<typeof saplingWechat>, user: object) => (plugin.config as (c: object, env: object) => { build: { minify: unknown; sourcemap: unknown } })(user, { command: 'build', mode: 'production' })
    expect(configOf(saplingWechat({ entry: 'src/main.ts' }), { root: dir, build: { watch: {} } }).build).toMatchObject({ minify: false, sourcemap: 'inline' })
    expect(configOf(saplingWechat({ entry: 'src/main.ts' }), { root: dir }).build).toMatchObject({ minify: true, sourcemap: false })
    expect(configOf(saplingWechat({ entry: 'src/main.ts', release: true }), { root: dir, build: { watch: {} } }).build).toMatchObject({ minify: true, sourcemap: false })
  })

  it('所有资源都在主包时不生成分包；重新构建时删掉的资源不会留在包里', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())", { mainAssets: () => true })
    await run()
    expect(existsSync(join(dir, 'dist-wechat', 'assets', 'fruit.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub'))).toBe(false)
    expect(JSON.parse(read('game.json')).subpackages).toBeUndefined()
    expect(manifestOf(read('game.js'))).toEqual({ main: ['fruit.png'], subpackage: null })

    rmSync(join(dir, 'public', 'assets', 'fruit.png'))
    writeFileSync(join(dir, 'public', 'assets', 'pear.png'), 'png')
    await run()
    expect(existsSync(join(dir, 'dist-wechat', 'assets', 'fruit.png'))).toBe(false)
    expect(existsSync(join(dir, 'dist-wechat', 'assets', 'pear.png'))).toBe(true)
  })

  it('资源里有 Tiled 自己的扩展名（.tmj / .tsj）时警告：小游戏代码包可能不收', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())")
    mkdirSync(join(dir, 'public', 'assets', 'levels'))
    writeFileSync(join(dir, 'public', 'assets', 'levels', '1-1.tmj'), '{}')
    const warnings: string[] = []
    await run({ warnings })
    expect(warnings.join('\n')).toMatch(/1-1\.tmj: Tiled files with these extensions may be left out of the mini game package; save maps and tilesets as \.json/)
  })

  it('运行环境补丁在游戏入口之前执行（虚拟入口：先 wechat-polyfills，再游戏代码）', async () => {
    const run = fixture("console.log('GAME_ENTRY_MARKER')")
    await run()
    const js = read('game.js')
    const polyfill = js.indexOf('wx.createCanvas()')
    expect(polyfill).toBeGreaterThan(-1)
    expect(polyfill).toBeLessThan(js.indexOf('GAME_ENTRY_MARKER'))
  })

  it('发布构建：压缩、不带 sourcemap；配置日志服务时关闭域名校验并把地址写进启动代码', async () => {
    const run = fixture("console.log('hello')")
    await run({ release: true, logUrl: 'http://10.0.0.2:7777/log' })
    const js = read('game.js')
    expect(js).not.toContain('sourceMappingURL')
    expect(js).toContain('http://10.0.0.2:7777/log')
    expect(JSON.parse(read('project.config.json')).setting.urlCheck).toBe(false)
  })

  it('产物里出现 eval / new Function / 动态 import 时构建失败', async () => {
    const run = fixture("const f = new Function('return 1'); console.log(f(), eval('2'))")
    await expect(run()).rejects.toThrow(/eval\(.*new Function\(|new Function\(|eval\(/)
  })

  it('挂载的插件包资源默认进分包（目录名原样 ~<包名>/），清单 main 不含它', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())")
    mountPackage()
    await run()
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', '~@foo', 'joystick', 'knob.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', '~@foo', 'joystick', 'skins', 'dark', 'base.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist-wechat', 'assets', '~@foo'))).toBe(false)
    expect(manifestOf(read('game.js'))).toEqual({ main: [], subpackage: { name: 'assets', root: 'assets-sub/' } })
  })

  it('mainAssets 的 glob 作用在 ~<包名>/ 路径上：可以把插件资源放进主包，清单 main 含它', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())", { mainAssets: ['boot/**', '~@foo/joystick/**'] })
    mountPackage()
    await run()
    expect(existsSync(join(dir, 'dist-wechat', 'assets', '~@foo', 'joystick', 'knob.png'))).toBe(true)
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', '~@foo'))).toBe(false)
    expect(manifestOf(read('game.js')).main).toEqual(['~@foo/joystick/knob.png', '~@foo/joystick/skins/dark/base.png'])
  })

  it('体积报告算进插件资源：主包里的插件文件超限时构建失败并指出它', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())", { mainAssets: ['~@foo/joystick/**'] })
    mountPackage({ 'huge.png': Buffer.alloc(MAIN_PACKAGE_LIMIT) })
    await expect(run({ release: true })).rejects.toThrow(/Largest: assets\/~@foo\/joystick\/huge\.png 4\.00 MB/)
  })

  it('从依赖里拿掉插件包再构建：包里不再有它的目录', async () => {
    const run = fixture("import { v } from 'sapling2d'\nconsole.log(v(1, 2).toString())")
    mountPackage()
    await run()
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', '~@foo'))).toBe(true)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'game', private: true, dependencies: {} }))
    await run()
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', '~@foo'))).toBe(false)
    expect(existsSync(join(dir, 'dist-wechat', 'assets-sub', 'fruit.png'))).toBe(true)
  })
})

describe('WeChat 时钟', () => {
  it('真机（微秒、自纪元起）：按数量级判断，换算成毫秒', () => {
    let us = 1_791_345_484_883_330
    let ms = 1_791_345_484_883
    const now = _createClock({ now: () => us }, () => ms)
    const t0 = now()
    us += 16_000
    ms += 16
    expect(now() - t0).toBeCloseTo(16)
  })

  it('模拟器（毫秒、自启动起）：不换算', () => {
    let p = 4401.7
    let ms = 1_791_345_000_000
    const now = _createClock({ now: () => p }, () => ms)
    const t0 = now()
    p += 16
    ms += 16
    expect(now() - t0).toBeCloseTo(16)
  })

  it('数量级判断错了时，约 1 秒后按 Date.now() 纠正，且时间保持连续', () => {
    let p = 5_000_000 // 微秒但数值很小：会被误判为毫秒
    let ms = 0
    const now = _createClock({ now: () => p }, () => ms)
    p += 500_000
    ms += 500
    expect(now()).toBeGreaterThan(5_000_000) // 误判：按毫秒
    p += 600_000
    ms += 600
    const corrected = now() // 超过 1 秒：纠正
    p += 16_000
    ms += 16
    expect(now() - corrected).toBeCloseTo(16)
  })
})

describe('mainAssetsMatcher', () => {
  it('glob：** 任意层目录，* 不跨目录，? 一个字符；多个 glob 任一匹配；也可以是函数', () => {
    const boot = mainAssetsMatcher('boot/**')
    expect(['boot/a.png', 'boot/x/y.png'].map(boot)).toEqual([true, true])
    expect(['bootx/a.png', 'a/boot/b.png', 'a.png'].map(boot)).toEqual([false, false, false])
    const multi = mainAssetsMatcher(['*.json', '**/logo?.png'])
    expect(['ui.json', 'a/ui.json', 'logo1.png', 'x/y/logo2.png', 'x/logo10.png'].map(multi)).toEqual([true, false, true, true, false])
    expect(mainAssetsMatcher((p) => p.endsWith('.ttf'))('fonts/a.ttf')).toBe(true)
  })
})

describe('checkPackageSize', () => {
  const MB = 1024 * 1024
  it('超过 80% 警告，超限报错（只在发布构建）', () => {
    const ok = checkPackageSize({ gameJs: 1 * MB, main: [{ file: 'boot/logo.png', size: 0.1 * MB }], sub: 5 * MB, release: true })
    expect(ok.summary).toContain('main 1.10 MB / 4.00 MB (game.js 1.00 MB)')
    expect(ok.summary).toContain('asset subpackage 5.00 MB, total 6.10 MB / 30.00 MB')
    expect([ok.warnings, ok.error]).toEqual([[], null])

    const close = checkPackageSize({ gameJs: 1 * MB, main: [{ file: 'boot/bg.jpg', size: 2.3 * MB }], sub: 0, release: true })
    expect(close.warnings).toEqual([expect.stringMatching(/main package is 3\.30 MB, close to the 4\.00 MB limit\. Largest: assets\/boot\/bg\.jpg 2\.30 MB, game\.js 1\.00 MB/)])
    expect(close.error).toBeNull()

    const over = checkPackageSize({ gameJs: 1 * MB, main: [], sub: TOTAL_PACKAGE_LIMIT, release: true })
    expect(over.error).toMatch(/all packages together are 31\.00 MB, over the 30\.00 MB limit/)

    const dev = checkPackageSize({ gameJs: 7 * MB, main: [], sub: 0, release: false })
    expect([dev.warnings, dev.error]).toEqual([[], null])
    expect(dev.summary).toContain('simulator only')
  })
})

