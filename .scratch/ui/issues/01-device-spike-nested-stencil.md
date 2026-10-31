# 01: 真机 spike —— 嵌套 stencil 裁剪在 iOS 微信 WebGL1 上的正确性与开销

**What to build:** 一个放在 `spikes/clip/` 的一次性小游戏页面和一份 REPORT。页面里有两层嵌套的矩形裁剪容器（外层不旋转、内层旋转 15°），每层各有若干精灵越过边界，另有一组 10 个带裁剪的容器、每个含 20 个精灵的压力场景；全部用 Pixi v8 的 `Container.mask`（stencil 路径）实现，和 `keep` 模式的全屏 mask 同时开着。在浏览器、微信开发者工具模拟器和 iPhone 真机上跑，用现有的日志服务和 `snapshot()` 拿截图与 `FrameStats`。REPORT 回答：嵌套 stencil 在真机上裁得对不对、和 `keep` 模式的 mask 叠加是否正常、压力场景的 logic / render 毫秒数，以及是否需要在规格之外加 scissor 路径。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `spikes/clip/` 能用现有的 `saplingWechat` 流程产出发布构建并在 iPhone 真机运行（测试号、`cli preview` 二维码、`SAPLING_LOG_URL` 日志服务，见 `wechat-device-testing` 记忆与 `templates/game/AGENTS.md`）
- [ ] 真机截图里：外层裁剪外的精灵不可见；内层旋转容器的裁剪边是斜的且与浏览器一致；`keep` 模式黑边区域内什么都不画
- [ ] REPORT 记录三个环境（浏览器 / 模拟器 / 真机）压力场景的 `FrameStats`（logic / render 的 avg 与 max），并与同样精灵数、不带裁剪的对照组比较
- [ ] REPORT 给出明确结论：stencil 可用 → 规格不变；stencil 不可用或开销不可接受 → 列出 scissor 路径的实现方案和限制（只能无旋转），供 02 采用
- [ ] REPORT 记下模拟器与真机的差异（若有），`spikes/clip/` 不进 workspace
