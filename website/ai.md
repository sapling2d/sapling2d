# 和 AI 一起开发

sapling2d 从一开始就考虑了让编程 agent（Claude Code、Cursor、Codex……）来写游戏。

## 为什么适合 agent

- **全部是代码**：没有编辑器，没有场景文件。agent 能读、能改的就是游戏的全部。
- **能自己验证**：`createTestGame` 在 Node 里逐帧跑游戏，`g.dump()` 把场景树打印成文本。agent 不需要看屏幕，就能知道游戏的状态对不对。
- **结果确定**：同一个 seed、同样的输入，结果相同。测试失败可以复现，不会时好时坏。
- **类型严格**：动作名、组名、存档 key、场景参数都有类型，拼错就编译不过，`tsc` 能抓住很多错误。

## llms.txt

[`llms.txt`](https://github.com/sapling2d/sapling2d/blob/main/packages/engine/llms.txt) 把整个 API、能跑的示例和常见陷阱放在一个文件里，随 npm 包发布：

```
node_modules/sapling2d/llms.txt
```

让 agent 在改代码之前先读它。文件里的示例代码都来自引擎仓库里的测试，测试通过才能发布，所以不会过时。

## 项目模板里的 AGENTS.md

[`templates/game`](https://github.com/sapling2d/sapling2d/tree/main/templates/game) 带了一份 `AGENTS.md`，告诉 agent：

1. 先读 `llms.txt`；
2. 先写测试再改行为；
3. 用 `pnpm check`（`tsc` + `vitest run`）验收，两个都过才算完成；
4. 测试失败时先 `console.log(g.dump())` 看状态，不要猜。

从模板起项目，这份说明就已经就位了。可以按自己的游戏补充规则。

## 推荐的工作方式

- 让 agent 先写一个描述行为的测试（"点击后生成一个球""两个同级的水果合成"），确认失败，再实现。
- 在测试里直接调用场景的方法布置状态，比模拟一长串点击更稳。
- 给自己的节点覆写 `dumpProps()`，把关键状态（等级、血量）也打到 `dump()` 里，agent 一眼就能看到。
- 画面效果（手感、动画节奏）测试测不出来，还是要在浏览器里看：`pnpm dev`，控制台里 `sapling.tree.dump()`。
