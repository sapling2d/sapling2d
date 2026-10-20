import type { EmitMotion, MotionProducer, MotionStatus } from './producer'

/** 浏览器里用到的那一点 DOM。核心的类型检查没有 DOM 库，这里只声明用到的成员。 */
interface MotionEventLike {
  readonly accelerationIncludingGravity: { readonly x: number | null; readonly y: number | null; readonly z: number | null } | null
}
interface WindowLike {
  addEventListener(type: string, listener: (event: MotionEventLike) => void, capture?: boolean): void
  removeEventListener(type: string, listener: (event: MotionEventLike) => void, capture?: boolean): void
}
interface DeviceMotionEventLike {
  /** iOS 13+：必须在用户手势的调用栈里同步调用。 */
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/** 标准重力加速度，把 m/s² 换成 g。 */
const G = 9.80665
/** 申请权限时监听的手势（捕获阶段，和 BrowserAudio 的解锁一样）。 */
const GESTURE_EVENTS = ['pointerdown', 'touchend', 'keydown']

/**
 * `devicemotion` → `motion` 事件（单位 g）。没有 `DeviceMotionEvent` 的浏览器返回 null。
 * iOS：在第一次手势里 `requestPermission()`；同意后才开始监听，拒绝后不再尝试，被拒（不在手势里）则下一次手势再试。
 */
export function createBrowserMotion(emit: EmitMotion, status: MotionStatus): MotionProducer | null {
  const g = globalThis as unknown as { window?: WindowLike; DeviceMotionEvent?: DeviceMotionEventLike }
  const win = g.window
  const ctor = g.DeviceMotionEvent
  if (!win || !ctor) return null

  const onMotion = (e: MotionEventLike) => {
    const a = e.accelerationIncludingGravity
    if (!a) return
    emit({ type: 'motion', x: (a.x ?? 0) / G, y: (a.y ?? 0) / G, z: (a.z ?? 0) / G })
  }
  let granted = false
  let wanted = false
  let listening = false
  const sync = () => {
    const should = granted && wanted
    if (should === listening) return
    listening = should
    if (should) win.addEventListener('devicemotion', onMotion)
    else win.removeEventListener('devicemotion', onMotion)
  }

  let onGesture: ((e: MotionEventLike) => void) | null = null
  const stopAsking = () => {
    if (!onGesture) return
    for (const type of GESTURE_EVENTS) win.removeEventListener(type, onGesture, true)
    onGesture = null
  }
  if (typeof ctor.requestPermission === 'function') {
    status.setStatus(true, 'prompt')
    const request = ctor.requestPermission
    let pending = false
    onGesture = () => {
      if (pending) return
      pending = true
      request().then(
        (result) => {
          pending = false
          granted = result === 'granted'
          status.setStatus(true, granted ? 'granted' : 'denied')
          stopAsking()
          sync()
        },
        () => {
          pending = false // 不在手势里被拒绝：下一次手势再试
        },
      )
    }
    for (const type of GESTURE_EVENTS) win.addEventListener(type, onGesture, true)
  } else {
    granted = true
    status.setStatus(true, 'granted')
  }

  return {
    start() {
      wanted = true
      sync()
    },
    stop() {
      wanted = false
      sync()
    },
    dispose() {
      wanted = false
      sync()
      stopAsking()
    },
  }
}
