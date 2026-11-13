# 07: `ScrollContainer` 手感 —— 惯性、回弹、`scrollTo` 动画

**What to build:** 在 06 的基础上让列表有原生手感：松手后按最近几帧的速度继续滚动并按 `deceleration` 衰减到停止；拖过边界时有阻尼、松手回弹到边界；`scrollTo(offset, { animate: true })` 平滑滚到目标；`inertia` / `bounce` 都可以关掉回到 06 的行为。时间在 `process(dt)` 里推进（含 `timeScale`）。

**Blocked by:** 06 — `ScrollContainer` 基础

**Status:** done（2026-11-14）

- [ ] 快速 `g.drag` 后继续 `g.step` 若干帧：`scrollOffset` 继续沿拖动方向变化、速度单调衰减、最终停止且不越界；`inertia: false` 时松手即停
- [ ] 拖过边界：拖动期间 `scrollOffset` 可以越界但位移按阻尼缩小；松手后若干帧内回到边界并停住；`bounce: false` 时拖动期间就夹紧
- [ ] 惯性冲到边界：`bounce` 开时越界一点再回弹，关时直接停在边界
- [ ] `scrollTo(offset, { animate: true })` 在有限帧内到达并夹紧；动画中用户按下会中断动画并接管
- [ ] `deceleration` 可配置；默认值在真机手感验证后写进工单评论
- [ ] `tree.timeScale = 0.5` 时惯性放慢一倍；`tree.paused` 且 `processMode: 'always'` 时惯性照常推进
- [ ] 切后台中断：惯性中 `g.setFocus(false)` 后速度清零并夹紧
- [ ] 确定性：同一组输入两次运行每帧的 `scrollOffset` 相同；`process` 热路径不分配
- [ ] 文档：滚动容器段落补惯性 / 回弹 / `scrollTo` 动画的说明和选项表
- [ ] iPhone 真机（微信）上用 06 的列表示例确认手感可接受并记录调整过的默认值
- [ ] `pnpm check` 绿

## Comments

- 2026-11-14：惯性（`deceleration` 默认 0.87：每秒损失 87% 的速度，接近 iOS 原生列表）、越界橡皮筋阻尼（iOS 公式，系数 0.55）、临界阻尼弹簧回弹（ω=14，按 1/120 秒子步积分）、`scrollTo` 动画（0.3 秒三次缓出）均已实现并有测试。额外：惯性中按下只按停、不点到条目；拖动被取消（隐藏、暂停、切后台）时不给惯性。
- 待办（人）：真机上用 `ui-scroll` 示例的列表确认手感，必要时调 `deceleration` / 回弹参数并记在这里。
- 2026-11-14：iPhone 微信真机确认（`examples/towerdefense` 的 `VITE_SCROLL=1` 构建：30 行列表 + 切换 deceleration 0.8 / 0.87 / 0.93 的按钮，`[scroll]` 日志经 log server 回传）：用户测试没有问题，默认值保持 0.87。
- 2026-11-14：发版前打包检查：`sapling2d-0.6.0.tgz` + `sapling2d-ui-0.1.0.tgz` 从 npm 官方源装进仓库外的临时工程（发布的 exports 指向 `dist/`，ui 的 peer 是 `>=0.6.0`）：`tsc` 过（发布的 d.ts）、`vite build` 过（默认皮肤 `~@sapling2d/ui/*.png` 从安装的包里挂载）、Node 跑 dist 的 `createTestGame`：30 行列表甩动后 `scrollY` 1552.5 / 2780，轻点可见行点中第 13 行。剩 `pnpm publish`（先 `packages/engine`，再 `packages/ui`）。
