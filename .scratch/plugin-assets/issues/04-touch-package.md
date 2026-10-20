# 04 — `packages/touch`（`sapling2d-touch`）：屏幕控件搬成带默认皮肤的插件包

**What to build:** 用真实的外部插件验证整条链路；同时回答"TouchJoystick 该不该在引擎里"。规格见 `../spec.md`"`sapling2d-touch`"一节。

- 新 workspace 包 `packages/touch`：`package.json`（名 `sapling2d-touch`，`"sapling2d": { "assets": "assets" }`，`peerDependencies: { sapling2d: ">=0.4" }`，devDependencies 用 `workspace:*`，`exports` 指向 `src/index.ts`、`publishConfig.exports` 指向 `dist/`，`files: ["dist", "assets", "README.md"]`，`prepublishOnly` 复用引擎的 `check-publish.ts` 逻辑）、`tsdown.config.ts` 单入口、`tsconfig.json`（无 DOM）、`vitest.config.ts`。
- 搬 `TouchScreenButton.ts`、`TouchJoystick.ts` 及其测试（`touch-button`、`touch-joystick`）和 `docs/examples` 里的两个示例；引擎主入口删除这两个导出；`core/input/hit.ts` 的 `canHit` / `hitsAt` 若节点用到了就从 `sapling2d` 公开导出（现在节点只用 `hitTest`，预期不需要）。
- 默认皮肤 `assets/joystick-base.png`、`joystick-knob.png`、`button.png`：`scripts/gen-assets.mjs` 用 Node 生成（无依赖的 PNG 编码器，platformer 的脚本可参考），圆形、灰白带透明度，各 ≤ 10 KB，提交生成结果。
- `TOUCH_SKIN` 导出；`touch()` 插件 `preload(TOUCH_SKIN)`；节点默认值按 spec；没装 `touch()` 时进树 `console.warn` 一次并照常工作。
- 跟上：`examples/platformer`（`Controls.ts`）、`examples/spinblade`（HUD 摇杆、`touchDebug.ts`）、`templates/game`、hero-guard（若用到）、`llms.template.md`（屏幕按钮 / 摇杆两节改成从 `sapling2d-touch` 导入 + `plugins: [touch()]`，节点清单表，"插件"一节的"现有插件"）、`CONTEXT.md`（TouchScreenButton / TouchJoystick 词条、Entry points）、三个 README 的入口表、`templates/game/AGENTS.md`。
- `sapling2d` 版本 0.4.0（破坏性：主入口不再导出屏幕控件）；`sapling2d-touch` 0.1.0。发布留给 05。

**Blocked by:** 01, 02, 03

**Status:** done（2026-10-20；浏览器截图留到 05 和真机一起看）

- [x] `grep -rn 'TouchScreenButton\|TouchJoystick' packages/engine/src` 为空
- [x] `packages/touch` 的测试全部通过（原 36 个 + 新的 3 个：默认皮肤已加载、显式 `null` 不显示、没装 `touch()` 的警告一次且按钮照常工作；两个 docs 示例也在这个包里跑）
- [x] `createTestGame({ plugins: [touch()] })` 后 `TOUCH_SKIN.base.isLoaded`
- [ ] 浏览器里不传贴图的摇杆能看到默认皮肤（截图）→ 05 和真机一起看；构建产物已核对（见下）
- [x] spinblade 的小游戏构建产物里有 `assets-sub/~sapling2d-touch/{joystick-base,joystick-knob,button}.png`，清单 `main: []`、分包 `assets-sub/`
- [x] 全部 workspace 包 `pnpm check` 绿（engine 480 / touch 39 / 示例不变）；hero-guard `pnpm check` 绿（345 用例）
- [x] `pnpm pack` 两个包装到仓库外：`tsc` 过；`createTestGame({ plugins: [touch()] })` + `TouchJoystick` 跑出 `skinLoaded: true, vectorX: 1`；`vite build` 产物里有 `dist/assets/~sapling2d-touch/` 三张图
- [x] `llms.txt` 重新生成（示例从 `../touch/docs/examples/` 引用）；`CONTEXT.md`、三个 README、模板和两个示例的 AGENTS.md 跟上

**实现提示**

- 包名不用 scope（`@sapling2d/…` 需要先在 npm 上拥有 scope；要改的话只是 `package.json` 和路径前缀）。
- 节点默认值的判断用 `options.texture === undefined`（没传）而不是 `??`：显式 `null` 要能表示"只做输入、不显示"。
- `touchDebug.ts` 读 `stick._pointerId`，字段保留。

## Comments

**实现（2026-10-20）：**

- 文件用 `git mv` 搬（历史保留）；节点代码只改了 import（全部来自 `sapling2d` 的公开导出）和默认皮肤两处——验证了"搬到仓库外一行核心代码不用改"。
- **"没装 touch()" 的判断**用服务 token：`touch()` 提供 `TouchControls`，节点进树时 `tree.get(TouchControls)` 抛错就警告（`WeakSet<SceneTree>` 保证每个游戏一次）。没用模块级标志：多个游戏 / 测试共享模块会串。
- `build-llms.ts` 支持带 `/` 的示例名（相对引擎目录），模板里写 `<!-- example:../touch/docs/examples/touch-joystick -->`；`llms.test.ts` 的过期检查照常。示例测试由 `packages/touch` 的 vitest 跑。
- platformer 的方向键摇杆显式传了 `texture: null, textureKnob: null`（它用两张按钮图当装饰，不要默认皮肤）；跳跃按钮有自己的贴图。spinblade 的摇杆本来就传了贴图。
- 皮肤：`gen-assets.mjs` 画抗锯齿圆环，6.2 / 1.3 / 3.8 KB。
- 0.3.0 一直没发布：引擎直接到 0.4.0（主入口不再导出屏幕控件），`sapling2d-touch` 0.1.0；都等 05 发。
