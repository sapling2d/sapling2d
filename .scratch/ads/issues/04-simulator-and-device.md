# 04 — 模拟器验证（真机和真广告等有广告位 id 再补）

**What to build:** 用开发者工具验证插件；用户目前**没有流量主的广告位 id**。

**Blocked by:** 03

**Status:** 模拟器部分 done（2026-10-20）；真广告 / 真机 blocked：没有广告位 id

- [x] 模拟器 + 随便填的 id（`adunit-test-*`）：三种广告安装时预加载都收到 `error 1002（广告单元无效）`→ 插屏不弹、`ready.rewarded` 为 false 按钮不显示、banner 不显示，游戏照常跑；每种各 warn 一次。1002 = 广告单元无效（编的 id 或别的 AppID 的 id）；官方没有测试 id，这条路验的是错误路径（见 spikes/wechat-ads/RESEARCH.md）
- [x] 模拟器 + 不配 id（mock）：用户按流程走完没有问题——进结果页弹"模拟插屏广告"→ 关闭；底部"广告"灰条，按钮在它上方；"看视频 · 多带 4 把刀"→"看完 ✓"→ 回到场地、刀 × 8、敌人在动；再死一次 →"关闭 ✗"→ 留在结果页提示"没看完，没有奖励"
- [x] 日志里发现并修掉一个 bug：`show()` 被 wx 以 `{ errCode, errMsg }` 对象拒绝时 warn 文案是 `[object Object]`，改为带错误码解释（`interstitial error 1002 (广告单元无效): no advertisement`），补了测试
- [ ] 真广告（blocked，等 id）：激励视频看完 / 中途退出两条路；关闭后下一条预加载（第二次 show 不等待）；banner 真实高度和位置、切后台回来还在；连续两次插屏第二次 `unavailable` 且只 warn 一次
- [ ] 真机（blocked，等 id）：激励视频播放期间 `wx.onHide` 是否触发，结论写进 `spikes/wechat/REPORT.md`；没结论之前 `pauseGame` 默认开

## Comments

**模拟器（2026-10-20）：** 日志（`SAPLING_LOG_URL`）里今天这次启动：`boot` → 三条 `[sapling2d] ads: … error 1002 (广告单元无效): no advertisement` → 一条 `interstitial [object Object]`（已修）。之后的 mock 构建用户手动走完全部流程，未发现问题。

等 hero-guard 开通流量主后在它那边补真广告和真机两组；到时候 `wx.onHide` 的结论决定要不要把 `pauseGame` 的默认值改掉（现在开着两种情况都不冲突，大概率不用改）。
