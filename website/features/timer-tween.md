# 计时器与补间

`Timer` 节点按固定间隔触发 `timeout` 信号；补间（Tween）让属性在一段时间内平滑地变到目标值。

<<< ../../packages/engine/docs/examples/timer-tween.test.ts#example

## 计时器

- `Timer` 是节点：`waitTime`、`oneShot`、`autostart`、`start()`、`stop()`、`timeLeft`，信号 `timeout`。不设 `oneShot` 时循环触发，不会累积漂移。
- 只等一次，不需要节点：`await this.tree.createTimer(0.5).timeout`。

## 补间

- `node.createTween()` 创建的补间绑定在节点上，节点销毁时自动停止。
- 链式方法：`to(目标, 属性, 秒, 缓动)`、`parallel`、`wait(秒)`、`call(fn)`。同一个 `to()` 里的多个属性同时变化。
- `kill()` 立即停止（不触发 `finished`），`isRunning` 表示是否还在播放。
- 驱动玩法的补间用 `createTween({ processInPhysics: true })`，按物理步推进，倍速下结果和 1 倍速一致（见 [暂停与时间缩放](./pause-time)）。

## 反复触发的动效

两个补间同时改同一个属性时都会运行，每帧后创建的那个最后写入，覆盖前一个。反复触发的动效（比如每次连击都弹一下）要先停掉上一个：

```ts
private _pop: Tween | null = null

pop() {
  this._pop?.kill()
  this.scale = v(1.6, 1.6)
  this._pop = this.createTween().to(this, { scale: v(1, 1) }, 0.25, Ease.BackOut)
}
```

在类方法里，`to(this, {...})` 按 `Node2D` 的属性做类型检查；要补间子类特有的属性，写 `to(this as MyNode, ...)`。
