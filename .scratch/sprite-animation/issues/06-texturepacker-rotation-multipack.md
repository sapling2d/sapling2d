# 06 — TexturePacker 的旋转打包（Allow rotation）和多页打包（Multipack）

**What to build:** `atlas()` 读 TexturePacker 开了 Allow rotation 导出的 JSON（`rotated: true` 的帧渲染时转回来），以及 Multipack 分出来的多页（每页一张图、一个 JSON），顺便认 Phaser 3 格式（所有页在一个 JSON 的 `textures` 里）。

```ts
import page0 from './items-0.json'
import page1 from './items-1.json'
static assets = { items: atlas(['items-0.png', 'items-1.png'], [page0, page1]) }
Main.assets.items.get('sword.png') // 不用管在哪一页，旋转打包的帧尺寸和方向都是原图的
```

**Blocked by:** None

**Status:** done（2026-11-01）

- [x] `TextureFrame.rotated`：`region` 是帧在图里实际占的矩形（宽高和裁剪后的尺寸相反），`width` / `height` / `trim` / `pivot` 都按原图；`atlasFrame` 读 `rotated`，JSON 里 `frame.w/h` 按 TexturePacker 的约定当作未旋转的尺寸
- [x] 渲染：`TextureCache.frameTexture` 给 Pixi 贴图 `rotate: 2`（TexturePacker 顺时针转 90°，Pixi 的图集加载器也用 2），`trim` 矩形按未旋转的尺寸。Sprite、粒子（`texture.uvs`）、九宫格（`textureMatrix.mapCoord`）、闪白剪影（同一个 `frameTexture`）都不用改
- [x] `atlas(paths[], data[] | { textures })`：`pages`、`texture`（第一页）、`isLoaded`（所有页）、`_textures()`（所有页）；帧的路径是 `页#名字`；多页时按 JSON 的 `meta.image` 核对顺序（只比文件名），页数对不上、同一张图列两次、帧名跨页重复、空数组都报错
- [x] Vite 插件：`atlas([...])` 数组里的每个字面量路径都检查（各自的行列），遇到不是字面量的项就停
- [x] Aseprite 的 `rotated` 帧照常读（原来报错）
- [x] 测试：解析（旋转、多页、Phaser 3、参数错误）、场景资源（两页都加载 / 都卸载）、渲染（Pixi 贴图的 frame / orig / trim / rotate / uv 四角）、Vite 插件（数组形式、缺页时报错指向那一项）
- [x] 文档示例 `docs/examples/multipack.test.ts`（样本 `items-0.json` / `items-1.json` 是 TexturePacker 7.0.1 真实导出），`llms.txt` 新增“多页图集与旋转打包”一节，`CONTEXT.md` 更新 Atlas 词条
- [x] `pnpm check` 通过

## Comments

**实现与验证（2026-11-01）：**

- 旋转方向：TexturePacker 自带的 30 个导出器模板（`TexturePacker.app/Contents/Resources/exporters/*/exporter.xml`）全部是 `<rotationDirection>cw</rotationDirection>`；JSON 里 `rotated: true` 的帧 `frame.w/h` 是未旋转的尺寸（实测 7.0.1 导出：12×40 的竖条裁成 10×38 后写成 `{"w":10,"h":38}`，图里占 38 宽 10 高）。和 Pixi `Spritesheet` 的读法一致（`rotate: 2`）。
- 多页 API 用两个顺序一致的数组而不是对象或成对数组：和单页的 `atlas(path, data)` 形状一致，Vite 插件能按字面量检查每一页，Phaser 3 的单文件多页也能共用同一个签名。顺序错位的风险用 `meta.image` 核对来兜底（单页不核对，图片改名不受影响）。
- 浏览器验证：用 TexturePacker 导出 12 个按透明度画出形状的图标（两页，4 个旋转帧，其中 arrow 同时裁剪），在 `examples/sprite` 里临时换成校验场景（已还原）：所有旋转帧方向正确，闪白剪影对齐、`flipH/flipV`、九宫格、粒子都正常；Pixi 贴图 `rotate=2`、`frame` 宽高互换、`orig` 是原图尺寸。
- 本机 TexturePacker 是过期的 essential 许可：用到 Pro 功能（旋转、多页、trim）时会把部分精灵染红并加水印，所以仓库里只提交它的 JSON，不提交图片（无头测试不读图）。
- 没做：`meta.scale`（缩放变体：TexturePacker 的 `--scale` 也会写它，自动按它放大会和“故意缩小素材”的用法打架，先文档说明忽略）、polygon 打包（`vertices` 忽略，按矩形画）、法线贴图。
