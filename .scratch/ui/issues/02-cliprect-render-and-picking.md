# 02: `Node2D.clipRect` —— 裁剪渲染、拾取遵守裁剪、dump 与文档

**What to build:** 游戏开发者给任意 `Node2D` 设 `clipRect`（本地坐标矩形，默认 null），这个节点自己的内容和子树里越界的部分就不画出来，嵌套取交集，子树里的 `CanvasLayer` 不受影响；滚出裁剪区的 `inputPickable` 节点点不到，抬起点落在被裁区域也不算 `clicked`；`dump()` 里能看到 `clipRect=(x, y, w, h)`。一个 `ColorRect` 的一半伸出带 `clipRect` 的父节点时，浏览器里只看到一半，无头测试里点伸出的那一半不触发 `clicked`。渲染实现按 01 的结论（默认 Pixi stencil mask，`_version` 变了才重建几何，置 null 时移除）。

**Blocked by:** 01 — 真机 spike

**Status:** ready-for-agent

- [ ] `new Node2D({ clipRect: rect(0, 0, 200, 100) })` 与 `node.clipRect = …` / `= null` 均生效；`Rect2` 赋值即替换，改动触发 `_version++`
- [ ] 渲染同步测试（`PixiRenderer._createForSyncTests()`）：设了 `clipRect` 的节点容器有 mask 且几何等于矩形；改矩形后几何更新；置 null 后 mask 移除并销毁；节点销毁时不留下 Graphics；`CanvasLayer` 子树的容器不带祖先的 mask
- [ ] 拾取测试（`createTestGame`）：裁剪外的可点击子节点 `g.tap` 不发 `pointerDown` / `clicked`，且这次按下也不触发 `pointerPress()` 动作时的"未处理"路径被容器自己接住的场景可用（容器 `inputPickable` 时由容器收到）；嵌套两层只有同时在两个矩形内才命中；节点自己 `clipRect` 外的自身内容点不到；`CanvasLayer` 里的节点不受场景里祖先 `clipRect` 影响
- [ ] 按下在裁剪区内、抬起在裁剪区外（仍在节点 `hitArea` 内）→ `pointerUp` 发、`clicked` 不发
- [ ] 正在被拖动的节点滚出裁剪区不会触发帧首的 `cancelUnhittable` 抬起
- [ ] draw-order 交叉验证测试新增用例：同一棵树里渲染同步被裁掉的节点在拾取里也点不到
- [ ] `g.dump()` 非 null 时显示 `clipRect=(x, y, w, h)`，格式与 `Rect2.toString` 一致；dump 属性表更新
- [ ] 祖先链检查只发生在按下 / 抬起路径；每帧渲染同步在 `clipRect` 未变时不分配
- [ ] `CONTEXT.md` 词汇表加 `clipRect`；`llms.template.md` 在界面层（CanvasLayer）或纯色矩形一节后加"裁剪（clipRect）"小节和可运行示例（`docs/examples`），常见陷阱加"CanvasLayer 不受祖先裁剪"；`pnpm --filter sapling2d llms` 后 `llms.test.ts` 通过
- [ ] 有相机时裁剪随节点世界变换走（相机平移后裁剪位置正确）：浏览器里用一个示例手动确认并在工单评论里记录
- [ ] `pnpm check` 绿
