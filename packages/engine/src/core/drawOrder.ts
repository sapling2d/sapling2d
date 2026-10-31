import type { CanvasLayerLike, Node } from './Node'
import { Node2D } from './Node2D'

/*
 * 绘制顺序的规则，渲染层（`PixiRenderer`）和指针拾取（`PointerRouter`）共用，`test/draw-order.test.ts` 交叉验证两边一致：
 * 1. 场景容器里：layer < 0 的 CanvasLayer、世界（场景和 Autoload）、layer >= 0 的 CanvasLayer；同一 layer 按树的先序（`sortLayers`、`worldSlot`）。
 * 2. 每一层里是树的先序；不是 Node2D 的节点不占位，它的子节点展开到最近的 Node2D 祖先的容器里；遇到 CanvasLayer 不展开（它自成一层）。
 * 3. 同一容器里按 zIndex 稳定排序（zIndex 大的后画、在上层），节点自己的内容排在 zIndex 0 的位置，所以 zIndex 为负的子节点画在父节点下面。
 * 渲染层把第 3 条交给 Pixi 的 `sortableChildren`，第 2 条在 `_visit` 里逐帧做（不分配）；这里的 `collectDrawOrder` 是拾取用的一次性版本。
 */

/** 第 1 条：CanvasLayer 按 layer 稳定排序（同一 layer 按遇到的先后，即树的先序）。原地插入排序，不分配：层通常只有几个。 */
export function sortLayers(layers: CanvasLayerLike[]): void {
  for (let i = 1; i < layers.length; i++) {
    const cur = layers[i]!
    let j = i - 1
    while (j >= 0 && layers[j]!.layer > cur.layer) {
      layers[j + 1] = layers[j]!
      j--
    }
    layers[j + 1] = cur
  }
}

/** 第 1 条：排好序的层里第一个 layer >= 0 的下标，世界画在它前面；全是负数时等于 `layers.length`。 */
export function worldSlot(layers: readonly CanvasLayerLike[]): number {
  let i = 0
  while (i < layers.length && layers[i]!.layer < 0) i++
  return i
}

/**
 * 整棵树的绘制顺序（先画的在前），指针拾取从后往前找命中的节点。
 * `inLayer`（可选）和 `out` 一一对应：节点是否在某个 CanvasLayer 里。每次调用都分配：只在指针按下时用。
 */
export function collectDrawOrder(nodes: readonly Node[], out: Node2D[], inLayer?: boolean[]): void {
  const layers: CanvasLayerLike[] = []
  collectLayers(nodes, layers)
  sortLayers(layers)
  const slot = worldSlot(layers)
  const emit = (list: readonly Node[], flag: boolean) => {
    const start = out.length
    collectCanvas(list, out)
    if (inLayer) for (let i = start; i < out.length; i++) inLayer[i] = flag
  }
  for (let i = 0; i < slot; i++) emit(layers[i]!.children, true)
  emit(nodes, false)
  for (let i = slot; i < layers.length; i++) emit(layers[i]!.children, true)
}

/** 树的先序里遇到的所有 CanvasLayer（包括嵌套的）。 */
function collectLayers(nodes: readonly Node[], out: CanvasLayerLike[]): void {
  for (const n of nodes) {
    if (n._isCanvasLayer) out.push(n as CanvasLayerLike)
    collectLayers(n.children, out)
  }
}

/**
 * 第 2、3 条：一个容器里的 Node2D，按绘制顺序；遇到 CanvasLayer 不展开。
 * `self` 是容器所属的节点（画布的根容器为 null）：它自己的内容排在 zIndex 0、同 zIndex 子节点之前的位置。
 */
function collectCanvas(nodes: readonly Node[], out: Node2D[], self: Node2D | null = null): void {
  const slots: Node2D[] = []
  const flatten = (list: readonly Node[]) => {
    for (const n of list) {
      if (n._isCanvasLayer) continue
      if (n instanceof Node2D) slots.push(n)
      else flatten(n.children)
    }
  }
  flatten(nodes)
  const items = slots.map((n, i) => ({ n, i, z: n.zIndex }))
  if (self) items.push({ n: self, i: -1, z: 0 })
  items.sort((a, b) => a.z - b.z || a.i - b.i)
  for (const { n, i } of items) {
    if (i === -1) out.push(n)
    else collectCanvas(n.children, out, n)
  }
}
