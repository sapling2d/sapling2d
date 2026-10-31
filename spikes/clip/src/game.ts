/**
 * 裁剪 spike 的场景（平台无关）。三个阶段：
 * - correct：嵌套三层的裁剪（外层不旋转、中层 15°、内层 -30°）+ 伸出设计区的背景（`keep` 模式的全屏 mask）
 * - masked：10 个带裁剪的容器 × 20 个来回弹的精灵（一半容器旋转 10°）
 * - plain：同样的 10 × 20，不裁剪（对照组）
 */
import { CanvasLayer, ColorRect, Label, Node2D, Rect2, Scene, Sprite2D, tex, v, type Game, type GameOptions } from 'sapling2d'
import { ClipMasks } from './clip'

export const ASSETS = { fruit: tex('fruit.png'), enemy: tex('enemy.png') }

export type Phase = 'correct' | 'masked' | 'plain'

/** 常驻 HUD：阶段名、帧数、frameStats。 */
export class Hud extends CanvasLayer {
  readonly label = new Label({ fontSize: 24, color: 0x99ff99, lineHeight: 30, position: v(16, 16), stroke: { color: 0x000000, width: 4 } })
  frames = 0

  constructor() {
    super({ layer: 10, name: 'Hud' })
    this.add(this.label)
  }

  override process() {
    this.frames++
  }
}

class Box extends Node2D {
  constructor(name: string, readonly clipRect: Rect2, color: number, extra: Partial<{ position: ReturnType<typeof v>; rotationDegrees: number }> = {}) {
    super({ name, position: extra.position ?? v(0, 0) })
    if (extra.rotationDegrees !== undefined) this.rotationDegrees = extra.rotationDegrees
    // 底色比裁剪区各边大 40：裁剪生效时边缘应该是“直的、正好在 rect 上”，失效时能看到多出来的一圈
    this.add(new ColorRect({ name: 'Bg', position: v(clipRect.x - 40, clipRect.y - 40), size: v(clipRect.width + 80, clipRect.height + 80), color, alpha: 0.85 }))
  }

  override ready() {
    this.tree.system(ClipMasks).add(this, this.clipRect)
  }
}

export class CorrectScene extends Scene {
  static assets = ASSETS

  override ready() {
    // 伸出设计区（750×1334）的背景：keep 模式下设计区外应是黑边
    this.add(new ColorRect({ name: 'Outside', position: v(-400, -600), size: v(1550, 2600), color: 0x3a2a5a }))
    this.add(new ColorRect({ name: 'Design', size: v(750, 1334), color: 0x16233a }))

    const outer = this.add(new Box('Outer', new Rect2(-250, -250, 500, 500), 0x2d6a4f, { position: v(375, 600) }))
    // 四条边各一个跨边界的水果，角上再放一个
    for (const [x, y] of [[-250, 0], [250, 0], [0, -250], [0, 250], [250, 250]] as const) outer.add(new Sprite2D({ texture: ASSETS.fruit, position: v(x, y) }))

    const mid = outer.add(new Box('Mid', new Rect2(-150, -150, 300, 300), 0xd97706, { position: v(60, 40), rotationDegrees: 15 }))
    for (const [x, y] of [[-150, -60], [150, 60], [40, 150]] as const) mid.add(new Sprite2D({ texture: ASSETS.fruit, position: v(x, y), scale: v(0.7, 0.7) }))

    const inner = mid.add(new Box('Inner', new Rect2(-80, -80, 160, 160), 0xb91c1c, { position: v(-20, -20), rotationDegrees: -30 }))
    inner.add(new Sprite2D({ texture: ASSETS.fruit, position: v(70, -10), scale: v(0.6, 0.6) }))

    // 设计区右边缘：一半在 keep 的黑边里
    this.add(new Sprite2D({ texture: ASSETS.fruit, position: v(750, 1100) }))
    // 不裁剪的对照：一个一样大的 Box 但不加 clip，放在下面
    const ref = this.add(new Node2D({ name: 'NoClipRef', position: v(375, 1180) }))
    ref.add(new ColorRect({ position: v(-140, -60), size: v(280, 120), color: 0x2d6a4f, alpha: 0.85 }))
    ref.add(new Sprite2D({ texture: ASSETS.fruit, position: v(-140, 0) }))
    ref.add(new Sprite2D({ texture: ASSETS.fruit, position: v(140, 0) }))
  }
}

class Bouncer extends Sprite2D {
  vx = 0
  vy = 0
  constructor(private readonly _w: number, private readonly _h: number) {
    super({ texture: ASSETS.enemy })
  }
  override process(dt: number) {
    let x = this.x + this.vx * dt
    let y = this.y + this.vy * dt
    // 让精灵来回越过边界 40 像素
    if (x < -40 || x > this._w + 40) this.vx = -this.vx
    if (y < -40 || y > this._h + 40) this.vy = -this.vy
    x = Math.min(this._w + 40, Math.max(-40, x))
    y = Math.min(this._h + 40, Math.max(-40, y))
    this.x = x
    this.y = y
  }
}

export class StressScene extends Scene {
  static assets = ASSETS
  static masked = true

  override ready() {
    this.add(new ColorRect({ name: 'Design', size: v(750, 1334), color: 0x16233a }))
    const W = 300
    const H = 220
    const rng = this.tree.rng
    for (let i = 0; i < 10; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const box = this.add(new Node2D({ name: `Box${i}`, position: v(60 + col * 360, 60 + row * 250) }))
      if (i % 2 === 1) box.rotationDegrees = 10
      box.add(new ColorRect({ position: v(-40, -40), size: v(W + 80, H + 80), color: 0x1f3b5c, alpha: 0.9 }))
      if (StressScene.masked) this.tree.system(ClipMasks).add(box, new Rect2(0, 0, W, H))
      for (let j = 0; j < 20; j++) {
        const b = box.add(new Bouncer(W, H))
        b.position = v(rng.randf() * W, rng.randf() * H)
        b.vx = (rng.randf() - 0.5) * 300
        b.vy = (rng.randf() - 0.5) * 300
      }
    }
  }
}

export const gameOptions: GameOptions<CorrectScene> = {
  main: CorrectScene,
  autoloads: [Hud],
  design: { width: 750, height: 1334, aspect: 'keep' },
  seed: 1,
}

const PHASES: { phase: Phase; seconds: number }[] = [
  { phase: 'correct', seconds: 6 },
  { phase: 'masked', seconds: 10 },
  { phase: 'plain', seconds: 10 },
]

/**
 * 驱动阶段切换、每 5 秒打印 `[perf]`、每阶段在中点截图。`hold` 给定时只停在那个阶段。
 * 返回一个 Promise，全部跑完（或 hold）时 resolve。
 */
export function runPhases(game: Game, opts: { hold?: Phase | null; snapshot: (label: string) => void; log: (line: string) => void }): Promise<void> {
  const hud = game.tree.autoload(Hud)
  let current: Phase = 'correct'
  let phaseStart = 0
  const t0 = now()
  const f = (x: number) => x.toFixed(2)

  const perf = () => {
    const s = game.frameStats
    if (s.frames === 0) return ''
    return `fps ${s.fps.toFixed(1)} interval max ${f(s.intervalMax)} | logic ${f(s.logicAvg)} max ${f(s.logicMax)} | render ${f(s.renderAvg)} max ${f(s.renderMax)} ms`
  }
  const hudTimer = setInterval(() => {
    hud.label.text = `clip spike · ${current}${opts.hold ? ' (hold)' : ''}\nframes ${hud.frames}  masks ${game.tree.system(ClipMasks).count}\n${perf()}`
  }, 500)
  const perfTimer = setInterval(() => {
    const line = perf()
    if (line) opts.log(`[perf] ${current} ${line}`)
    game.resetFrameStats()
  }, 5000)

  const show = async (phase: Phase) => {
    current = phase
    StressScene.masked = phase === 'masked'
    await game.tree.changeScene(phase === 'correct' ? CorrectScene : StressScene)
    phaseStart = now()
    game.resetFrameStats()
    opts.log(`[clip] phase ${phase}`)
  }

  return new Promise<void>((resolve) => {
    const run = async () => {
      if (opts.hold) {
        if (opts.hold !== 'correct') await show(opts.hold)
        setTimeout(() => opts.snapshot(`${opts.hold}`), 4000)
        return
      }
      for (const { phase, seconds } of PHASES) {
        if (phase !== 'correct') await show(phase)
        else opts.log('[clip] phase correct')
        await sleep((seconds * 1000) / 2)
        opts.snapshot(phase)
        await sleep((seconds * 1000) / 2)
      }
      clearInterval(perfTimer)
      clearInterval(hudTimer)
      hud.label.text = `clip spike · done`
      opts.log(`[clip] done after ${((now() - t0) / 1000).toFixed(1)} s`)
      resolve()
    }
    void run()
  })
  function now() {
    return Date.now()
  }
  function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }
}
