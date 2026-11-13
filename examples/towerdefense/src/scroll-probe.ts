import { CanvasLayer, ColorRect, Label, Scene, v, type Game } from 'sapling2d'
import { Button, ScrollContainer } from '@sapling2d/ui'

const ROW = 120
const DECELERATIONS = [0.8, 0.87, 0.93]

/**
 * 真机手感检查（VITE_SCROLL=1）：30 行的滚动列表 + 切换 deceleration 的按钮。
 * 点击、每次滚动停下的位置打印到 log server（`[scroll]`）。
 */
class ScrollProbe extends Scene {
  override ready() {
    const hud = this.add(new CanvasLayer())
    hud.add(new ColorRect({ size: v(750, 1334), color: 0x15151c }))
    const info = hud.add(new Label({ text: '', fontSize: 28, color: 0xffffff, position: v(375, 60), align: 'center' }))
    const list = hud.add(new ScrollContainer({ name: 'List', size: v(600, 900), anchor: { centerX: 0, top: 220 } }))
    for (let i = 0; i < 30; i++) {
      const b = list.content.add(new Button({ text: `第 ${i + 1} 关`, size: v(600, 100), position: v(0, i * ROW) }))
      b.clicked.connect(() => {
        info.text = `点击：第 ${i + 1} 关`
        console.log(`[scroll] click ${i + 1} at scrollY ${list.scrollY.toFixed(0)}`)
      })
    }
    list.contentSize = v(600, 30 * ROW - 20)

    DECELERATIONS.forEach((d, i) => {
      const b = hud.add(new Button({ text: `${d}`, size: v(180, 70), fontSize: 28, anchor: { centerX: (i - 1) * 200, top: 120 } }))
      b.clicked.connect(() => {
        list.deceleration = d
        info.text = `deceleration = ${d}`
        console.log(`[scroll] deceleration ${d}`)
      })
    })
    info.text = `deceleration = ${list.deceleration}`

    let was = false
    list.scrolled.connect(() => (was = true))
    // 每次滚动停下时打印位置
    setInterval(() => {
      if (was && !list.isScrolling) {
        was = false
        console.log(`[scroll] stopped at ${list.scrollY.toFixed(0)} / ${list.maxScroll.y} (deceleration ${list.deceleration})`)
      }
    }, 100)
  }
}

export async function runScrollProbe(game: Game): Promise<void> {
  console.log('[scroll] probe start')
  await game.tree.changeScene(ScrollProbe)
}
