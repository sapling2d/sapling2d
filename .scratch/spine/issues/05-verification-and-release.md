# 05 — 浏览器 / 小游戏验证与发布

**What to build:** 真实渲染验证（WebGL 里 Mesh 合批、裁剪、混合模式、PMA 图集），小游戏模拟器与真机，然后发布 `sapling2d` 0.4.0 和 `@sapling2d/spine` 0.1.0。

**Blocked by:** 04

**Status:** ready-for-human（真机需要人操作；浏览器和模拟器部分 agent 可做）

- [x] 浏览器：spineboy idle / walk / jump / shoot 肉眼正常（clipping 的头部遮罩、shoot 的枪口闪光跟随骨骼并随翻转镜像）；控制台无 Pixi 警告（2026-10-31，Chrome）
- [ ] 浏览器：`spineboy-pma.atlas` + `spineboy-pma.png` 换上去一样正常（PMA 路径，只有单元测试覆盖）；`pixelArt: true` 不崩
- [x] 小游戏发布构建通过：主包 0.97 MB（gzip 279 KB）、资源分包 0.49 MB；比重新构建的 sprite 示例（0.81 MB，gzip 234 KB）多约 0.16 MB（gzip +45 KB）（2026-10-31）
- [ ] 开发者工具模拟器：`dist-wechat` 跑通（需要 WX_APPID 测试号，见 memory 的 wechat-device-testing）
- [ ] iPhone 真机：帧耗时（`frameStats`）记录在这里；10 个 spineboy 同屏的数字
- [ ] `pnpm pack` 装到仓库外：`tsc` 过、`createTestGame({ plugins: [spine()] })` 跑通、`vite build` 产物正常
- [ ] 发布（`pnpm publish`，不要 npm）

## Comments

**2026-10-31：** 浏览器和发布构建已验（见 04 的记录）；模拟器、真机、`pnpm pack` 和发布留给人。引擎要发 0.4.0（新增 `sapling2d/render`、`Resource`、`assetFunctions`，无破坏性变化），`@sapling2d/spine` 0.1.0。
