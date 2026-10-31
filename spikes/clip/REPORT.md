# Spike 报告：嵌套 stencil 裁剪（`clipRect` 的渲染路径）在 iOS 微信 WebGL1 上的正确性与开销

日期：2026-10-31。对应工单 `.scratch/ui/issues/01-device-spike-nested-stencil.md`，规格 `.scratch/ui/spec.md`。

## 问题

规格要给 `Node2D` 加 `clipRect`，渲染层打算直接用 Pixi v8 的 `Container.mask`（stencil 路径；Pixi v8 导出了 `ScissorMask` 但不会自动为轴对齐矩形选用它）。`keep` 模式的全屏 mask 已经在用这条路，但嵌套、旋转、十来个同时存在的 mask 没在真机验证过。要回答：

1. iOS 微信（WebGL1）上嵌套 stencil 裁得对不对？旋转的裁剪区对不对？和 `keep` 模式的根 mask 叠加是否正常？
2. 10 个带裁剪的容器各含 20 个精灵时，logic / render 多多少？
3. 要不要在规格之外加 scissor 路径？

## 方法

`spikes/clip/` 是一个一次性小游戏（不在 workspace 里，直接引用引擎源码），三个阶段自动切换，每 5 秒一行 `[perf]`，每阶段中点 `snapshot()`：

- **correct**（6 s）：三层嵌套裁剪——外层 500×500 不旋转、中层 300×300 旋转 15°、内层 160×160 旋转 -30°，每层底色比裁剪区各边大 40 像素（裁剪失效会露出一圈），精灵跨在每条边上；一个跨设计区右边缘的精灵；一块伸出设计区的紫色背景（`aspect: 'keep'`，黑边里不该看到它）；底部一个不裁剪的对照组。
- **masked**（10 s）：10 个容器（300×220，一半旋转 10°）各 20 个来回弹、越界 40 像素的精灵，全部裁剪。
- **plain**（10 s）：同样的 10 × 20，不裁剪。

引擎还没有 `clipRect`，spike 用 `unsafePixi` 挂 mask（`src/clip.ts`）。mask 的 Graphics 不能放进节点自己的容器——渲染层每帧按子节点顺序对账会把陌生子对象移掉——所以放在 Pixi 根容器上（和 `keep` 的全屏 mask 同级），每帧末把它的变换设成节点的屏幕变换。这只是 spike 的权宜，正式实现把 mask 放进节点容器。

跑法：

```sh
# 浏览器
pnpm --filter example-sprite exec vite --config ../../spikes/clip/vite.config.ts   # http://localhost:5199/?hold=correct|masked|plain
# 小游戏（发布构建）+ 日志服务 + 真机预览
node spikes/clip/log-server.ts &
WX_APPID=<测试号> SAPLING_LOG_URL=http://<局域网 IP>:7777/log pnpm --filter example-sprite exec vite build -c ../../spikes/clip/vite.wechat.config.ts
/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview --project $PWD/spikes/clip/dist-wechat --qr-format image --qr-output spikes/clip/preview-qr.png
```

## 结果

### 正确性（真机截图 `logs/correct-*.png`，浏览器一致）

iPhone 17（iOS 26.6.1，基础库 3.17.6，402×874 @3x）：

- 外层：四条边都是直的，正好落在裁剪矩形上，比裁剪区大 40 像素的底色完全看不见；跨边的 5 个精灵被切成半个。
- 中层（15°）和内层（-30°）：裁剪边随容器旋转，是斜的直线；跨边精灵沿斜边切开。三层一起正确——连同 `keep` 的根 mask 是 4 层 stencil。
- `keep`：上下黑边里没有紫色背景；设计区右边缘的精灵被切成一半。
- 对照组（不裁剪）精灵正常伸出底色之外，说明不是整体被什么东西裁了。
- 阶段切换后 mask 被拆干净（plain 阶段 HUD 显示 `masks 0`，画面上精灵伸出容器）。
- 日志里没有 Pixi 警告、没有错误。

### 开销（`[perf]`，每 5 秒一段，单位 ms）

| 环境 | 阶段 | fps | logic avg / max | render avg / max |
|---|---|---|---|---|
| Chrome（Mac，1504×865 @2x，120 Hz） | masked | 120.7 | 0.11 / 4.4 | 0.46 / 3.3 |
| Chrome | plain | 120.0 | 0.12 / 0.4 | 0.54 / 2.7 |
| iPhone 17（微信，无 JIT） | correct | 58.3 | 0.35 / 0.87 | 1.04 / 22.0（首段含着色器编译） |
| iPhone 17 | masked ①② | 59.7 / 59.2 | 1.21 / 1.80，1.19 / 1.66 | 4.11 / 15.5，3.95 / 6.6 |
| iPhone 17 | plain ①② | 59.7 / 59.0 | 0.99 / 1.26，0.95 / 1.41 | 3.70 / 18.4，3.50 / 6.3 |
| 开发者工具模拟器 | — | 未拿到（见下） | | |

- 真机上 10 个 mask 对 200 个精灵的渲染代价约 **+0.45 ms**（3.5–3.7 → 3.95–4.1），每个裁剪容器约 0.045 ms；帧率保持 60。
- 真机 logic 多出的 0.22 ms 是 spike 自己的 `frameEnd`（每帧算 10 个节点的全局变换、设 Graphics 变换，有分配），正式实现 mask 在节点容器里、跟着容器变换走，没有这部分。
- 浏览器里两者都在噪声范围内（render 0.5 ms 上下）。
- 每段的 interval max（33–106 ms）是 `changeScene` 切换、截图上传和首帧，不是 mask 导致；稳定段的 interval max 约 20 ms。

### 模拟器

`cli open` 和 `cli auto-preview` 都成功返回，但日志服务一直没收到模拟器的 `boot`，两次尝试都如此（真机扫码一次就全部拿到）。没有继续追：真机才是依据（`spikes/wechat/REPORT.md`）。要补模拟器数据，在开发者工具里手动编译一次即可，`[perf]` 会自动进 `logs/wechat.jsonl`。

## 结论

1. **stencil 可用、够便宜：规格不变。** 02 直接用 Pixi 的 `Container.mask`（矩形 Graphics），不做 scissor 路径。嵌套 4 层、旋转、和 `keep` 的根 mask 叠加在 iOS WebGL1 上都正确。
2. 10 个裁剪容器的代价约 0.45 ms / 帧（真机），UI 场景里裁剪容器一般只有一两个（列表、进度条），可以忽略。如果以后出现几十个同时可见的裁剪容器（例如每个列表项都裁），再评估 scissor。
3. **给 02 的实现提示：** mask 的 Graphics 必须在显示树里；放进节点容器时，`_syncChildren` 的对账要把它算进"属于节点自己的显示对象"（和内容层、覆盖层同一类），否则每帧会被移掉。几何只在 `_version` 变时重建，置 null 时移除并销毁。
4. Pixi v8 对 `Container` 类型的 mask 一律走 stencil；WebGL 上下文默认带 stencil 缓冲（Pixi 在没有时会警告，日志里没有出现）。

## 没有覆盖

- Android 真机；`pixelArt: true`；alpha / 贴图遮罩（规格里就不在范围内）。
- 模拟器数据（见上）。
- 几十个裁剪容器同屏的极端情况。
