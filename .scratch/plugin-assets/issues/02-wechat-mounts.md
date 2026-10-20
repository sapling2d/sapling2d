# 02 — `saplingWechat()`：挂载的资源进小游戏包

**What to build:** 挂载目录里的文件和 `public/assets` 一样被规划到主包 / 分包、拷贝、写进清单、算进体积。规格见 `../spec.md`"`saplingWechat()`"一节。

- `planAssets(assetsRoot, isMain, mounts)`：挂载目录的文件以 `~<pkg>/<rest>` 的路径加入；`isMain` 作用在这个路径上（`mainAssets: ['boot/**', '~sapling2d/boot/**']` 这样写就进主包），默认全进分包。
- `copyAsset`：`~` 路径从挂载目录拷到 `<outDir>/assets/...` 或 `<outDir>/assets-sub/...`，目录名原样（`assets-sub/~@foo/joystick/knob.png`）。
- 清单 `main` 里的 `~` 路径原样写入；`WechatAssetPaths` 不改。
- `checkPackageSize` 的 `main` / `sub` 统计包含挂载文件。
- `writeBundle` 里"主包资源变了"的比较照常。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `test/wechat-build.test.ts`：同 01 的临时工程，`build:wechat` 后 `dist-wechat/assets-sub/~@foo/joystick/knob.png` 存在，`game.js` 里的清单 `main` 不含它；`mainAssets: ['boot/**', '~@foo/joystick/**']` 时它在 `dist-wechat/assets/` 下且清单 `main` 含它
- [ ] 体积报告的分包字节数包含它
- [ ] 删掉挂载包（从 `dependencies` 移除）重新构建后，包里没有它的目录
- [ ] 现有 13 个用例不变；`pnpm check` 绿

**实现提示**

- `planAssets` 是导出函数、有直接的单元测试：签名加第三个参数时给默认值 `new Map()`，旧调用不变。
- `~` 和 `@` 在小游戏文件路径里是否可读由 05 真机核对；这张工单只保证产物目录结构正确。
