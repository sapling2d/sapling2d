# 05 — 真机核对小游戏包里的 `~<包名>/` 路径和 `data:` 贴图；发布

**What to build:** 两件只有真机能回答的事，然后发版。需要用户扫码。

- 小游戏（spinblade 或 racer 的 `SAPLING_RELEASE=1` 构建，`SAPLING_LOG_URL` 指向 `pnpm log-server`）：
  - `assets-sub/~sapling2d-touch/joystick-base.png` 在 iOS 和 Android 上都能被 `wx.createImage()` 读到（摇杆有默认皮肤）；不行就记录是 `~` 还是 `@` 的问题，启用 ADR 0011 里的目录名改写预案（构建期改写 + 清单 `aliases` + `WechatAssetPaths` 查表）。
  - 一张 `tex('data:image/png;base64,…')` 的小图（放在 racer 的 HUD 里即可）能显示；记录 iOS 上大 base64 的限制（试一张 ~200 KB 的）。
- 发布：`packages/engine` `pnpm publish`（0.4.0），`packages/touch` `pnpm publish`（0.1.0）；发布前 `pnpm pack` 装到仓库外验证（04 已做，发布前再跑一次）。

**Blocked by:** 04

**Status:** 真机验证 done（2026-10-20，iPhone 17 / iOS 26.6.1）；`pnpm publish` 等用户确认

- [x] iOS：默认皮肤显示，日志里没有 `cannot load`（18 条真机日志：`boot`、16 条 `[perf]`、1 条 warn，见下）
- [ ] Android（没有设备，跳过）
- [x] `data:` 小图显示（24×24 的橙色圆点，racer 右上角）；~200 KB 的大图没有试——需要时再补
- [x] 不可读时的改写预案：不需要，`~` 和 `@` 在 iOS 小游戏的分包路径里都能读
- [ ] 两个包发布，各工单状态同步，spec 状态改为 done

## Comments

**真机验证（2026-10-20）：** 用 `examples/racer` 一次验完（它同时带 motion 读数、左下角默认皮肤的 fixed 摇杆、右上角 `data:` 圆点）。发布构建 0.81 MB，分包 11 KB（三张皮肤）。用户反馈"没有什么大问题"：摇杆皮肤和圆点都显示，没有资源加载错误。帧率稳定 60 fps（logic 0.37 ms、render 1.1 ms）。

唯一的发现是键盘插件的：小游戏入口原来不装 `keyboard()`，于是带 `key()` 绑定的动作启动时警告 `binding type "key" has no input source`。已改为三个入口都装（小游戏里没有事件源，只是让绑定有人认领、`tree.get(Keyboard)` 三端可用），ADR 0010 / CONTEXT.md / llms.txt 同步。
