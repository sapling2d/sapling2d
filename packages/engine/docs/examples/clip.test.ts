// #region example
import { ColorRect, Label, Node2D, rect, Scene, v } from 'sapling2d'

/** 商店列表：一个 300×400 的窗口只显示窗口里的卡片，滚出窗口的部分既看不见也点不到。 */
export class Shop extends Scene {
  readonly window = new Node2D({ position: v(225, 400), clipRect: rect(0, 0, 300, 400) })
  readonly content = new Node2D() // 滚动时移动它
  picked = ''

  override ready() {
    this.add(this.window)
    this.window.add(new ColorRect({ size: v(300, 400), color: 0x203040 })) // 窗口底色，和裁剪区一样大
    this.window.add(this.content)
    for (let i = 0; i < 8; i++) {
      const card = this.content.add(new ColorRect({ name: `Card${i}`, position: v(20, 20 + i * 110), size: v(260, 90), color: 0x4060a0, inputPickable: true }))
      card.add(new Label({ text: `道具 ${i + 1}`, position: v(16, 28) }))
      card.clicked.connect(() => (this.picked = card.name))
    }
  }

  /** 第 i 张卡片滚到窗口顶部（最简单的滚动：直接改内容的 y）。 */
  scrollTo(i: number) {
    this.content.y = -i * 110
  }
}
// #endregion

import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'

it('clip', async () => {
  const g = await createTestGame({ main: Shop })
  // #region test
  g.tap(375, 465) // 窗口顶部的第一张卡片
  expect(g.scene.picked).toBe('Card0')
  g.scene.scrollTo(4)
  g.tap(375, 465) // 同一个位置现在是第五张
  expect(g.scene.picked).toBe('Card4')
  g.tap(375, 820) // 第八张卡片的下半部分在窗口外：看不见，也点不到
  expect(g.scene.picked).toBe('Card4')
  expect(g.dump()).toContain('clipRect=(0, 0, 300, 400)')
  // #endregion
})
