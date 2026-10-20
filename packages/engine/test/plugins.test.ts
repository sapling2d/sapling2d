import { afterEach, describe, expect, it, vi } from 'vitest'
import { key, Keyboard, Node, Node2D, pointerPress, rect, Scene, v, type InputBinding, type InputSource, type Plugin, type PluginContext, type RawInputEvent } from 'sapling2d'
import { createTestGame } from 'sapling2d/testing'

// 一个外部插件会这样登记自己的事件和绑定
declare module 'sapling2d' {
  interface InputEventRegistry {
    dial: { type: 'dial'; value: number }
  }
  interface InputBindingRegistry {
    dial: { readonly type: 'dial' }
  }
  interface ActionRegistry {
    turn: true
    tap: true
  }
}

/** 假设备：一个旋钮，事件给出 0–1 的值，绑定 `dial()` 的动作得到这个力度。 */
class Dial implements InputSource {
  readonly bindingTypes = ['dial']
  readonly eventTypes = ['dial', 'pointerdown']
  value = 0
  readonly log: string[] = []
  frames = 0

  handle(event: RawInputEvent): void {
    if (event.type === 'dial') this.value = event.value
    this.log.push(event.type)
  }
  beginFrame(): void {
    this.frames++
  }
  strength(_action: string, bindings: readonly InputBinding[]): number {
    return bindings.some((b) => b.type === 'dial') ? this.value : 0
  }
  releaseAll(queue: RawInputEvent[]): void {
    queue.push({ type: 'dial', value: 0 })
  }
}

const dial = (): InputBinding => ({ type: 'dial' })

function dialPlugin(onInstall?: (ctx: PluginContext) => void): Plugin & { dial: Dial; disposed: boolean } {
  const plugin = {
    dial: new Dial(),
    disposed: false,
    install(ctx: PluginContext) {
      onInstall?.(ctx)
      ctx.provide(Dial, plugin.dial)
      ctx.tree.input.addSource(plugin.dial)
      return () => {
        plugin.disposed = true
        ctx.tree.input.removeSource(plugin.dial)
      }
    },
  }
  return plugin
}

class Marker {}

describe('插件机制', () => {
  it('按 plugins 的顺序安装，拿到 tree 和 platform.kind；默认的键盘插件在最前面', async () => {
    const order: string[] = []
    let seenTree: unknown = null
    const g = await createTestGame({
      main: Scene,
      plugins: [
        { install: (ctx) => void order.push(`a:${ctx.platform.kind}:${ctx.tree.get(Keyboard) instanceof Keyboard}`) },
        {
          install: (ctx) => {
            seenTree = ctx.tree
            order.push('b')
          },
        },
      ],
    })
    expect(order).toEqual(['a:headless:true', 'b'])
    expect(seenTree).toBe(g.tree)
    expect(g.tree.get(Keyboard)).toBeInstanceOf(Keyboard)
  })

  it('createTestGame({ plugins: [] }) 仍然有键盘：pressKey 可用', async () => {
    const g = await createTestGame({ main: Scene, plugins: [], actions: { tap: [key('Space')] } })
    g.keyDown('Space')
    g.step()
    expect(g.tree.input.isActionJustPressed('tap')).toBe(true)
    expect(g.tree.get(Keyboard).isPressed('Space')).toBe(true)
  })

  it('tree.get 取到 provide 的服务；没装时报错并提示 plugins；同一个 token 提供两次报错', async () => {
    const p = dialPlugin()
    const g = await createTestGame({ main: Scene, plugins: [p] })
    expect(g.tree.get(Dial)).toBe(p.dial)
    expect(() => g.tree.get(Marker)).toThrow(/Marker is not installed.*plugins: \[/)
    await expect(createTestGame({ main: Scene, plugins: [dialPlugin(), dialPlugin()] })).rejects.toThrow(/Dial is already provided/)
  })

  it('game.destroy() 按相反顺序调用卸载函数', async () => {
    const order: string[] = []
    const g = await createTestGame({
      main: Scene,
      plugins: [{ install: () => () => void order.push('a') }, { install: () => undefined }, { install: () => () => void order.push('b') }],
    })
    g.game.destroy()
    expect(order).toEqual(['b', 'a'])
  })

  it('卸载后来源不再参与：removeSource 生效', async () => {
    const p = dialPlugin()
    const g = await createTestGame({ main: Scene, plugins: [p], actions: { turn: [dial()] } })
    g.inject({ type: 'dial', value: 1 })
    g.step()
    expect(g.tree.input.isActionPressed('turn')).toBe(true)
    g.game.destroy()
    expect(p.disposed).toBe(true)
    g.step()
    expect(g.tree.input.isActionPressed('turn')).toBe(false)
  })
})

describe('InputSource', () => {
  class Recorder extends Node {
    frames: string[] = []
    override process() {
      const i = this.tree.input
      this.frames.push([i.isActionJustPressed('turn') && 'turn!', i.isActionPressed('turn') && 'turn', i.isActionJustReleased('turn') && 'turn^'].filter(Boolean).join(' '))
    }
  }

  it('注入的事件在下一次 step 的帧首交给订阅它的来源；力度进入动作状态', async () => {
    const p = dialPlugin()
    const g = await createTestGame({ main: Scene, plugins: [p], actions: { turn: [dial()] } })
    const rec = g.scene.add(new Recorder())
    g.inject({ type: 'dial', value: 0.3 })
    expect(p.dial.value).toBe(0) // 还没处理
    g.step()
    expect(p.dial.value).toBe(0.3)
    expect(g.tree.input.getActionStrength('turn')).toBeCloseTo(0.3)
    g.inject({ type: 'dial', value: 0.8 })
    g.step()
    g.inject({ type: 'dial', value: 0 })
    g.step()
    expect(rec.frames).toEqual(['', 'turn! turn', 'turn^'])
  })

  it('同一帧内先到 1 再到 0：刚按下和刚松开同帧都为 true', async () => {
    const p = dialPlugin()
    const g = await createTestGame({ main: Scene, plugins: [p], actions: { turn: [dial()] } })
    const rec = g.scene.add(new Recorder())
    g.inject({ type: 'dial', value: 1 })
    g.inject({ type: 'dial', value: 0 })
    g.step()
    expect(rec.frames).toEqual(['turn! turn^'])
  })

  it('几个来源取最大：旋钮 0.3 时按着绑定的键，力度是 1', async () => {
    const p = dialPlugin()
    const g = await createTestGame({ main: Scene, plugins: [p], actions: { turn: [dial(), key('KeyD')] } })
    g.inject({ type: 'dial', value: 0.3 })
    g.keyDown('KeyD')
    g.step()
    expect(g.tree.input.getActionStrength('turn')).toBe(1)
    g.keyUp('KeyD')
    g.step()
    expect(g.tree.input.getActionStrength('turn')).toBeCloseTo(0.3)
  })

  it('beginFrame 每帧调用一次，在动作更新之前', async () => {
    const p = dialPlugin()
    const g = await createTestGame({ main: Scene, plugins: [p] })
    g.step(3)
    expect(p.dial.frames).toBe(3)
  })

  it('订阅了指针事件的来源在节点信号之后收到它（只读观察）', async () => {
    const p = dialPlugin()
    const g = await createTestGame({ main: Scene, plugins: [p] })
    const log: string[] = []
    const b = g.scene.add(new Node2D({ inputPickable: true, hitArea: rect(-50, -50, 100, 100), position: v(100, 100) }))
    b.pointerDown.connect(() => log.push('node'))
    p.dial.log.length = 0
    g.pointerDown(100, 100)
    g.step()
    expect(log).toEqual(['node'])
    expect(p.dial.log).toEqual(['pointerdown'])
    g.pointerUp(100, 100)
    g.step()
    expect(p.dial.log).toEqual(['pointerdown']) // 没订阅 pointerup
  })

  it('定义动作时没有来源认领的绑定类型警告一次；pointerPress() 和 key() 不警告', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const g = await createTestGame({ main: Scene, actions: { turn: [dial(), dial()], tap: [pointerPress(), key('Space')] } })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatch(/binding type "dial" has no input source.*plugins/)
    g.tree.input.addAction('turn', [dial()])
    expect(warn).toHaveBeenCalledTimes(1)
    // 装了插件就不警告
    await createTestGame({ main: Scene, plugins: [dialPlugin()], actions: { turn: [dial()] } })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('键盘插件', () => {
  afterEach(() => vi.restoreAllMocks())

  it('切到后台：按着的键在下一帧帧首松开；队列里还没处理的按下也不会卡住', async () => {
    const g = await createTestGame({ main: Scene, pauseOnBackground: false, actions: { tap: [key('Space')], turn: [key('KeyD')] } })
    g.keyDown('Space')
    g.step()
    expect(g.tree.input.isActionPressed('tap')).toBe(true)
    g.keyDown('KeyD') // 还在队列里
    g.setFocus(false)
    g.step()
    expect(g.tree.input.isActionJustReleased('tap')).toBe(true)
    expect(g.tree.input.isActionPressed('tap')).toBe(false)
    expect(g.tree.input.isActionPressed('turn')).toBe(false)
    expect(g.tree.input.isActionJustPressed('turn')).toBe(true) // 按下和松开在同一帧
    expect(g.tree.get(Keyboard).isPressed('Space')).toBe(false)
    expect(g.tree.get(Keyboard).isPressed('KeyD')).toBe(false)
  })

  it('切到后台时来源的 releaseAll 也被调用', async () => {
    const p = dialPlugin()
    const g = await createTestGame({ main: Scene, pauseOnBackground: false, plugins: [p], actions: { turn: [dial()] } })
    g.inject({ type: 'dial', value: 1 })
    g.step()
    g.setFocus(false)
    g.step()
    expect(g.tree.input.isActionJustReleased('turn')).toBe(true)
  })

  it('无头和小游戏平台没有键盘事件源，但 Keyboard 服务仍然存在', async () => {
    const g = await createTestGame({ main: Scene })
    expect(g.platform.kind).toBe('headless')
    expect(g.tree.get(Keyboard).isPressed('Space')).toBe(false)
  })
})
