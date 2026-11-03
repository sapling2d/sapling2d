# 相机

`Camera2D` 让画面跟随一个节点。通常挂在玩家下面：相机的全局位置就是画面中心。

<<< ../../packages/engine/docs/examples/camera.test.ts#example

## 当前相机

场景里第一个启用（`enabled`，默认 true）的相机自动成为当前相机；`makeCurrent()` 切换，`isCurrent` 查询。当前相机被移除或关掉时换下一个，都没有时画面不偏移。

## 常用属性

| 属性 | 作用 |
|---|---|
| `offset` | 画面中心相对相机的偏移 |
| `limitLeft` / `limitTop` / `limitRight` / `limitBottom` | 画面不超出的世界范围 |
| `positionSmoothingEnabled` / `positionSmoothingSpeed` | 平滑跟随（默认关闭，速度默认 5）；瞬移后调用 `resetSmoothing()` |
| `screenCenter` | 应用边界和平滑之后的画面中心 |

画面只平移，不支持缩放和旋转。相机在所有节点的 `process` 之后更新。

## 坐标

- 节点的全局坐标和指针坐标（`position`、`pointerPosition`）都是**世界坐标**。没有相机时，世界坐标就是设计坐标。
- `tree.viewport.designToWorld` / `worldToDesign` 在世界坐标和屏幕上的位置之间换算；`visibleWorldRect` 是屏幕上可见的世界范围。

## 固定在屏幕上的界面

有相机时，分数、按钮这类界面要放进 `CanvasLayer`，否则会跟着画面一起移走。

## 屏幕震动

没有专门的接口：用 Tween 把 `offset` 随机抖几下，再回到 0。

```ts
private _shake: Tween | null = null

shake(camera: Camera2D, strength: number, duration: number) {
  this._shake?.kill() // 上一次没抖完，先停掉
  const rng = this.tree.fxRng // 震动只影响画面：不占游戏逻辑的随机数
  const t = camera.createTween()
  for (let i = 0; i < 4; i++) {
    const s = strength * (1 - i / 4) // 越抖越小
    t.to(camera, { offset: v(rng.randfRange(-s, s), rng.randfRange(-s, s)) }, duration / 5)
  }
  this._shake = t.to(camera, { offset: Vector2.ZERO }, duration / 5)
}
```
