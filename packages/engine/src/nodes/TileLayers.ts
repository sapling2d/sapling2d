import type { TileMapLayer } from './TileMapLayer'

/**
 * 树里的 TileMapLayer（树级子系统，`tree.system(TileLayers)`）：图层进入树时登记、离开时注销，按进入树的顺序。
 * `CharacterBody2D` 按这里的图层做格子碰撞（ADR 0009）；自己写格子碰撞的节点也从这里取图层。
 */
export class TileLayers {
  /** 树里的图层，按进入树的顺序。只读：登记和注销由 TileMapLayer 自己做。 */
  readonly layers: TileMapLayer[] = []

  /** @internal */
  add(layer: TileMapLayer): void {
    this.layers.push(layer)
  }

  /** @internal */
  remove(layer: TileMapLayer): void {
    const i = this.layers.indexOf(layer)
    if (i >= 0) this.layers.splice(i, 1)
  }
}
