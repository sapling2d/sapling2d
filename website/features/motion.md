# 倾斜（运动传感器）

用手机的加速度计控制游戏：左右倾斜转向、前后倾斜加减速。倾斜在 `sapling2d/motion` 插件里，和键盘共用动作，游戏代码只查动作。

<<< ../../packages/engine/docs/examples/motion.test.ts#example

测试里用 `g.inject` 注入传感器数据：

<<< ../../packages/engine/docs/examples/motion.test.ts#test

## 绑定：`tilt()`

`plugins: [motion()]` 安装插件后，`tilt(dir, { deadzone?, full? })` 把倾斜角换成 0–1 的力度：默认 5° 以内是 0，30° 是 1。

| `dir` | 含义 |
|---|---|
| `left` / `right` | 左边 / 右边压低 |
| `forward` / `back` | 上边 / 下边压低 |

方向以竖屏持机为准。`forward` / `back` 的基线是手机平放，而人手持时本来就有几十度的倾斜，所以多数游戏只用左右。

## 原始值：`MotionInput`

`this.tree.get(MotionInput)` 提供：

| 成员 | 说明 |
|---|---|
| `x` / `y` / `z` | 含重力的加速度，单位 g，设备坐标：向右 +x、向上 +y、朝外 +z；已平滑（`motion({ smoothing })`，默认 0.2） |
| `roll` / `pitch` | 角度（度） |
| `available` | 有没有传感器 |
| `permission` | `granted` / `denied` / `prompt` / `unsupported` |

## 各平台

- **iOS 浏览器**要在用户手势里申请权限，插件会在第一次触摸时自动申请。`permission === 'prompt'` 期间，显示"点击屏幕开启重力感应"之类的提示，不要在 `ready()` 里就假定有倾斜输入。
- **微信小游戏**用 `wx.startAccelerometer`，不用申请权限；切到后台时插件停掉传感器。轴向和单位以真机为准，模拟器不可信。
- **桌面浏览器**没有传感器：`available` 为 false，倾斜绑定一直是 0，键盘照常可用。
