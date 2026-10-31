# 05 — 浏览器 / 小游戏验证与发布

**What to build:** 真实渲染验证（WebGL 里 Mesh 合批、裁剪、混合模式、PMA 图集），小游戏模拟器与真机，然后发布 `sapling2d` 0.4.0 和 `@sapling2d/spine` 0.1.0。

**Blocked by:** 04

**Status:** ready-for-human（浏览器 / 模拟器 / 真机已验；剩 PMA 图集的肉眼检查、`pnpm pack`、发布）

- [x] 浏览器：spineboy idle / walk / jump / shoot 肉眼正常（clipping 的头部遮罩、shoot 的枪口闪光跟随骨骼并随翻转镜像）；控制台无 Pixi 警告（2026-10-31，Chrome）
- [ ] 浏览器：`spineboy-pma.atlas` + `spineboy-pma.png` 换上去一样正常（PMA 路径，只有单元测试覆盖）；`pixelArt: true` 不崩
- [x] 小游戏发布构建通过：主包 0.97 MB（gzip 279 KB）、资源分包 0.49 MB；比重新构建的 sprite 示例（0.81 MB，gzip 234 KB）多约 0.16 MB（gzip +45 KB）（2026-10-31）
- [x] 开发者工具模拟器（2026-10-31，测试号 wxb3bb93d33e62448a，`cli open`）：跑通，截图 `logs/idle-*.png` / `logs/bench-*.png` 和浏览器一致（clipping、网格、10 个 spineboy 的压力阶段）。`[perf]`（模拟器约 55 fps 封顶）：1 个 spineboy logic 0.15 ms / render 0.3–0.45 ms；10 个（9 个 run / walk + 主角）logic 0.6 ms / render 1.4 ms（max 6 ms）
- [x] iPhone 真机（2026-10-31，iOS，`cli preview` 二维码 + 日志服务，`examples/spine/src/main.wechat.ts` 的两段式跑法）：画面正确（`logs/idle-*.png` / `bench-*.png`，玩家在点跳和走路）。`[perf]` 每 5 秒一行，稳定 60 fps：
  - 1 个 spineboy（idle，玩家点跳）：logic 0.66–1.07 ms，render 1.55–1.88 ms（首个区间 max 33.9 ms 是着色器编译 / 上传）
  - 10 个 spineboy（9 个 run / walk + 主角走路）：logic 1.11–1.19 ms，render 3.95–4.19 ms（max 4.5–5.9，首个区间 13.4），interval max 18–19 ms
  - 对照模拟器：render 1.4 ms（10 个），模拟器有 JIT，真机慢约 3 倍，和 `ios-no-jit-allocation-cost` 的经验一致。一个 spineboy（52 slot）在真机上约 0.3 ms 渲染 + 0.05 ms 逻辑。
- [ ] `pnpm pack` 装到仓库外：`tsc` 过、`createTestGame({ plugins: [spine()] })` 跑通、`vite build` 产物正常
- [ ] 发布（`pnpm publish`，不要 npm）

## Comments

**2026-10-31：** 浏览器和发布构建已验（见 04 的记录）；模拟器、真机、`pnpm pack` 和发布留给人。引擎要发 0.4.0（新增 `sapling2d/render`、`Resource`、`assetFunctions`，无破坏性变化），`@sapling2d/spine` 0.1.0。
