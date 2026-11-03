# 信号

信号是强类型的事件。节点把信号声明成只读字段，其他节点用 `connect` 监听。

<<< ../../packages/engine/docs/examples/signals.test.ts#example

## 自动断开

`connect(fn, owner)` 的第二个参数是 **owner**：owner 被销毁时，这条连接自动断开。节点被销毁时，它自己声明的信号上的所有连接也会断开。所以一般不需要手动 `disconnect`。

监听函数用箭头函数，不会丢 `this`。

## 等待信号

信号可以 `await`：

```ts
const points = await enemy.died // 等下一次触发
```

`await signal` 会错过**同步紧接着**的 `emit`。要先注册、再同步触发时，用 `wait()`：

<<< ../../packages/engine/docs/examples/signals.test.ts#test

## 内置信号

很多节点自带信号，例如 `Node2D.clicked`、`RigidBody2D.bodyEntered`、`Timer.timeout`、`AnimatedSprite2D.animationFinished`、`tree.sceneChanged`。
