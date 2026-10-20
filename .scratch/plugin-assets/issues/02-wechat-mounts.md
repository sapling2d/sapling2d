# 02 — `saplingWechat()`：挂载的资源进小游戏包

**What to build:** 挂载目录里的文件和 `public/assets` 一样被规划到主包 / 分包、拷贝、写进清单、算进体积。规格见 `../spec.md`"`saplingWechat()`"一节。

- `planAssets(assetsRoot, isMain, mounts)`：挂载目录的文件以 `~<pkg>/<rest>` 的路径加入；`isMain` 作用在这个路径上（`mainAssets: ['boot/**', '~sapling2d/boot/**']` 这样写就进主包），默认全进分包。
- `copyAsset`：`~` 路径从挂载目录拷到 `<outDir>/assets/...` 或 `<outDir>/assets-sub/...`，目录名原样（`assets-sub/~@foo/joystick/knob.png`）。
- 清单 `main` 里的 `~` 路径原样写入；`WechatAssetPaths` 不改。
- `checkPackageSize` 的 `main` / `sub` 统计包含挂载文件。
- `writeBundle` 里"主包资源变了"的比较照常。

**Blocked by:** 01

**Status:** done（2026-10-20）

- [x] `test/wechat-build.test.ts`：同 01 的假包，构建后 `dist-wechat/assets-sub/~@foo/joystick/knob.png`（含嵌套目录）存在，`game.js` 里的清单 `main` 不含它；`mainAssets: ['boot/**', '~@foo/joystick/**']` 时它在 `dist-wechat/assets/` 下且清单 `main` 含它
- [x] 体积报告包含它：主包里 4 MB 的插件文件让发布构建失败，错误指出 `assets/~@foo/joystick/huge.png`
- [x] 从 `dependencies` 移除插件包重新构建后，包里没有它的目录（每次构建都重算挂载、重拷两个目录）
- [x] 现有 13 个用例不变（现在 17 个）；`pnpm check` 绿（engine 512）

**实现提示**

- `planAssets` 是导出函数、有直接的单元测试：签名加第三个参数时给默认值 `new Map()`，旧调用不变。
- `~` 和 `@` 在小游戏文件路径里是否可读由 05 真机核对；这张工单只保证产物目录结构正确。

## Comments

**实现（2026-10-20）：**

- `SaplingWechatOptions.assetPackages` 和 `sapling()` 的同名选项含义一致：两个插件各自调用 `discoverAssetMounts`（都在 `configResolved` 里，便宜），不互相传状态。
- `planAssets` 把游戏文件和所有挂载文件合成一个列表再排序、再按 `isMain` 分，所以清单顺序是稳定的；新增 `assetSource(assetsRoot, mounts, path)` 给拷贝和 `statSync` 找源文件，`copyAsset` 改成接收源文件绝对路径。
- 小游戏构建里 `sapling()` 的 `writeBundle` 不拷（跟随 `copyPublicDir: false`），拷贝只在这里做一次。
