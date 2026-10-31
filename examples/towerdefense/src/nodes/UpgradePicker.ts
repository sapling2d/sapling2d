import { CanvasLayer, ColorRect, Ease, Label, Signal, v } from 'sapling2d'
import { Button } from '@sapling2d/ui'
import type { Upgrade } from '../skills'

const CARD_W = 560
const CARD_H = 200

/** 一张升级卡片：`@sapling2d/ui` 的按钮，标题是按钮文字，说明加在视觉主体 `body` 下（随按下反馈一起缩放）。 */
class Card extends Button {
  constructor(readonly upgrade: Upgrade) {
    super({ size: v(CARD_W, CARD_H), text: upgrade.title, fontSize: 44, pressEffect: { scale: 1.04, duration: 0.08 } })
    this.label.position = v(0, -38)
    this.body.add(new Label({ text: upgrade.desc, fontSize: 30, color: 0x4a4a58, align: 'center', verticalAlign: 'center', position: v(0, 38) }))
  }
}

/**
 * 波次之间的三选一：半透明遮罩挡住下面的点击，三张卡片从下往上弹出，选一张就关闭。
 */
export class UpgradePicker extends CanvasLayer {
  readonly picked = new Signal<[upgrade: Upgrade]>()
  readonly cards: Card[] = []

  constructor(readonly upgrades: readonly Upgrade[]) {
    super({ name: 'UpgradePicker', layer: 20 })
  }

  override ready() {
    const r = this.tree.viewport.visibleRect
    // 遮罩：可点击，吃掉卡片以外的点击（不会点到下面的槽位）
    this.add(new ColorRect({ position: r.position, size: r.size, color: 0x000000, alpha: 0.6, inputPickable: true }))
    const safe = this.tree.viewport.safeRect
    const cx = (safe.left + safe.right) / 2
    this.add(new Label({ text: '选择一个升级', fontSize: 48, color: 0xffffff, align: 'center', position: v(cx, safe.top + 250), stroke: { color: 0x000000, width: 5 } }))
    this.upgrades.forEach((u, i) => {
      const card = this.add(new Card(u))
      const y = safe.top + 360 + i * (CARD_H + 40)
      card.position = v(cx - CARD_W / 2, y + 300)
      card.alpha = 0
      card.createTween().wait(i * 0.08).to(card, { y, alpha: 1 }, 0.35, Ease.BackOut)
      card.clicked.connect(() => this._pick(u), this)
      this.cards.push(card)
    })
  }

  private _pick(u: Upgrade) {
    if (this.isQueuedForDeletion) return
    this.picked.emit(u)
    this.queueFree()
  }
}
