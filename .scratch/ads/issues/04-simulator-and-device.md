# 04 — 模拟器验证（真机等有广告位 id 再补）

**What to build:** 用开发者工具的模拟广告验证真实生产者的流程。用户目前**没有流量主的广告位 id**，真机那组只记录项目、不阻塞发布。

- 模拟器（开发者工具对任意 `adUnitId` 显示模拟广告）：spinblade `dev:wechat`，`VITE_AD_REWARDED=adunit-test` 之类随便填一个 id；失败后点"看视频复活"→ 模拟器弹模拟激励视频 →"完成"→ 复活；"中途退出"→ `skipped` 的提示。插屏、banner 同样看一遍；banner 的 `onResize` 高度和贴底位置对不对。模拟器和真机差异大（`spikes/wechat/REPORT.md`），这里只验流程和回调的形态，不验表现。
- 真机（等有广告位 id；hero-guard 开通流量主后也行，到时候在它那边验）：
  - 激励视频播放期间 `wx.onHide` 是否触发（日志里看 `focusChanged`）。没结论之前 `pauseGame` 默认开着——两种情况下都不冲突，记进 `spikes/wechat/REPORT.md`。
  - 看完 / 中途退出两条路的返回值；关闭后下一条有没有预加载（第二次 show 不等待）。
  - banner 真实高度和位置；切后台回来 banner 还在。
  - 频控：连续两次插屏，第二次 `unavailable` 且只 warn 一次。

**Blocked by:** 03

**Status:** ready-for-agent（模拟器部分；真机部分 blocked：没有广告位 id）

- [ ] 模拟器：激励视频两条路、插屏、banner 高度 / 位置
- [ ] 真机（blocked，等 id）：`onHide` 结论写进 `spikes/wechat/REPORT.md`
- [ ] 真机（blocked，等 id）：三种广告各一遍，频控和预加载
- [ ] 发现的差异回填到 02 的实现和测试
