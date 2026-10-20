import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserMotion } from '../src/plugins/motion/browser'
import type { RawMotionEvent } from '../src/plugins/motion/index'
import type { MotionPermission } from '../src/plugins/motion/producer'
import { createWechatMotion } from '../src/plugins/motion/wechat'

/** 记录状态汇报的假 MotionInput。 */
function status() {
  const s = { available: false, permission: 'unsupported' as MotionPermission, setStatus(a: boolean, p: MotionPermission) {
    s.available = a
    s.permission = p
  } }
  return s
}

/** 假的 window：按类型记监听器，能手动触发。 */
function fakeWindow() {
  const listeners = new Map<string, Set<(e: unknown) => void>>()
  const win = {
    addEventListener(type: string, cb: (e: unknown) => void) {
      ;(listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(cb)
    },
    removeEventListener(type: string, cb: (e: unknown) => void) {
      listeners.get(type)?.delete(cb)
    },
  }
  const fire = (type: string, e: unknown = {}) => {
    for (const cb of [...(listeners.get(type) ?? [])]) cb(e)
  }
  const count = (type: string) => listeners.get(type)?.size ?? 0
  return { win, fire, count }
}

const g = globalThis as unknown as Record<string, unknown>
const saved = { window: g.window, DeviceMotionEvent: g.DeviceMotionEvent, wx: g.wx }
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete g[k]
    else g[k] = v
  }
})

describe('浏览器生产者', () => {
  it('没有 DeviceMotionEvent（桌面 Chrome、Node）：返回 null', () => {
    const { win } = fakeWindow()
    g.window = win
    delete g.DeviceMotionEvent
    expect(createBrowserMotion(() => {}, status())).toBeNull()
  })

  it('不需要权限的浏览器：start 后监听 devicemotion，m/s² 换成 g；stop 取消监听', () => {
    const { win, fire, count } = fakeWindow()
    g.window = win
    g.DeviceMotionEvent = function () {}
    const events: RawMotionEvent[] = []
    const s = status()
    const p = createBrowserMotion((e) => events.push(e), s)!
    expect([s.available, s.permission, count('devicemotion')]).toEqual([true, 'granted', 0])
    p.start()
    expect(count('devicemotion')).toBe(1)
    fire('devicemotion', { accelerationIncludingGravity: { x: 9.80665 / 2, y: null, z: 9.80665 } })
    expect(events).toEqual([{ type: 'motion', x: 0.5, y: 0, z: 1 }])
    fire('devicemotion', { accelerationIncludingGravity: null }) // 没有数据的事件忽略
    expect(events).toHaveLength(1)
    p.stop()
    expect(count('devicemotion')).toBe(0)
    p.start()
    p.dispose()
    expect(count('devicemotion')).toBe(0)
  })

  it('iOS：prompt → 第一次手势里申请；同意后才监听；拒绝后不再问', async () => {
    const { win, fire, count } = fakeWindow()
    g.window = win
    let answer: 'granted' | 'denied' = 'granted'
    let asked = 0
    g.DeviceMotionEvent = Object.assign(function () {}, {
      requestPermission: () => {
        asked++
        return Promise.resolve(answer)
      },
    })
    const s = status()
    const p = createBrowserMotion(() => {}, s)!
    p.start()
    expect([s.permission, count('devicemotion'), count('pointerdown')]).toEqual(['prompt', 0, 1])
    fire('pointerdown')
    await Promise.resolve()
    expect([s.permission, count('devicemotion'), count('pointerdown'), asked]).toEqual(['granted', 1, 0, 1])
    p.dispose()

    answer = 'denied'
    const s2 = status()
    const p2 = createBrowserMotion(() => {}, s2)!
    p2.start()
    fire('touchend')
    await Promise.resolve()
    expect([s2.permission, count('devicemotion'), count('touchend')]).toEqual(['denied', 0, 0])
    fire('pointerdown') // 已经移除监听：不再申请
    expect(asked).toBe(2)
    p2.dispose()
  })

  it('iOS：申请被拒绝（不在手势里）时下一次手势再试；同时只发一次申请', async () => {
    const { win, fire } = fakeWindow()
    g.window = win
    let asked = 0
    let fail = true
    g.DeviceMotionEvent = Object.assign(function () {}, {
      requestPermission: () => {
        asked++
        return fail ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve('granted' as const)
      },
    })
    const s = status()
    const p = createBrowserMotion(() => {}, s)!
    p.start()
    fire('pointerdown')
    fire('pointerdown') // 上一次还没回来：不重复申请
    await Promise.resolve()
    await Promise.resolve()
    expect([asked, s.permission]).toEqual([1, 'prompt'])
    fail = false
    fire('pointerdown')
    await Promise.resolve()
    expect([asked, s.permission]).toEqual([2, 'granted'])
    p.dispose()
  })
})

describe('小游戏生产者', () => {
  it('没有加速度计 API（旧基础库）：返回 null', () => {
    g.wx = {}
    expect(createWechatMotion(() => {}, status())).toBeNull()
  })

  it('onAccelerometerChange 的值直接当 g；start / stop 对应 startAccelerometer / stopAccelerometer，不重复', () => {
    const log: string[] = []
    let cb: ((res: { x: number; y: number; z: number }) => void) | null = null
    g.wx = {
      startAccelerometer: (o: { interval: string }) => log.push(`start:${o.interval}`),
      stopAccelerometer: () => log.push('stop'),
      onAccelerometerChange: (f: typeof cb) => (cb = f),
      offAccelerometerChange: (f: typeof cb) => {
        if (f === cb) cb = null
      },
    }
    const events: RawMotionEvent[] = []
    const s = status()
    const p = createWechatMotion((e) => events.push(e), s)!
    expect([s.available, s.permission, log]).toEqual([true, 'granted', []])
    p.start()
    p.start()
    cb!({ x: 0.1, y: 0.2, z: 0.9 })
    expect(events).toEqual([{ type: 'motion', x: 0.1, y: 0.2, z: 0.9 }])
    p.stop()
    p.stop()
    p.start()
    p.dispose()
    expect(log).toEqual(['start:game', 'stop', 'start:game', 'stop'])
    expect(cb).toBeNull()
  })
})
