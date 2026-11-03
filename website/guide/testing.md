# 无头测试

`sapling2d/testing` 的 `createTestGame` 在 Node 里运行场景树和物理，不创建渲染器。游戏按帧推进，同一个 `seed`、同样的输入，结果完全相同。

```ts
import { expect, it } from 'vitest'
import { createTestGame } from 'sapling2d/testing'
import { gameOptions } from '../src/game'

it('点一下生成一个球', async () => {
  const g = await createTestGame({ ...gameOptions, seed: 1 })
  g.tap(300, 400) // 设计坐标；推进 2 帧
  g.stepSeconds(3) // 或 g.step(帧数)，每秒 60 帧
  expect(g.tree.getNodesInGroup('balls')).toHaveLength(1)
  expect(g.audio.log.map((s) => s.path)).toEqual(['pop.mp3']) // 声音被记录，不会播放
})
```

## 常用成员

| 成员 | 说明 |
|---|---|
| `g.scene` / `g.tree` / `g.game` | 当前场景、场景树、游戏对象 |
| `g.step(n)` / `g.stepSeconds(s)` | 推进 n 帧（每帧 1/60 秒，恰好一个物理步） |
| `g.dump()` | 场景树的文本，见下 |
| `g.tap(x, y)` / `g.drag(from, to, { frames })` / `g.pressKey(code)` | 模拟输入，走和真实平台相同的路径 |
| `g.pointerDown/Move/Up(x, y, id?)` / `g.keyDown/keyUp(code)` | 只注入事件，下一次 `step` 处理 |
| `g.inject(event)` | 注入任意输入事件，插件的事件也走这里 |
| `g.setScreen(info)` / `g.setFocus(bool)` | 模拟换屏幕、切后台 |
| `g.audio.log` / `g.audio.playing` | 播放记录 |

`createTestGame` 的参数和 `startGame` 一样（`main`、`autoloads`、`actions`、`plugins`……），另有 `storage` 预置存档：`createTestGame({ main, storage: { best: 100 } })`。

## 看场景树：`dump()`

```
Main (Main) position=(0, 0)
  Mover (Mover) position=(220, 200)
```

每行是 `名字 (类名) 属性=值`，缩进表示层级，只列出不等于默认值的属性。测试失败时先打印它，比猜原因快。

自己的节点可以覆写 `dumpProps()`，把游戏状态也打出来：

```ts
class Player extends Node2D {
  level = 1
  protected override dumpProps() {
    return { ...super.dumpProps(), level: this.level }
  }
}
```

在浏览器里运行时，控制台的 `sapling.tree.dump()`（模板里已经挂好）能看到实时的场景树。

## 注意

- **Vitest 不做类型检查**。改完运行 `tsc` 和 `vitest run`（模板里是 `pnpm check`），两个都过才算完成。
- 无头模式下贴图宽高为 0：需要点击的节点显式设 `hitArea`。
- `changeScene` 在微任务里完成：`await` 它的返回值，或 `await new Promise((r) => setTimeout(r, 0))` 之后再断言。
- 随机数用 `this.tree.rng`（带 seed），不要用 `Math.random`，否则测试不可复现。
- 直接调用场景的方法布置状态（例如 `scene.spawn(v(x, y))`），比模拟一长串输入更简单。
