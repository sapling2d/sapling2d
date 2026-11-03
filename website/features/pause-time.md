# 暂停与时间缩放

`tree.paused` 暂停游戏；`tree.timeScale` 让游戏时间变快、变慢或停住，用来做打击停顿和慢动作。两者互相独立。

## 暂停

<<< ../../packages/engine/docs/examples/pause.test.ts#example

- 每个节点有 `processMode`：`inherit`（默认，跟随父节点；一路继承到根时就是 `pausable`）、`pausable`、`always`。
- `tree.paused = true` 时，`pausable` 节点的 `process` / `physicsProcess`、绑定在它们上的 Tween / Timer、指针事件都停止，物理世界也停止。
- 暂停菜单里的节点（包括按钮）设 `processMode: 'always'`，否则暂停时点不到。
- `createTimer` 默认在暂停时继续计时；传 `processAlways: false` 改成跟着暂停。
- 暂停**不会**停止声音。
- 切到后台时，默认（启动参数 `pauseOnBackground: true`）挂起整个主循环；`tree.focusChanged` 信号通知前后台切换。

## 时间缩放

<<< ../../packages/engine/docs/examples/time-scale.test.ts#example

- `tree.timeScale` 默认 1，必须 ≥ 0。所有游戏时间都乘上它：`process` 的 dt、物理步数、Tween、Timer、`createTimer`、帧动画、相机平滑和 `tree.time`。
- 为 0 时游戏时间完全停止，输入和渲染照常；停顿中按下的键，在恢复后的第一个物理步里仍然算 just pressed。
- 停顿时普通计时器也停了，所以恢复用 `createTimer(秒, { ignoreTimeScale: true })`，按真实时间计时。
- 界面（CanvasLayer）也一起变慢；停顿很短时看不出来。

## 倍速下结果一致

大于 1 时，物理步长仍是 1/60 秒，只是每帧的步数变多：3 倍速时 60Hz 屏幕上每帧 3 步，步序和 1 倍速跑 3 帧完全一样。代价是逻辑耗时也乘上倍速。

按帧的计时和补间一帧只更新一次，倍速下一帧会吞掉几步。所以：

- **要求倍速下结果一致的玩法逻辑放在 `physicsProcess` 里。**
- 驱动玩法的计时和动画按物理步推进：`createTimer(秒, { processInPhysics: true })`、`new Timer({ processInPhysics: true })`、`createTween({ processInPhysics: true })`、`new AnimatedSprite2D({ processInPhysics: true })`。它们每步推进 1/60 秒游戏时间，在 `physicsProcess` 和物理世界之后执行。
- 纯视觉的效果（受击闪白、UI 弹一下）照旧按帧。
- `ignoreTimeScale` 不能和 `processInPhysics` 同时用。
