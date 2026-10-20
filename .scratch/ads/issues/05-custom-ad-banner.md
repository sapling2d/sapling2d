# 05 — Banner 迁到 `wx.createCustomAd`；分享页兜底和 multiton 的取舍

**What to build:** 调研（`spikes/wechat-ads/RESEARCH.md`）发现的后续事项。

- `wx.createBannerAd` 从基础库 3.5.5 起官方不再维护，替代是 `wx.createCustomAd`（原生模板广告）。`AdBanner` 接口不变，小游戏实现换成 `createCustomAd`（或按基础库版本二选一）；注意 `adIntervals` ≥ 30 秒、`onResize` 里改宽度会死循环。
- 激励视频的分享页兜底（基础库 3.7.7 起 1004 默认弹分享页，走 `onLoad({ useFallbackSharePage: true })`）：现在插件固定传 `disableFallbackSharePage: true`。是否作为选项暴露给游戏，等真机确认分享页关闭后 `onClose` 的 `isEnded` 再定（打开时奖励规则必须明确）。
- `multiton`（2.8.0 起激励视频可多实例）：v1 不做，有需求再加。

**Blocked by:** 有流量主广告位 id（真机验证）

**Status:** needs-triage
