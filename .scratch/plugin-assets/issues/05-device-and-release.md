# 05 — 真机核对小游戏包里的 `~<包名>/` 路径和 `data:` 贴图；发布

**What to build:** 两件只有真机能回答的事，然后发版。需要用户扫码。

- 小游戏（spinblade 或 racer 的 `SAPLING_RELEASE=1` 构建，`SAPLING_LOG_URL` 指向 `pnpm log-server`）：
  - `assets-sub/~sapling2d-touch/joystick-base.png` 在 iOS 和 Android 上都能被 `wx.createImage()` 读到（摇杆有默认皮肤）；不行就记录是 `~` 还是 `@` 的问题，启用 ADR 0011 里的目录名改写预案（构建期改写 + 清单 `aliases` + `WechatAssetPaths` 查表）。
  - 一张 `tex('data:image/png;base64,…')` 的小图（放在 racer 的 HUD 里即可）能显示；记录 iOS 上大 base64 的限制（试一张 ~200 KB 的）。
- 发布：`packages/engine` `pnpm publish`（0.4.0），`packages/touch` `pnpm publish`（0.1.0）；发布前 `pnpm pack` 装到仓库外验证（04 已做，发布前再跑一次）。

**Blocked by:** 04

**Status:** ready-for-agent（构建和日志由 agent 准备，扫码由用户操作；`pnpm publish` 需要用户确认）

- [ ] iOS：默认皮肤显示，日志里没有 `cannot load` 错误
- [ ] Android（有设备的话）
- [ ] `data:` 小图显示；大图的结论写进 `spikes/wechat/REPORT.md`
- [ ] 不可读时：改写预案实施并补测试
- [ ] 两个包发布，各工单状态同步，spec 状态改为 done
