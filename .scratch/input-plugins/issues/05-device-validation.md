# 05 — 真机验证：iPhone 浏览器权限、小游戏倾斜和省电

**What to build:** 在真机上确认运动传感器插件的三件只有真机才能验证的事：iOS Safari 的权限流程、小游戏加速度计的轴向和单位、切后台时是否停掉传感器。流程见记忆里的 WeChat 设备测试（iPhone + 测试 AppID + LAN 日志服务 + 预览二维码）。需要用户扫码。

- 浏览器（iPhone Safari，`pnpm --filter example-racer dev --host`，手机访问局域网地址）：第一次触摸弹出权限框；允许后 HUD 提示消失、倾斜能开车；拒绝后不再弹、键盘外没有输入也不报错。
- 小游戏（`SAPLING_RELEASE=1`，`SAPLING_LOG_URL` 指向 `pnpm log-server`）：
  - 轴向：手机向左倾斜时 `MotionInput.x` 为负、车向左；向右为正。有出入就在小游戏生产者里换算（不改事件定义），并把结论写进 `spikes/wechat/REPORT.md` 新的一节。
  - 单位：平放时 `z ≈ 1`（或 −1，一并记录）。
  - 切后台：日志里能看到 `stopAccelerometer`，回到前台后倾斜恢复；后台期间没有 `motion` 事件进队列。
  - 帧率：`game.frameStats` 60 fps，`interval: 'game'`（20 ms）的事件频率不造成可见开销。
- Android（有设备的话）：同样的四项，记录差异。

**Blocked by:** 03

**Status:** 小游戏部分 done（2026-10-20）；iOS Safari 的权限流程未验

- [ ] iOS Safari：允许 / 拒绝两条路径都验证（这次只扫了小游戏的码，浏览器那条没做）
- [x] 小游戏 iOS：倾斜能开车（用户反馈"没有什么大问题"）、60 fps（`[perf]` 16 条，logic 0.37 ms、render 1.1 ms，加速度计 20 ms 一次没有可见开销）。轴向 / 单位的具体读数（平放 `z` 的符号、左压低时 `x` 和 `roll` 的符号）还没从用户那里拿到数字，待补进这里和 `spikes/wechat/REPORT.md`
- [ ] 轴向有出入时修正小游戏生产者，并补一个用 `g.inject` 固定住换算的测试（等读数）
- [ ] Android（没有设备）

## Comments

**真机验证（2026-10-20）：** 和 plugin-assets/05 共用一次扫码（`examples/racer` 发布构建，日志服务 7777）。日志里没有错误；切后台的 `stopAccelerometer` 没有专门打日志，靠用户观感（回到前台倾斜仍有效）。注意：实现里 `tilt('left')` 响应的是 `x > 0`（左边压低时传感器量到的"向上"反作用力偏向 +x），和工单正文最初写的"向左倾斜时 x 为负"相反——以实现和 `RawMotionEvent` 的文档为准，真机读数一到就对一下。
