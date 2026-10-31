# 06: `ScrollContainer` 基础 —— 拖动滚动、阈值内点击透传、夹紧

**What to build:** 把条目加到 `scroll.content` 下、设好 `contentSize`，单指拖动就能滚动（默认只开竖向）：按在空白处由容器自己捕获；按在子按钮上先由按钮捕获，手指位移超过 `dragThreshold`（默认 12 设计像素）时容器用 `capturePointer` 接管，按钮收到抬起不发 `clicked`、视觉恢复；阈值内抬起则按钮正常 `clicked`。这一票不做惯性与回弹：松手停在夹紧后的位置。裁剪由容器的 `clipRect = rect` 提供，滚出可见区的条目看不见也点不到；`scrollOffset` / `scrollX` / `scrollY` / `scrollTo(offset)`（立即）可读写；`scrolled` 信号；`dump` 显示 `scrollOffset` 与 `contentSize`。

**Blocked by:** 02 — `clipRect`；03 — `capturePointer`；04 — `@sapling2d/ui` 包与 `Button`

**Status:** needs-triage（2026-10-31 挂起：先不做滚动列表；重新立项时连同 03 一起做）

- [ ] 结构：容器 `inputPickable = true`、`clipRect` 等于 `rect` 且随 `size` 更新；`content: Node2D` 子节点；`contentSize` 由游戏给；`horizontal` / `vertical` 开关默认 false / true
- [ ] 容器通过 `InputSource` 订阅原始指针事件（`pointerdown` / `pointermove` / `pointerup` / `pointercancel`），进树时 `addSource`、离树时 `removeSource`；`handle` 与 `process` 不分配（起点、当前位置用数字字段）
- [ ] 按在空白处 `g.drag` 竖向 100 → `scrollOffset.y` 变化量与位移一致（内容反向移动），`scrolled` 发出
- [ ] 按在子 `Button` 上、阈值内 `g.tap` → 按钮 `clicked`、`scrollOffset` 不变
- [ ] 按在子 `Button` 上、`g.drag` 超过阈值 → 按钮无 `clicked`、`released` 一次、主体恢复；容器开始滚动，之后的位移都算进 `scrollOffset`
- [ ] 只开竖向时横向位移不滚动、不抢捕获（横向拖动按钮仍能 `clicked`）；开横向时对称成立；两个都开时按任一轴超阈值接管
- [ ] `scrollOffset` 夹在 `0 .. contentSize - size`（内容比容器小时为 0）；拖过头停在边界；`scrollTo` 立即生效并夹紧
- [ ] 第二根手指在滚动中按下被忽略；切后台 / 容器隐藏 / 暂停 → 拖动结束、无残留状态；`processMode: 'always'` 的容器在 `tree.paused` 时仍可滚动
- [ ] 滚出 `clipRect` 的子按钮 `g.tap` 不触发 `clicked`（依赖 02 的拾取规则，这里做集成断言）
- [ ] 确定性：同一组输入两次运行 `scrollOffset` 相同
- [ ] `dump` 显示 `scrollOffset`（非零时）、`contentSize`
- [ ] 包内 `docs/examples/ui-scroll.test.ts`，`llms.template.md` 界面控件一节加滚动容器段落、节点清单 / dump 条目、陷阱（`contentSize` 要自己给；暂停菜单要 `processMode: 'always'`）；`CONTEXT.md` 加 `ScrollContainer` 词条
- [ ] 浏览器里用一个 30 项的列表肉眼确认裁剪与透传（截图记录在工单评论）
- [ ] `pnpm check` 绿
