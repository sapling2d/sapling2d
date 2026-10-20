# 03 — `sapling2d/motion`：运动传感器插件、`tilt()` 绑定和 `examples/racer`

**What to build:** 第一个外部插件，验证机制在真实的平台差异（权限、省电、单位、轴向）下够不够用。规格见 `../spec.md`"运动传感器插件"一节。

- 新入口 `sapling2d/motion`（`package.json` 的 `exports` 和 `publishConfig.exports`、tsdown 入口都要加）：`motion(options?)`、`MotionInput`、`tilt()`、`RawMotionEvent`；`declare module 'sapling2d'` 合并 `InputEventRegistry.motion` 和 `InputBindingRegistry.tilt`。
- 来源：`eventTypes: ['motion']`、`bindingTypes: ['tilt']`；`handle` 做指数平滑（`smoothing` 默认 0.2）更新 `x/y/z`；`strength` 从重力分量算倾斜角（`asin(clamp(x, -1, 1))` 等），按 `deadzone`（默认 5°）/ `full`（默认 30°）归一化到 0–1。没有 `beginFrame`。
- 浏览器生产者（`kind === 'browser'`）：`devicemotion` → `accelerationIncludingGravity` ÷ 9.81 → `enqueue`。`typeof DeviceMotionEvent.requestPermission === 'function'`（iOS 13+）时：在 `window` 上挂一次性的捕获阶段 `pointerdown` / `touchend` 监听，同步调用 `requestPermission()`，结果写进 `permission`；`granted` 才注册 `devicemotion`；`denied` 不再尝试。没有 `DeviceMotionEvent` → `available = false`、`permission = 'unsupported'`。
- 小游戏生产者（`kind === 'wechat'`）：`wx.startAccelerometer({ interval: 'game' })` + `wx.onAccelerometerChange`（g 单位）；`tree.focusChanged`：false → `wx.stopAccelerometer()`，true → 重新 start；卸载时 stop + off。`wx.d.ts` 补这四个 API。
- headless：无生产者，`available = true`，`permission = 'granted'`。
- 不管哪个平台，`install` 都不抛错；浏览器不支持时 `console.info` 一次。
- `examples/racer`：竖屏公路，车只能左右移动。`actions: { steerLeft: [key('KeyA'), tilt('left')], steerRight: [key('KeyD'), tilt('right')] }`，`Car.physicsProcess` 只读 `getAxis`。浏览器和小游戏两个入口（照 `examples/wechat-tree`），`plugins: [motion()]`。`tree.get(MotionInput).permission === 'prompt'` 时在 HUD 显示"点击屏幕开启重力感应"，`granted` 后隐藏。一个 `test/` 用 `g.inject` 驱动的测试：倾斜 20° 时车向左移动，回正后停下。
- `docs/examples/motion.test.ts`：`llms.txt` 的示例（`tilt` 和键盘共用动作、`g.inject`、`getAxis`）。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `createTestGame({ plugins: [motion()] })` 后 `tree.get(MotionInput)` 可用；不装时 `tree.get` 报错提示 `plugins: [motion()]`；`addAction` 带 `tilt()` 而没装插件时有警告
- [ ] `g.inject({ type: 'motion', x: sin(20°), y: …, z: … })` → `step()` 后 `getActionStrength('steerLeft')` 为 (20 − 5) / (30 − 5) = 0.6；5° 以内为 0；30° 以上为 1；`tilt('right')` 对负方向为 0
- [ ] 平滑：`smoothing: 0` 时一个事件立即到位；默认值下连续注入同一个值若干帧后收敛；测试里的期望值用注入前算好的数
- [ ] 和键盘取最大：按着 `KeyA` 时倾斜 10° 力度仍是 1
- [ ] 来源没有每帧代码：没有事件的帧 `handle` 不被调用，`strength` 只做算术，不分配
- [ ] 浏览器（桌面 Chrome，没有传感器）：`install` 不抛错，`available === false`，游戏照常用键盘
- [ ] 小游戏模拟器：`install` 不抛错；模拟器的传感器面板能驱动车（模拟器和真机的差异见 `spikes/wechat/REPORT.md`，真机验证在 05）
- [ ] `examples/racer` 的测试通过，`pnpm --filter example-racer dev` 能跑，`dev:wechat` 能产出 `dist-wechat/`
- [ ] `pnpm check` 绿；`llms.txt` 重新生成；`pnpm pack` 装到仓库外的项目里 `import { motion } from 'sapling2d/motion'` 类型和运行都正常（`publishConfig.exports` 容易漏）

**实现提示**

- 事件单位统一成 g（重力 = 1），两端的轴向都按 W3C 设备坐标（屏幕向右 +x、向上 +y、朝外 +z）；小游戏的轴向以真机为准（05 核对），有出入就在小游戏生产者里换算，不要改事件定义。
- `requestPermission` 必须在手势回调里**同步**调用（不能 await 之后再调）；`BrowserAudio.ts` 的 `UNLOCK_EVENTS` 是同样的模式，可以照抄监听方式但不要共用代码——插件不依赖平台实现文件。
- 插件文件里同时出现 `window` 和 `wx` 是允许的（ADR 0010）；`wx` 的类型用 `/// <reference path="../../platform/wechat/wx.d.ts" />`，不要 import 平台模块。
- 竖屏假设写进 `tilt()` 的 JSDoc；横屏换算不做。
