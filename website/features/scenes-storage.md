# 场景切换与存档

同一时间只有一个活动场景。`changeScene` 切换场景并传参数；`tree.storage` 是同步读写的本地存档。

<<< ../../packages/engine/docs/examples/scenes-storage.test.ts#example

测试里预置存档，等场景切换完成再断言：

<<< ../../packages/engine/docs/examples/scenes-storage.test.ts#test

## 切换场景

- 场景参数通过构造函数声明（`constructor(readonly params: {...})`），`changeScene(Result, {...})` 的参数类型由它决定。
- `changeScene` 先加载新场景的资源，再在微任务里替换，不打断当前帧；连续调用按顺序执行。旧场景独有的资源会被卸载。
- `reloadCurrentScene()` 用原来的参数重开当前场景；切换完成时触发 `tree.sceneChanged`。
- 加载期间 `tree.assets.progress` 从 0 走到 1，可以用来做切场景的加载提示。

## 存档

- `tree.storage.get(key, 默认值)` / `set(key, value)`：同步读写，值存成 JSON，key 自动加前缀（启动参数 `storagePrefix`）。
- 用声明合并给 key 登记类型：`declare module 'sapling2d' { interface StorageRegistry { best: number } }`。
- 浏览器和微信小游戏都能用；测试里是内存存储，用 `createTestGame({ storage: {...} })` 预置。
