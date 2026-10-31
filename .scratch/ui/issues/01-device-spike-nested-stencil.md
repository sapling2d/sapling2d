# 01: 真机 spike —— 嵌套 stencil 裁剪在 iOS 微信 WebGL1 上的正确性与开销

**What to build:** 一个放在 `spikes/clip/` 的一次性小游戏页面和一份 REPORT。页面里有两层嵌套的矩形裁剪容器（外层不旋转、内层旋转 15°），每层各有若干精灵越过边界，另有一组 10 个带裁剪的容器、每个含 20 个精灵的压力场景；全部用 Pixi v8 的 `Container.mask`（stencil 路径）实现，和 `keep` 模式的全屏 mask 同时开着。在浏览器、微信开发者工具模拟器和 iPhone 真机上跑，用现有的日志服务和 `snapshot()` 拿截图与 `FrameStats`。REPORT 回答：嵌套 stencil 在真机上裁得对不对、和 `keep` 模式的 mask 叠加是否正常、压力场景的 logic / render 毫秒数，以及是否需要在规格之外加 scissor 路径。

**Blocked by:** None (can start immediately)

**Status:** done（2026-10-31；模拟器数据未拿到，见 REPORT）

- [x] `spikes/clip/` 能用现有的 `saplingWechat` 流程产出发布构建并在 iPhone 真机运行（测试号、`cli preview` 二维码、`SAPLING_LOG_URL` 日志服务，见 `wechat-device-testing` 记忆与 `templates/game/AGENTS.md`）
- [x] 真机截图里：外层裁剪外的精灵不可见；内层旋转容器的裁剪边是斜的且与浏览器一致；`keep` 模式黑边区域内什么都不画
- [x] REPORT 记录三个环境（浏览器 / 模拟器 / 真机）压力场景的 `FrameStats`（logic / render 的 avg 与 max），并与同样精灵数、不带裁剪的对照组比较
- [x] REPORT 给出明确结论：stencil 可用 → 规格不变；stencil 不可用或开销不可接受 → 列出 scissor 路径的实现方案和限制（只能无旋转），供 02 采用
- [x] REPORT 记下模拟器与真机的差异（若有），`spikes/clip/` 不进 workspace

## Comments

**2026-10-31：** 完成。浏览器（Chrome）和 iPhone 17（iOS 26.6.1，基础库 3.17.6）都跑通；三层嵌套 + `keep` 根 mask 在真机上裁剪正确，10 个裁剪容器对 200 个精灵的渲染代价约 +0.45 ms / 帧、60 fps 不掉。结论：stencil 可用，02 不需要 scissor 路径。模拟器两次 `cli open` / `auto-preview` 都没发出 boot 日志，没有继续追（真机为准）；需要时在开发者工具里手动编译一次即可补数据。给 02 的实现提示写在 `spikes/clip/REPORT.md` 结论第 3 条（mask 要算进节点自己的显示对象，否则 `_syncChildren` 对账会移掉它）。
