// #region example
import { atlas, Scene, Sprite2D, v } from 'sapling2d'
// TexturePacker 开了 Multipack 和 Allow rotation：一页放不下时分成 items-0 / items-1 两页，每页一张图、一个 JSON；图片放在 public/assets/
import page0 from './items-0.json'
import page1 from './items-1.json'

export class Inventory extends Scene {
  // 图片按页的顺序列出（和 JSON 里的 meta.image 对不上时报错）；帧按名字取，不用管在哪一页
  static override assets = { items: atlas(['items-0.png', 'items-1.png'], [page0, page1]) }

  override ready() {
    const items = Inventory.assets.items
    items.names.forEach((name, i) => {
      const position = v(150 + (i % 4) * 150, 400 + Math.floor(i / 4) * 150)
      this.add(new Sprite2D({ name: name.replace('.png', ''), texture: items.get(name), position, scale: v(3, 3) }))
    })
  }
}
// #endregion

// #region test
import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'

it('multipack atlas with rotated frames', async () => {
  const g = await createTestGame({ main: Inventory })
  const items = Inventory.assets.items
  expect(items.pages.map((p) => p.path)).toEqual(['items-0.png', 'items-1.png'])
  expect(items.isLoaded).toBe(true) // 两页都在 ready 之前加载完
  // 帧带着自己那一页：路径是 页#名字
  expect([items.get('coin.png').path, items.get('key.png').path]).toEqual(['items-0.png#coin.png', 'items-1.png#key.png'])
  // 旋转打包的帧（TexturePacker 把放不下的剑顺时针转了 90° 塞进图里）：游戏里的尺寸和方向仍是原图的，渲染时转回来
  const sword = items.get('sword.png')
  expect([sword.width, sword.height]).toEqual([14, 48])
  expect(g.scene.children).toHaveLength(items.names.length)
})
// #endregion
