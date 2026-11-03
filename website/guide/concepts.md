# 核心概念

sapling2d 的 API 采用 Godot 的风格。用过 Godot 的话，大部分概念可以直接对应；没用过也没关系，概念不多。

## 节点树

游戏里的一切都是**节点**。游戏对象继承节点类（`Node`、`Node2D`、`Sprite2D`、`RigidBody2D`……），用 `this.add(child)` 组成一棵树。`add` 返回带类型的子节点，所以通常直接存到字段里：

```ts
class Level extends Scene {
  player!: Player

  override ready() {
    this.player = this.add(new Player({ position: v(100, 900) }))
  }
}
```

用继承扩展，不用组件挂载（不是 ECS）。

**不支持按路径查找**：没有 `getNode('A/B')`。节点之间用三种方式互相引用：

| 方式 | 用在 |
|---|---|
| 类型化字段 | 父节点引用自己创建的子节点 |
| Groups | 跨层级找一类节点：`this.tree.getNodesInGroup('enemies')` |
| Autoload | 跨场景存在的单例：`this.tree.autoload(GameState)` |

## 构造参数

每个节点的构造函数接受一个选项对象，键就是它可写的属性：

```ts
new Label({ name: 'Score', text: '0', fontSize: 48, position: v(375, 100), zIndex: 10 })
```

通用的有 `name`、`groups`、`processMode`；`Node2D` 有 `position`、`rotation`、`scale`、`visible`、`zIndex`、`alpha`、`modulate` 等；再加上各节点自己的属性。

## 生命周期

| 方法 | 何时调用 |
|---|---|
| `enterTree()` | 进入场景树（父先于子） |
| `ready()` | 第一次进入树、子节点都就绪之后（子先于父，一生一次） |
| `process(dt)` | 每帧 |
| `physicsProcess(dt)` | 每个物理步（固定 60Hz） |
| `exitTree()` | 离开场景树（子先于父） |

覆写时不需要调用 `super`。节点不在树里时访问 `this.tree` 会抛错，所以不要在构造函数里用它，放到 `ready()` 里。

销毁节点用 `queueFree()`：它在当前物理步或当前帧的末尾执行，不会立即生效。

## 场景

`Scene` 是树的根，同一时间只有一个。`static assets` 声明的资源在 `ready()` 之前加载完成：

```ts
class Level extends Scene {
  static override assets = { hero: tex('hero.png'), pop: sfx('pop.mp3') }
}
```

场景参数通过构造函数声明，`changeScene` 的参数类型由它决定。下面的例子在结算时存档并切到结果场景：

<<< ../../packages/engine/docs/examples/scenes-storage.test.ts#example

切换场景时，旧场景独有的资源会被卸载。

## 场景树

节点里的 `this.tree` 是运行时的中心，提供：

- 输入、音频、存储、物理、视口：`input`、`audio`、`storage`、`physics`、`viewport`
- 随机数：`rng`（带 seed，影响玩法）和 `fxRng`（只影响画面）
- 时间：`time`、`paused`、`timeScale`
- 工具：`createTween()`、`createTimer()`、`getNodesInGroup()`、`autoload()`、`changeScene()`、`dump()`
- 插件提供的服务：`get(Token)`

## 单位与坐标

- 像素，y 轴向下，角度用弧度（另有 `rotationDegrees`），重力的单位是 px/s²。
- 游戏坐标是**设计分辨率**，默认 750×1334。`expand` 模式下，屏幕多出来的部分向两侧对称扩展；贴边的 UI 用 `this.tree.viewport.visibleRect` / `safeRect`。
- `Vector2` 不可变：写 `node.x += 1`，不要写 `node.position.x += 1`（编译不过）。

## 每帧的执行顺序

1. 处理输入队列（指针信号在这里触发）
2. 若干次物理步。每一步：所有节点的 `physicsProcess` → 推进物理世界、派发接触信号 → 按物理步的 Tween / Timer → 这一步排队的 `callDeferred` / `queueFree`
3. `process`
4. Tween / Timer
5. `callDeferred`
6. `queueFree`

每帧最多推进 2 个物理步的时间，更长的卡顿会被丢掉，游戏不会为了追时间而一次跑很多步。
