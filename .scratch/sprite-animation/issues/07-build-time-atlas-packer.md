# 07 — 构建期打包图集（不依赖 TexturePacker）

**What to build:** 引擎自带一个打包步骤，把一个目录里的 PNG（`public/assets/sprites/items/*.png`）打成图集：图片 + 通用的图集 JSON（JSON Hash，和 `atlas()` 已经能读的格式一样）。agent 不用装桌面工具、不用买许可，自己就能完成“散图 → 图集”，loader 不用改。TexturePacker 变成可选项。

**Blocked by:** None

**Status:** needs-triage

## 为什么

- 06 的讨论结论（2026-11-01）：图集 JSON 值得兼容，因为它是 Pixi / Phaser / Aseprite / TexturePacker / free-tex-packer 共用的事实标准；但不该追 TexturePacker 的功能。agent-first 的下一步是让 agent 自己完成打包，JSON 退化成引擎的图集交换格式。
- 许可证：TexturePacker 的 trim / 旋转 / 多页是付费功能，essential 许可导出的图会被染红加水印（06 实测）。agent 驱动的流水线不该要求每个开发者都买许可。
- `examples/plane` 的 `gen-assets.mjs` 已经自己产出这种 JSON，说明需求是真的。

## 要做的（初稿，triage 时再定）

- [ ] 纯 JS 实现，不调外部 CLI（和 spec 里“不在构建时调 Aseprite CLI”一致）：矩形装箱（MaxRects 一类）、裁剪透明边（trimmed + spriteSourceSize + sourceSize）、超过单页尺寸时分页（输出 `name-0` / `name-1`……，`meta.image` 填对，正好接上 06 的多页 `atlas()`）
- [ ] 默认不旋转（输出更简单，像素不受采样影响）；装箱率真的不够再考虑
- [ ] 单页尺寸上限默认 2048（小游戏），可配
- [ ] 输出确定：同样的输入得到逐字节相同的 PNG 和 JSON（方便提交和 diff）
- [ ] 测试：装箱不重叠、trim 数值、分页、产出的 JSON 能直接被 `atlas()` 读

## 待定

- 入口：Vite 插件（`sapling()` 里配目录，dev 时监听变化）还是独立脚本 / CLI（`pnpm sapling pack`）？插件对 agent 最省事，但产物不提交时 `atlas('items.png')` 的存在性检查和类型（`import data from './items.json'`）要另想办法。
- 产物提交到仓库，还是只在构建时生成？
- 帧名：用相对目录的文件名（`hero_attack_01.png`），和 TexturePacker 默认一致，`frames(prefix)` 直接能用。
- PNG 编解码用哪个依赖（`pngjs` 纯 JS / `sharp` 带原生模块）；作为 `sapling2d/vite` 的依赖还是单独的包。
- 锚点（pivot）怎么声明：旁边放一个小 JSON，还是先不支持。
