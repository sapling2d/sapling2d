# 03 — `sapling2d/motion`：运动传感器插件、`tilt()` 绑定和 `examples/racer`

**What to build:** 第一个外部插件，验证机制在真实的平台差异（权限、省电、单位、轴向）下够不够用。规格见 `../spec.md`"运动传感器插件"一节。

- 新入口 `sapling2d/motion`（`package.json` 的 `exports` 和 `publishConfig.exports`、tsdown 入口都要加）：`motion(options?)`、`MotionInput`、`tilt()`、`RawMotionEvent`；`declare module 'sapling2d'` 合并 `InputEventRegistry.motion` 和 `InputBindingRegistry.tilt`。
- 来源：`eventTypes: ['motion']`、`bindingTypes: ['tilt']`；`handle` 做指数平滑（`smoothing` 默认 0.2）更新 `x/y/z`；`strength` 从重力分量算倾斜角（`asin(clamp(x, -1, 1))` 等），按 `deadzone`（默认 5°）/ `full`（默认 30°）归一化到 0–1。没有 `beginFrame`。
- 浏览器生产者（`kind === 'browser'`）：`devicemotion` → `accelerationIncludingGravity` ÷ 9.81 → `enqueue`。`typeof DeviceMotionEvent.requestPermission === 'function'`（iOS 13+）时：在 `window` 上挂一次性的捕获阶段 `pointerdown` / `touchend` 监听，同步调用 `requestPermission()`，结果写进 `permission`；`granted` 才注册 `devicemotion`；`denied` 不再尝试。没有 `DeviceMotionEvent` → `available = false`、`permission = 'unsupported'`。
- 小游戏生产者（`kind === 'wechat'`）：`wx.startAccelerometer({ interval: 'game' })` + `wx.onAccelerometerChange`（g 单位）；`tree.focusChanged`：false → `wx.stopAccelerometer()`，true → 重新 start；卸载时 stop + off。
- headless：无生产者，`available = true`，`permission = 'granted'`。
- 不管哪个平台，`install` 都不抛错；浏览器不支持时 `console.info` 一次。
- `examples/racer`：竖屏公路，车只能左右移动。`actions: { steerLeft: [key('KeyA'), tilt('left')], steerRight: [key('KeyD'), tilt('right')] }`，`Car.physicsProcess` 只读 `getAxis`。浏览器和小游戏两个入口，`plugins: [motion()]`。`permission === 'prompt'` 时 HUD 显示"点击屏幕开启重力感应"。HUD 另显示传感器原始值，真机核对轴向时直接看屏幕。
- `docs/examples/motion.test.ts`：`llms.txt` 的示例。

**Blocked by:** 01

**Status:** done（2026-10-20；模拟器那一条留到 05 和真机一起看）

- [x] `createTestGame({ plugins: [motion()] })` 后 `tree.get(MotionInput)` 可用；不装时 `tree.get` 报错提示 `plugins: [...]`；`addAction` 带 `tilt()` 而没装插件时有警告
- [x] `g.inject({ type: 'motion', x: sin(20°), … })` → `step()` 后 `getActionStrength('steerLeft')` 为 (20 − 5) / (30 − 5) = 0.6；5° 以内为 0；30° 以上为 1；`tilt('right')` 对负方向为 0
- [x] 平滑：`smoothing: 0` 时一个事件立即到位；默认值下第一个采样直接到位、之后每个采样走 1 − smoothing（测试用 0.5 验证 1 → 0.5 → 0.25）
- [x] 和键盘取最大：按着 `KeyA` 时倾斜 10° 力度仍是 1
- [x] 来源没有每帧代码：没有事件的帧 `handle` 不被调用（spy 验证），`strength` 只做算术，不分配
- [x] 浏览器（桌面 Chrome，没有传感器）：`install` 不抛错，`available === false`，游戏照常用键盘——用假 `window` 的单元测试覆盖（`test/motion-producers.test.ts`：无 `DeviceMotionEvent` 返回 null；不需要权限时 start / stop；iOS 的 prompt → 同意 / 拒绝 / 不在手势里被拒后重试）
- [ ] 小游戏模拟器：`install` 不抛错；模拟器的传感器面板能驱动车 → 05 和真机一起看（小游戏生产者用假 `wx` 做了单元测试：start / stop 不重复、off 时注销）
- [x] `examples/racer` 的测试通过（3 个），`pnpm --filter example-racer build` 和 `build:wechat` 都能产出（dev 构建 6.39 MB 带内联 sourcemap，只能进模拟器；真机要 `SAPLING_RELEASE=1`）
- [x] `pnpm check` 绿（engine 499）；`llms.txt` 重新生成；`pnpm pack` 装到仓库外的项目里 `import { motion, tilt, MotionInput } from 'sapling2d/motion'` 类型和运行都正常（`tsc` 过，`createTestGame` + `inject` 跑出力度 1、`permission: granted`）

**实现提示**

- 事件单位统一成 g（重力 = 1），两端的轴向都按 W3C 设备坐标（屏幕向右 +x、向上 +y、朝外 +z）；小游戏的轴向以真机为准（05 核对），有出入就在小游戏生产者里换算，不要改事件定义。
- `requestPermission` 必须在手势回调里**同步**调用（不能 await 之后再调）；`BrowserAudio.ts` 的 `UNLOCK_EVENTS` 是同样的模式，可以照抄监听方式但不要共用代码——插件不依赖平台实现文件。
- 插件文件里同时出现 `window` 和 `wx` 是允许的（ADR 0010）；但不要 `/// <reference path="wx.d.ts" />`，那会把 `wx` 全局声明带进核心的类型检查程序，插件自己声明用到的成员。
- 竖屏假设写进 `tilt()` 的 JSDoc；横屏换算不做。

## Comments

**实现（2026-10-20）：** `src/plugins/motion/{index,producer,browser,wechat}.ts`，`dist/motion.js` 8 kB、没有 import（运行时不依赖核心）。

- **声明合并走通了**：插件文件写 `declare module 'sapling2d'`，仓库内靠包的自引用解析到 `src/index.ts`，tsdown 把它原样放进 `dist/motion.d.ts`，仓库外安装后 `tilt()` 绑定和 `{ type: 'motion' }` 注入都有类型。这是外部插件的标准写法；01 里"内置插件直接登记在表里"的保守做法可以不必再用。
- **轴向符号**：传感器量的是"向上"的反作用力，左边压低时 `x > 0`，所以 `tilt('left')` 看 `+x`、`roll` 左边压低为正；和 `deviceorientation.gamma` 的符号相反。写进了 `RawMotionEvent` 的文档，05 真机核对。
- **平滑**：第一个采样直接到位（游戏一开始手机已经倾斜着，不从 0 爬），之后指数平滑。测试里要么用 `smoothing: 0`，要么注入后多 step 几次。
- iOS 权限：`requestPermission()` 被拒绝（promise reject，不在手势里）时保持 `prompt`，下一次手势再试；解析为 `denied` 才放弃并移除手势监听。浏览器生产者的 `start` / `stop` 只在已授权时真正挂 / 摘 `devicemotion` 监听。
- `env.d.ts` 给核心的 `console` 声明加了 `info`（ADR 规定插件用它提示 mock）。
- `examples/racer`：全部 `ColorRect`，没有贴图。HUD 底部读数 `granted  x 0.00  y 0.00  z 1.00  roll 0°  car 375` 每 0.1 秒刷新，是给 05 真机核对用的。
- `pnpm install` 更新了 `pnpm-lock.yaml`（新 workspace 包 `example-racer`）。
