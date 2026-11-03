# 命中判定

子弹、道具这类数量多、只需要知道"碰没碰到"的对象，用 `HitTester` 判定，不走物理引擎：没有物理反应，也不占刚体预算。

<<< ../../packages/engine/docs/examples/hit-tester.test.ts#example

## 参与判定的对象

- 对象有 `x`、`y` 和 `hitShape` 就能参与；`hitShape` 是 `circle(r)` 或 `rectangle(w, h)`。形状在模块里建一次，所有对象共用。
- 形状以节点位置为中心，**不随 rotation / scale 变化**（矩形总是轴对齐）。
- `x` / `y` 是局部坐标，所以互相比较的对象要挂在同一个父节点下（或者父节点之间没有相对变换）。
- `dead` 为 true、已 `queueFree()` 或已销毁的对象自动跳过。只看对象自己：父节点 `queueFree()` 时，子节点要到帧末销毁后才跳过。

## API

- `forEachHit(as, bs, hit)`：对每一对相交的 `a`、`b` 调用 `hit(a, b)`；返回 true 表示 `a` 用掉了，不再和别的 `b` 比较。
- `as` 和 `bs` 可以传同一个数组，做组内判定；对象不和自己比较。
- `HitTester.compact(list)`：原地去掉已失效的对象。

## 什么时候用

- 弹幕、子弹、拾取物：用 `HitTester`。
- 需要反弹、堆叠、推挤等物理反应：用 [物理](./physics)。
- 在微信小游戏的 iOS 端，同时活跃的刚体建议控制在 60–80 个以内，大量对象更应该用 `HitTester`。
