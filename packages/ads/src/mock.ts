import type { Node } from 'sapling2d'
import { Signal } from 'sapling2d'
import { rect } from 'sapling2d'
import { v } from 'sapling2d'
import { CanvasLayer } from 'sapling2d'
import { ColorRect } from 'sapling2d'
import { Label } from 'sapling2d'
import type { AdBanner, FullscreenAd, InterstitialResult, RewardedResult } from './provider'

/**
 * 插件的 Autoload：mock 覆盖层和 banner 条挂在这下面。画在一切之上（`layer: 1000`），暂停时也能点（`processMode: 'always'`，子节点继承）。
 * 小游戏上真广告是原生层，这里什么都不画。
 */
export class AdHost extends CanvasLayer {
  constructor() {
    super({ name: 'Ads', layer: 1000, processMode: 'always' })
  }
}

/** mock 的行为：弹模拟覆盖层，或者不弹直接给结果（测试用）。 */
export type MockMode = 'ui' | 'rewarded' | 'skipped' | 'unavailable'

/** 覆盖层的几何（设计像素，相对可见区域中心）：无头测试按这些坐标 `g.tap`。 */
export const MOCK_LAYOUT = {
  panel: { width: 500, height: 320 },
  button: { width: 200, height: 90, offsetY: 120, offsetX: 130 },
}

/** Banner mock 的高度：真 banner 的高宽比约 0.27（屏幕像素），换算成设计像素。 */
export const MOCK_BANNER_RATIO = 0.27

/**
 * 场景树里画出来的激励视频 / 插屏：半透明遮罩吞掉其它点击，面板上一两个按钮。
 * 三端同一份代码：浏览器开发时看得见、点得了；无头测试 `g.tap` 按钮；小游戏没配 id 时也用它。
 */
export class MockFullscreenAd implements FullscreenAd {
  private readonly _host: AdHost
  private readonly _kind: 'rewarded' | 'interstitial'
  private readonly _mode: MockMode
  private _overlay: Node | null = null

  constructor(host: AdHost, kind: 'rewarded' | 'interstitial', mode: MockMode) {
    this._host = host
    this._kind = kind
    this._mode = mode
  }

  get ready(): boolean {
    return this._mode !== 'unavailable'
  }

  show(): Promise<RewardedResult | InterstitialResult> {
    if (this._mode !== 'ui') {
      // 不弹 UI：下一个微任务给结果
      const result: RewardedResult | InterstitialResult = this._mode === 'unavailable' ? 'unavailable' : this._kind === 'interstitial' ? 'shown' : this._mode
      return Promise.resolve(result)
    }
    return new Promise((resolve) => {
      const host = this._host
      const area = host.tree.viewport.visibleRect
      const c = area.center
      const overlay = host.add(new ColorRect({ name: 'AdMock', size: v(area.width, area.height), position: v(area.x, area.y), color: 0x000000, alpha: 0.6, inputPickable: true, hitArea: rect(0, 0, area.width, area.height) }))
      this._overlay = overlay
      const { panel, button } = MOCK_LAYOUT
      // 面板和文字的坐标相对遮罩（遮罩原点在可见区域左上角）
      const local = (x: number, y: number) => v(x - area.x, y - area.y)
      overlay.add(new ColorRect({ name: 'Panel', size: v(panel.width, panel.height), position: local(c.x - panel.width / 2, c.y - panel.height / 2), color: 0x202428 }))
      overlay.add(new Label({ text: this._kind === 'rewarded' ? '模拟激励视频' : '模拟插屏广告', fontSize: 40, align: 'center', position: local(c.x, c.y - 110) }))
      overlay.add(new Label({ text: '浏览器 / 测试里的占位，小游戏上是真的广告', fontSize: 22, color: 0x9a9a9a, align: 'center', position: local(c.x, c.y - 50) }))
      const finish = (result: RewardedResult | InterstitialResult) => {
        overlay.queueFree()
        this._overlay = null
        resolve(result)
      }
      const addButton = (name: string, text: string, cx: number, result: RewardedResult | InterstitialResult) => {
        const b = overlay.add(new ColorRect({ name, size: v(button.width, button.height), position: local(cx - button.width / 2, c.y + button.offsetY - button.height / 2), color: 0x3b7ddd, inputPickable: true, hitArea: rect(0, 0, button.width, button.height) }))
        b.add(new Label({ text, fontSize: 32, align: 'center', verticalAlign: 'center', position: v(button.width / 2, button.height / 2) }))
        b.clicked.connect(() => finish(result))
      }
      if (this._kind === 'rewarded') {
        addButton('Finish', '看完 ✓', c.x - button.offsetX, 'rewarded')
        addButton('Close', '关闭 ✗', c.x + button.offsetX, 'skipped')
      } else {
        addButton('Close', '关闭', c.x, 'shown')
      }
    })
  }

  dispose(): void {
    this._overlay?.queueFree()
    this._overlay = null
  }
}

/** 场景树里画出来的 banner：底部一条深色矩形加"广告"二字，高度和真的接近，布局在浏览器里就能调。 */
export class MockBanner implements AdBanner {
  readonly resized = new Signal<[height: number]>()
  private readonly _host: AdHost
  private _strip: ColorRect | null = null

  constructor(host: AdHost) {
    this._host = host
  }

  get visible(): boolean {
    return this._strip !== null
  }

  get height(): number {
    return this._strip?.size.y ?? 0
  }

  show(): Promise<boolean> {
    if (this._strip) return Promise.resolve(true)
    const host = this._host
    const vp = host.tree.viewport
    const area = vp.visibleRect
    const height = Math.round((MOCK_BANNER_RATIO * vp.screen.width) / vp.scale)
    const strip = host.add(new ColorRect({ name: 'AdBanner', size: v(area.width, height), position: v(area.x, area.bottom - height), color: 0x222222, alpha: 0.85 }))
    strip.add(new Label({ text: '广告', fontSize: 28, color: 0xbbbbbb, align: 'center', verticalAlign: 'center', position: v(area.width / 2, height / 2) }))
    this._strip = strip
    this.resized.emit(height)
    return Promise.resolve(true)
  }

  hide(): void {
    if (!this._strip) return
    this._strip.queueFree()
    this._strip = null
    this.resized.emit(0)
  }

  dispose(): void {
    this.hide()
  }
}
