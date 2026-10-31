# 07: `ScrollContainer` 手感 —— 惯性、回弹、`scrollTo` 动画

**What to build:** 在 06 的基础上让列表有原生手感：松手后按最近几帧的速度继续滚动并按 `deceleration` 衰减到停止；拖过边界时有阻尼、松手回弹到边界；`scrollTo(offset, { animate: true })` 平滑滚到目标；`inertia` / `bounce` 都可以关掉回到 06 的行为。时间在 `process(dt)` 里推进（含 `timeScale`）。

**Blocked by:** 06 — `ScrollContainer` 基础

**Status:** needs-triage（2026-10-31 挂起：先不做滚动列表；重新立项时连同 03 一起做）

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
