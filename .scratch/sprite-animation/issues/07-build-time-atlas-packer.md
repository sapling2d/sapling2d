# 07 — 构建期打包图集（不依赖 TexturePacker）

**What to build:** 新包 `@sapling2d/pack`：把一组 PNG 打成图集，输出图片 + 通用的图集 JSON（JSON Hash，`atlas()` 已经能读的格式）。agent 不用装桌面工具、不用买许可，自己就能完成“散图 → 图集”，loader 不用改。TexturePacker 变成可选项。

```ts
import { packAtlas } from '@sapling2d/pack'
const { pages } = packAtlas('items', sprites) // sprites: { name, image: { data, width, height } }[]
// pages[i]: { image: RGBA 像素, json: 一页的图集 JSON（meta.image 是 items.png 或 items-0.png…） }
```

```sh
pnpm sapling-pack art/items public/assets --json src   # art/items/**/*.png → public/assets/items.png + src/items.json（放不下时 items-0 / items-1…）
```

**Blocked by:** None

**Status:** done（2026-11-01）

## 为什么

- 06 的讨论结论（2026-11-01）：图集 JSON 值得兼容，因为它是 Pixi / Phaser / Aseprite / TexturePacker / free-tex-packer 共用的事实标准；但不该追 TexturePacker 的功能。agent-first 的下一步是让 agent 自己完成打包，JSON 退化成引擎的图集交换格式。
- 和直接用 TexturePacker 的区别不在输出（同一种 JSON），在谁能跑、能不能复现：TexturePacker 每台机器要装、trim / 旋转 / 多页要付费许可（essential 许可导出的图被染红加水印，06 实测），CI 上难做逐字节复现；自带的打包 `pnpm install` 之后哪里都能跑，版本跟着锁文件。功能上 TexturePacker 全面更强，不追。
- 每个游戏都在自己造：hero-guard 的 `scripts/art/pipeline.ts`（`packAll`：maxrects-packer + sharp，不旋转、2048、`pnpm art check` 逐字节复现），plane 的 `scripts/gen-assets.mjs`。收进引擎消除重复。

## 已定（2026-11-01）

- **独立的包 `@sapling2d/pack`**（`packages/pack`）：只在开发机 / CI 上跑，不给 `sapling2d` 加依赖。
- **核心是纯函数**，不碰文件和图片编解码：输入 RGBA 像素，输出每页的 RGBA 像素 + JSON 对象。编码由调用方决定（hero-guard 用 sharp 做调色板量化，体积约 1/3；CLI 用纯 JS 的 `pngjs`）。依赖只有 `maxrects-packer`（核心）和 `pngjs`（CLI）。
- **CLI 只做最常见的事**：目录里的 PNG（按文件名排序）→ 图片 + JSON；帧名是相对路径的文件名（`hero_attack_01.png`，和 TexturePacker 默认一致，`frames(prefix)` 直接能用）。
- **产物提交到仓库**：小游戏打包和无头测试都要文件在磁盘上；输出确定（同样的输入逐字节相同），游戏可以像 `pnpm art check` 那样重跑比对。
- **默认**：裁掉透明边（`trim: true`，输出 `trimmed` / `spriteSourceSize` / `sourceSize`）、不旋转、单页上限 2048、间距 2；放不下时分页（单页时文件名 `name.png`，多页时 `name-0.png`、`name-1.png`…，`meta.image` 填对，接上 06 的多页 `atlas()`）。
- **布局只取决于输入的顺序和内容**：核心按传入的顺序装箱（调用方排序），CLI 按文件名排序。
- **每帧可带 `pivot`**（原样写进 JSON；hero-guard 在用）。`meta` 可以附加字段（hero-guard 的 `app` / `scale`）。
- **不做**：旋转、polygon、缩放变体、压缩贴图格式、Vite 插件（产物不在磁盘上会和资源存在性检查、`import data from './x.json'` 的类型冲突；以后需要 watch 再说）。

## 验收

- [x] `packages/pack`：`packAtlas`、`opaqueBounds`、CLI；测试覆盖装箱不重叠、像素拷贝正确、trim 数值、全透明图、分页与文件名、超过单页尺寸的单张图报错、重名报错、产出的 JSON 被 `atlas()` 读出正确的尺寸、输出确定
- [x] llms.txt：“多页图集与旋转的帧”之后加打包的说明和示例
- [x] hero-guard 的 `packAll` 换成 `packAtlas`（`trim: false` 保持现有输出），`pnpm art check` 通过；做不到逐字节一致时说明差在哪、重新生成后在浏览器里看一遍
- [x] `pnpm check` 通过

## Comments

**实现与验证（2026-11-01）：**

- `maxrects-packer` 锁在 2.7.3：2.7.4 的 package.json 加了 `"type": "module"` 却让 `main` 指向 CJS 文件，Node 下 `import { MaxRectsPacker }` 直接失败。锁死版本对“输出确定”也是必要的（装箱算法变了布局就变）。
- 发布构建：`platform: 'node'` 输出 `.mjs`，`publishConfig` 的 `bin` / `exports` 指向 `dist/*.mjs`；`node dist/cli.mjs --help` 能跑。仓库里 `bin` 直接指向 `src/cli.ts`（Node 原生类型剥离），所以 `engines.node >= 22.18`。
- hero-guard 迁移：`packAll` 的装箱、拷像素、写 JSON 换成 `packAtlas(name, sprites, { maxSize: 2048, trim: false, meta: { app, scale } })`，解码、缩放、调色板量化仍用 sharp；依赖 `maxrects-packer` 换成 `@sapling2d/pack`（link）。
  - 9 张图集的 **JSON 逐字节不变**（布局、帧、锚点、meta 字段顺序都一样）。
  - **PNG 变了**：原来用 sharp 的 `composite` 叠到透明画布上，它按预乘 alpha 合成，半透明像素有取整误差；现在直接拷贝像素。量化前对比：4746 万像素里 28582 个半透明像素差 1（0.06%），不透明和全透明的完全相同。量化加抖动对输入敏感，差 1 就选出不同的调色板，所以量化后 17–48% 的通道值不同；但按原图（未量化）算的误差新旧一样（每张平均误差差 < 0.1，最大误差同一量级），总体积 3812 KB → 3793 KB。
  - `pnpm art pack` 重新生成后 `pnpm art check` 通过（74 个文件可复现），hero-guard `pnpm check` 通过；浏览器里看了主页（islands / home_icons / ui）和战斗（hero_archer / enemies / wall / fx），显示正常，控制台无错误。
  - 已提交到 hero-guard（`c879e78`）。
- plane 的 `gen-assets.mjs` 迁移（2026-11-02）：它自己写的货架装箱（`pack()`）换成 `packAtlas`（默认选项：裁透明边），预乘 alpha 的浮点画布先 `toRgba()` 转成 RGBA 字节；精灵按名字排序后打包。
  - 只有 `sprites.png` / `src/sprites.json` 变了；爆炸图、背景、音效重跑后逐字节不变（拆出 `toRgba` 的重构没改输出）。
  - 图集 512×512 → 474×416（显存约 1 MB → 0.79 MB），文件 27.9 KB → 27.1 KB；12 帧的名字和原始尺寸都不变。
  - 每帧按原始尺寸还原后和旧图集逐像素比较：8 帧完全相同，4 帧（`bullet_boss` / `bullet_enemy` / `powerup_*`）只差在 alpha = 0 的像素上（旧的带着 RGB，裁掉后补 0），看不见。
  - plane `pnpm check` 通过；浏览器里看了标题页和战斗（战机、敌机、子弹、暂停按钮），子弹对准机头，控制台无错误。
