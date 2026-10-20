import type { RawMotionEvent } from './index'

export type MotionPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** 生产者向 `MotionInput` 汇报状态的接口。 */
export interface MotionStatus {
  setStatus(available: boolean, permission: MotionPermission): void
}

/** 平台相关的采样来源：浏览器的 devicemotion、小游戏的加速度计。`start` / `stop` 跟着前后台走。 */
export interface MotionProducer {
  start(): void
  stop(): void
  dispose(): void
}

export type EmitMotion = (event: RawMotionEvent) => void
