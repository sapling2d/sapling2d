import type { EmitMotion, MotionProducer, MotionStatus } from './producer'

/** 用到的那一点 wx API。不引用 wx.d.ts：那会把 `wx` 全局声明带进核心的类型检查程序。 */
interface AccelerometerResult {
  readonly x: number
  readonly y: number
  readonly z: number
}
interface WxLike {
  startAccelerometer(options?: { interval?: 'game' | 'ui' | 'normal'; fail?: (err: { errMsg: string }) => void }): void
  stopAccelerometer(options?: { fail?: (err: { errMsg: string }) => void }): void
  onAccelerometerChange(cb: (res: AccelerometerResult) => void): void
  offAccelerometerChange?(cb: (res: AccelerometerResult) => void): void
}

/**
 * `wx.onAccelerometerChange` → `motion` 事件。小游戏给的已经是 g 单位；轴向按 W3C 设备坐标处理，真机核对后如有出入在这里换算。
 * `interval: 'game'` 约 20 ms 一次。切到后台 `stopAccelerometer` 省电，回到前台重新 start。
 */
export function createWechatMotion(emit: EmitMotion, status: MotionStatus): MotionProducer | null {
  const wx = (globalThis as unknown as { wx?: WxLike }).wx
  if (!wx || typeof wx.onAccelerometerChange !== 'function' || typeof wx.startAccelerometer !== 'function') return null

  const onChange = (res: AccelerometerResult) => emit({ type: 'motion', x: res.x, y: res.y, z: res.z })
  let running = false
  status.setStatus(true, 'granted')
  wx.onAccelerometerChange(onChange)
  return {
    start() {
      if (running) return
      running = true
      wx.startAccelerometer({ interval: 'game', fail: (err) => console.warn(`[sapling2d] motion: startAccelerometer failed: ${err.errMsg}`) })
    },
    stop() {
      if (!running) return
      running = false
      wx.stopAccelerometer({ fail: () => {} })
    },
    dispose() {
      this.stop()
      wx.offAccelerometerChange?.(onChange)
    },
  }
}
