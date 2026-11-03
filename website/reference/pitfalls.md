# 常见陷阱

写 sapling2d 游戏时最常踩的坑，按主题分组。

## TypeScript 与测试

- **测试通过不等于类型检查通过**：Vitest 不做类型检查。改完代码运行 `pnpm check`（`tsc` + `vitest run`），两个都过才算完成。
- **严格的数组索引**：模板的 tsconfig 开启了 `noUncheckedIndexedAccess`，`arr[i]` 的类型是 `T | undefined`。确定存在时写 `arr[i]!`，不确定时先判断。
- **声明合并**：给组名、动作名、存档 key 加类型，拼错就编译不过：

  ```ts
  declare module 'sapling2d' {
    interface GroupRegistry { … }
    interface ActionRegistry { … }
    interface StorageRegistry { … }
  }
  ```

- **Tween 在类方法里**：`this.createTween().to(this, {...})` 按 `Node2D` 的属性做类型检查；补间子类特有的属性写 `to(this as MyNode, …)`。
- **带类型的 AnimatedSprite2D**：`AnimatedSprite2D<'fly' | 'hurt'>` 不能赋给 `AnimatedSprite2D`（即 `<string>`）类型的变量或数组。字段按具体类型声明，或在用到的地方写 `AnimatedSprite2D<any>`。

## 节点与场景树

- **Vector2 不可变**：`node.position.x += 1` 编译不过。写 `node.x += 1`，或 `node.position = node.position.add(v(1, 0))`。
- **不支持路径查找**：没有 `getNode('A/B')`。用字段（`this.player = this.add(...)`）、`getNodesInGroup` 或 `autoload`。
- **`this.tree` 只在树里可用**：不要在构造函数里用，放到 `ready()`。
- **`queueFree` 是延迟的**：在 `physicsProcess`（或接触信号回调）里调用的，这一步结束就销毁，同一帧后面的物理步和 `process` 不会再调到它；在 `process` 里调用的，在帧末销毁。在那之前节点仍在树里，用 `isQueuedForDeletion` 防止重复处理。`callDeferred` 同一时机执行，在销毁之前。
- **`await signal` 会错过同步紧接着的 emit**：要先注册再触发时，用 `signal.wait()`。
- **随机数**：用 `this.tree.rng`（带 seed，测试可复现），不要用 `Math.random`。只影响画面、不影响玩法的随机（粒子、屏幕震动、装饰性抖动）用 `this.tree.fxRng`：同样可复现，而且加减这些效果不会改变同一个 seed 的对局走向。`Particles2D` 自动用它。

## 物理

- **物理回调里的增删**：接触信号在物理步之后派发，回调里 `queueFree` / `add` 都安全。新刚体在下一个物理步才创建，之前设置的速度和冲量会排队。
- **改碰撞形状会重新触发接触信号**：移动、修改、禁用或增删 `CollisionShape2D` 会重建形状，正在接触的对象先收到一次 `bodyExited`、再收到一次 `bodyEntered`。需要稳定的进出判断时，在节点创建时定好形状。
- **刚体的位置由物理决定**：给 `RigidBody2D` 的 `position` 赋值等于瞬移并清零速度；`scale` 不影响碰撞形状。

## 界面

- **控件的锚点只在 CanvasLayer 里有意义**：`anchor` 是屏幕位置，放在场景里会跟着相机走，并警告一次。
- **暂停菜单**：里面的按钮要设 `processMode: 'always'`，否则 `tree.paused` 时点不到。
- **`clipRect` 不裁 CanvasLayer**：裁剪容器下面的 `CanvasLayer` 自成一层，照常全屏显示。被裁掉的区域点不到，但算空白，会触发 `pointerPress()` 动作。

## 插件与平台

- **忘了装插件**：出现 `binding type "tilt" has no input source` 警告，或 `tree.get(X)` 报 `X is not installed`，就是 `plugins: [...]` 里少了对应插件。
- **iOS 浏览器的传感器权限**要在用户手势里申请：`motion()` 自动在第一次触摸时申请。`permission === 'prompt'` 期间提示玩家点一下屏幕，不要在 `ready()` 里就认为有倾斜输入。
- **广告的奖励只认 `'rewarded'`**：`'skipped'` 和 `'unavailable'` 都不给。`showRewarded()` 期间游戏是暂停的，`await` 之后的代码在恢复后才跑。没配广告位 id 时是 mock，上线前检查日志里的 `[sapling2d] ads:`。
- **Spine 的版本和许可证**：`@sapling2d/spine` 只读 Spine **4.3** 导出的 JSON（运行时和编辑器的 major.minor 必须一致，加载报错就重新导出）。图集和骨架不同名时写 `spineSkeleton(path, { atlas })`。每个用它的开发者都要有自己的 Spine 编辑器许可。
- **音量是 0–1**（不是 dB）；`tree.paused` 不暂停声音。

## 微信小游戏发布构建

- **类名会被压缩**：节点不传 `name` 时默认用类名，但发布包里类名会变成 `cP` 之类。逻辑里不要依赖默认名字或 `constructor.name`：要按名字找就显式传 `name`，判断类型用 `instanceof`。
- **每帧都跑的类不要用 `#private`**：小游戏构建目标是 ES2017，`#x` 会被编译成 WeakMap 查找，iOS 上慢 2–3 倍。用 TypeScript 的 `private _x`。更多见 [微信小游戏 · iOS 上的性能](/platforms/wechat#ios-上的性能)。
