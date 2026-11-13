// #region example
import { CanvasLayer, Scene, v } from 'sapling2d'
import { Button, ScrollContainer, ui } from '@sapling2d/ui'

export const plugins = [ui()]

const ROW = 120 // 行高：按钮 100 + 间距 20

export class LevelSelect extends Scene {
  started: number | null = null
  // 选关列表：600×800 的可见区，条目加到 content 下；contentSize 要自己给（等高的行一行代码就能算出来）
  readonly list = new ScrollContainer({ name: 'Levels', size: v(600, 800), anchor: { centerX: 0, centerY: 0 } })

  override ready() {
    this.add(new CanvasLayer()).add(this.list)
    for (let i = 0; i < 30; i++) {
      const b = this.list.content.add(new Button({ text: `第 ${i + 1} 关`, size: v(600, 100), position: v(0, i * ROW) }))
      b.clicked.connect(() => (this.started = i)) // 轻点是点击，拖动是滚动：按钮不用自己区分
    }
    this.list.contentSize = v(600, 30 * ROW - 20)
    this.list.scrollTo(v(0, 12 * ROW), { animate: true }) // 打开时定位到当前关卡
  }
}
// #endregion

import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'

it('ui-scroll', async () => {
  const g = await createTestGame({ main: LevelSelect, plugins })
  // #region test
  const list = g.scene.list
  g.stepSeconds(0.5)
  expect(list.scrollY).toBe(12 * ROW) // 动画滚到第 13 关
  expect(list.position).toEqual(v(75, 267)) // 750×1334 的屏幕上居中
  // 往上拖：超过 12 像素（dragThreshold）之后接管，按着的按钮收到 released、不会 clicked
  g.drag(v(375, 900), v(375, 500))
  g.stepSeconds(3) // 惯性滚完
  expect(g.scene.started).toBe(null)
  expect(list.scrollY).toBeGreaterThan(12 * ROW + 300)
  expect(list.scrollY).toBeLessThanOrEqual(list.maxScroll.y) // 夹在 0..contentSize - size
  // 轻点可见区里的按钮：正常点击
  const first = Math.ceil(list.scrollY / ROW) // 可见区里第一个完整的按钮
  g.tap(375, 267 + first * ROW - list.scrollY + 50)
  expect(g.scene.started).toBe(first)
  expect(g.dump()).toContain('Levels (ScrollContainer) position=(75, 267) clipRect=(0, 0, 600, 800) size=(600, 800) anchor=centerX:0,centerY:0 contentSize=(600, 3580) scrollOffset=')
  // #endregion
})
