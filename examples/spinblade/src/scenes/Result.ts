import { ColorRect, Label, rect, Scene, v } from 'sapling2d'
import { Ads } from '@sapling2d/ads'
import { ASSETS } from '../assets'
import { Arena } from './Arena'

/** 结果画面出现后多久才接受输入：避免结束时正按着的手指马上开始下一局。 */
const INPUT_DELAY = 0.5
/** 看完激励视频的奖励：下一局多带几把刀。 */
export const AD_BONUS_KNIVES = 4
/** 广告按钮的默认位置（底部有 banner 时往上让）。 */
const AD_BUTTON = { x: 375, y: 900, width: 360, height: 90 }

/**
 * 结果画面：通关或失败；点屏幕（或按空格）再来一局。
 * 广告（`@sapling2d/ads`）：进入时放一次插屏；有激励视频时显示"看视频 · 多带 4 把刀"，看完就重开并多带刀；底部 banner，离开时隐藏。
 * 浏览器和测试里这些都是 mock；小游戏上配了广告位 id 才是真的。
 */
export class Result extends Scene {
  static override assets = ASSETS
  private _readyAt = 0
  private _hint!: Label
  private _adButton: ColorRect | null = null
  private _offResized: (() => void) | null = null

  constructor(readonly params: { cleared: boolean }) {
    super()
  }

  override ready() {
    const r = this.tree.viewport.visibleRect
    const cx = r.x + r.width / 2
    this.add(new Label({ name: 'Title', text: this.params.cleared ? '通关！' : '失败', fontSize: 96, color: this.params.cleared ? 0xffe060 : 0xff6060, align: 'center', verticalAlign: 'center', position: v(cx, 560) }))
    this._hint = this.add(new Label({ name: 'Hint', text: '点击屏幕再来一局', fontSize: 36, color: 0xcccccc, align: 'center', verticalAlign: 'center', position: v(cx, 760) }))
    this._readyAt = this.tree.time + INPUT_DELAY

    const ads = this.tree.get(Ads)
    void ads.showInterstitial() // 结果不影响流程
    if (ads.ready.rewarded) {
      const b = this.add(new ColorRect({ name: 'ReviveAd', size: v(AD_BUTTON.width, AD_BUTTON.height), color: 0x3b7ddd, inputPickable: true, hitArea: rect(0, 0, AD_BUTTON.width, AD_BUTTON.height) }))
      b.add(new Label({ text: `看视频 · 多带 ${AD_BONUS_KNIVES} 把刀`, fontSize: 32, align: 'center', verticalAlign: 'center', position: v(AD_BUTTON.width / 2, AD_BUTTON.height / 2) }))
      b.clicked.connect(() => void this._watchAd(), this)
      this._adButton = b
    }
    void ads.banner.show()
    this._offResized = ads.banner.resized.connect(() => this._layout())
    this._layout()
  }

  override exitTree() {
    this._offResized?.()
    this.tree.get(Ads).banner.hide()
  }

  override process() {
    if (this.tree.time >= this._readyAt && this.tree.input.isActionJustPressed('confirm')) void this.tree.changeScene(Arena)
  }

  /** 看激励视频：只有看完才有奖励（重开本关并多带刀）；中途关了或没广告就留在结果页。 */
  private async _watchAd() {
    if (this.tree.time < this._readyAt) return
    const result = await this.tree.get(Ads).showRewarded()
    if (result === 'rewarded') {
      const arena = await this.tree.changeScene(Arena)
      arena.giveKnives(arena.player, AD_BONUS_KNIVES)
    } else if (this.isInsideTree) {
      this._hint.text = result === 'skipped' ? '没看完，没有奖励。点击屏幕再来一局' : '暂时没有广告。点击屏幕再来一局'
    }
  }

  /** 底部有 banner 时把按钮往上让。 */
  private _layout() {
    if (!this._adButton) return
    const r = this.tree.viewport.visibleRect
    const bottom = r.bottom - this.tree.get(Ads).banner.height
    const y = Math.min(AD_BUTTON.y, bottom - AD_BUTTON.height / 2 - 60)
    this._adButton.position = v(AD_BUTTON.x - AD_BUTTON.width / 2, y - AD_BUTTON.height / 2)
  }
}
