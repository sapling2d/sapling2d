# 启动页

启动页在入口场景的资源加载期间显示，比如 logo 加进度条。它就是一个实现了 `LoadingScreen` 的普通 `Scene`，通过启动参数 `loading` 传入。

<<< ../../packages/engine/docs/examples/loading-screen.test.ts#example

## 启动流程

1. 加载启动页自己的 `static assets`
2. 启动页进入场景树，开始帧循环
3. 准备资源包：微信小游戏在这一步下载资源分包，占进度的前 70%
4. 加载入口场景的资源
5. 如果启动页有 `loaded()`，等它返回的 Promise 完成
6. 切到入口场景；启动页被销毁，它独有的资源被卸载

## 要点

- 启动页的资源要少：它们在任何画面出现之前加载。
- 在微信小游戏里，**启动页的资源必须放在 `public/assets/boot/`**（主包），否则启动时报错。见 [微信小游戏](/platforms/wechat#资源与分包)。
- 不传 `loading` 时用内置的 `DefaultLoadingScene`：屏幕中间一条进度条，不用资源；`loading: null` 不显示启动页。
- `tree.assets.progress` 在每次 `changeScene` 期间也会从 0 走到 1。

## 测试

<<< ../../packages/engine/docs/examples/loading-screen.test.ts#test
