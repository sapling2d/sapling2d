# Spec: UI 系统第一步 —— 裁剪原语、指针捕获转移、`@sapling2d/ui` 控件包

Status: ready-for-agent
Date: 2026-10-31
ADR: docs/adr/0002-node-owns-data-render-sync.md、docs/adr/0010-plugins.md、docs/adr/0011-plugin-assets.md；本规格落地时新增一条 ADR（裁剪是 Node2D 的属性、指针捕获可以转移、控件在独立包）
相关讨论：对比主流小游戏引擎后，UI 是最大的能力缺口（Cocos / Laya 标配 Mask、ScrollView、Button、Widget、ProgressBar）

## Problem Statement

用 sapling2d 做一个小游戏，玩法部分（物理、图块、Spine、粒子、相机）都有现成节点，但一到商店、选关、结算、设置这些界面就要自己造轮子。hero-guard 这个真实游戏自己写了 `Button`、`Overlay`、`Dialog`、面板皮肤表，六个弹窗各自手摆坐标；选关面板只能把三关硬排在固定位置，因为引擎没有滚动列表；滚动列表做不出来的根本原因是渲染层没有任何裁剪能力，也没有"手指滑动时把按下从子按钮手里抢过来"的输入原语。进度条、头像框同样卡在裁剪上。

引擎现有的 UI 原语只有 `Label`、`ColorRect`、`NineSliceSprite`、`CanvasLayer`。每个游戏都要重复实现按钮的按下反馈、禁用态、切后台松开、弹窗按安全区重排这些细节，而且各家实现的边界行为（滑出按钮再抬起算不算点击、滚动时按钮要不要取消）互不一致。

## Solution

分两层解决，边界按现有先例划：**需要渲染层或指针路由私有能力的进核心，用公开 API 写得出来、带默认皮肤的进独立包。**

核心（`sapling2d`）只加两条原语：

1. **裁剪**：`Node2D` 加 `clipRect`（本地坐标的矩形，默认不裁剪）。裁掉这个节点自己的内容和它子树里越界的部分；指针拾取遵守同样的裁剪，滚出可见区域的按钮点不到。
2. **指针捕获转移**：`Node2D` 加 `capturePointer(pointerId)`。一个节点可以把当前按着的某根指针的捕获从别的节点手里接过来，原节点收到一次抬起（不发 `clicked`），之后的移动和抬起发给新节点。滚动容器靠它在手指滑过阈值后接管手势。

新包 `@sapling2d/ui`（和 `@sapling2d/touch` 同一形态：插件预加载默认皮肤，控件只用公开 API）提供第一批控件：`Control`（带尺寸和锚点的界面节点基类，也可以直接当布局盒子用）、`Button`（可配置按下反馈：缩放、压暗、音效）、`ProgressBar`（用裁剪做填充）、`ScrollContainer`（单指拖动、惯性、回弹、阈值内点击仍然透传给子节点）。

ADR 0010 的验证逻辑照搬：`@sapling2d/touch` 证明了 `InputSource` 够用，`@sapling2d/ui` 要证明"裁剪 + 捕获转移"够用。`ScrollContainer` 如果用公开 API 写不出来，补原语，而不是把它搬进核心。

## User Stories

### 游戏开发者（人或 agent）

1. As a 游戏开发者, I want 给任意 `Node2D` 设一个 `clipRect`, so that 它子树里越界的内容不画出来，我不用为了"只显示一部分"去切贴图或算可见范围。
2. As a 游戏开发者, I want 裁剪在本地坐标里定义并跟着节点的变换走, so that 容器移动、缩放时不用重新设置裁剪区域。
3. As a 游戏开发者, I want 嵌套的裁剪自动取交集, so that 滚动列表里的进度条、带裁剪的卡片不需要我手算交集。
4. As a 游戏开发者, I want 被裁掉的区域点不到, so that 滚出列表的按钮不会被误触，也不用在每个按钮里判断"我现在在不在可见区里"。
5. As a 游戏开发者, I want 一个 `Button` 节点, so that 我写 `new Button({ text: '开始' })` 并连接 `clicked` 就有一个能用的按钮，不用再从 `NineSliceSprite` 加 `Label` 加三个指针信号开始拼。
6. As a 游戏开发者, I want 按钮的按下反馈可配置（缩放到某个倍数、压暗、持续时间）并且可以关掉, so that 不同美术风格都能用同一个按钮，而不是每个游戏重写一遍反馈动画。
7. As a 游戏开发者, I want 按钮按下缩放围绕按钮中心进行, so that 按钮不会从左上角长出去，也不用我把原点挪到中间再去换算布局坐标。
8. As a 游戏开发者, I want 按钮有 `disabled` 状态, so that 条件不满足时按钮变灰且点不到，我不用分别管 `alpha` 和 `inputPickable`。
9. As a 游戏开发者, I want 全局设置一次按钮音效, so that 不用在每个按钮上传 `clickSound`。
10. As a 游戏开发者, I want 按钮在手指滑出去再抬起时不算点击、在切到后台或被弹窗盖住时自动恢复未按下的样子, so that 这些边界情况不会留下一个"卡在按下状态"的按钮。
11. As a 游戏开发者, I want 一个 `ProgressBar`，给它 0 到 1 的值就按比例填充, so that 血条、经验条、加载条不用拿两个 `ColorRect` 自己算宽度。
12. As a 游戏开发者, I want 进度条的填充用九宫格贴图也不变形, so that 圆角、高光的美术在半满时仍然好看。
13. As a 游戏开发者, I want 进度条支持从左到右、从右到左、从下到上、从上到下四个方向, so that 竖版血条、Boss 血条都能用同一个节点。
14. As a 游戏开发者, I want 一个 `ScrollContainer`，把内容节点放进去、告诉它内容多大，就能单指拖动滚动, so that 选关、商店、排行榜不再受"屏幕放得下几个"的限制。
15. As a 游戏开发者, I want 滚动有惯性和到边回弹, so that 手感和玩家习惯的原生列表一致。
16. As a 游戏开发者, I want 在滚动容器里的按钮轻点就是点击、拖动就是滚动, so that 列表里的每一行都能既可点又可滚，不用自己区分。
17. As a 游戏开发者, I want 用代码把滚动位置设到某处（可选带动画）, so that 打开选关面板时能直接定位到当前关卡。
18. As a 游戏开发者, I want 控件按 `safeRect` 的边或中心锚定, so that 屏幕尺寸或安全区变化时 HUD 的按钮、分数自动重新摆放，不用每个面板都写一遍 `resized` 的回调。
19. As a 游戏开发者, I want 不装 `ui()` 插件、不给贴图也能看到纯色的按钮和进度条, so that 灰盒阶段零美术就能把界面流程跑通。
20. As a 游戏开发者, I want 装上 `ui()` 后控件有一套中性的默认皮肤, so that 原型阶段不用先画九宫格。
21. As a 游戏开发者, I want 这些控件的关键状态出现在 `dump()` 里, so that 我（或 agent）看一眼树就知道按钮是否按着、进度条的值、列表滚到了哪里。
22. As a 游戏开发者, I want 控件和 `CanvasLayer`、相机、`processMode: 'always'`（暂停菜单）正常配合, so that 暂停中弹出的设置面板仍然可以滚动和点击。
23. As a 游戏开发者, I want `llms.txt` 里有控件的可运行示例和陷阱清单, so that agent 第一次写界面就用对。

### 玩家

24. As a 玩家, I want 按下按钮时看到它明显地响应（变大或压暗）并伴随音效, so that 我确认点到了。
25. As a 玩家, I want 在列表上手指按住一个条目然后拖动时列表跟着滚、松手后不会误触那个条目, so that 浏览长列表不会误进某一关。
26. As a 玩家, I want 滚到底时有回弹而不是硬停, so that 我知道已经到头了。
27. As a 玩家, I want 滚出列表边缘的半个按钮既看不见也点不到, so that 不会点到看不见的东西。

### 测试作者

28. As a 测试作者, I want 在无头测试里 `g.tap` 一个被裁掉的按钮并断言它没有收到 `clicked`, so that 裁剪和拾取的一致性是被测试守住的，而不是靠真机肉眼看。
29. As a 测试作者, I want 用 `g.drag` 拖动滚动容器并断言内容的偏移和子按钮没有被点击, so that 阈值、惯性、回弹的行为有确定性的回归测试。
30. As a 测试作者, I want 按钮的按下反馈在无头模式下也以状态的形式可断言（按下中、缩放倍数）, so that 不需要渲染器也能测反馈逻辑。
31. As a 测试作者, I want 渲染同步测试能断言某个节点的显示对象上有正确的裁剪区域, so that 渲染层对 `clipRect` 的实现有不依赖 WebGL 的测试。

### 插件 / 控件作者

32. As a 控件作者, I want 用公开 API（`clipRect`、`capturePointer`、`InputSource`、指针信号）就能写出滚动容器, so that 我照着 `@sapling2d/ui` 的源码能写自己的控件，不碰引擎内部。
33. As a 控件作者, I want 控件包的默认皮肤按 ADR 0011 挂载到 `~@sapling2d/ui/` 下, so that 浏览器、小游戏、测试三个平台不用分别处理资源路径。

## Implementation Decisions

### 核心：裁剪（`Node2D.clipRect`）

- `Node2D` 新增构造选项和属性 `clipRect: Rect2 | null`，默认 `null`。本地坐标，`Rect2` 不可变、赋值即替换；改动走 `_version++`，渲染层下一帧同步。
- 语义：裁掉**这个节点自己的内容和整个子树**里落在矩形外的部分（Godot `Control.clip_contents` 的语义，而不是只裁子节点）。嵌套裁剪取交集。
- 边界：裁剪只作用于"画在同一个容器里"的节点。子树里的 `CanvasLayer` 自成一层、不受祖先裁剪（和它不跟随祖先变换、可见性的现有规则一致）。
- 裁剪不参与 `Tween`（不是数字或颜色属性）。
- `dump()` 显示 `clipRect=(x, y, w, h)`（和 `Rect2.toString` 一致的格式），仅在非 null 时出现。
- 渲染层（`PixiRenderer` 的节点同步）：节点有 `clipRect` 时给它的 Pixi 容器设一个矩形 `Graphics` 作为 `mask`，`_version` 变了才重建几何；`clipRect` 变回 null 时去掉 mask 并销毁 Graphics；节点销毁时一并销毁。Pixi v8 对 `Container` 类型的 mask 走 stencil（`keep` 模式的全屏裁剪已经在用同一条路；WebGL 上下文默认带 stencil 缓冲）。Pixi v8 导出了 `ScissorMask` 但不会自动选用，**第一版不做 scissor 优化**，等真机 spike 的数据说话（见"顺序"）。
- 不做基于包围盒的子树剔除：`Node2D` 没有通用的尺寸，每帧算子树包围盒的成本在 iOS 上不划算；长列表的绘制成本先靠裁剪本身（stencil 之外的像素不会被填充）和游戏侧按需创建条目解决。记为后续可选项。

### 核心：拾取遵守裁剪

- 命中判定（拾取用的 `hitsAt`）增加一步：沿父链向上直到画布根或最近的 `CanvasLayer`，每个设了 `clipRect` 的祖先都要在它自己的本地坐标里包含该点，否则不命中。节点自己的 `clipRect` 也算（自己内容被裁掉的部分点不到）。
- `clicked` 的判定（抬起时还在节点里）也用同一条规则：抬起点落在被裁掉的区域不算点击。
- `cancelUnhittable`（帧首给变得不可命中的捕获节点发抬起）不改：节点被滚出裁剪区仍然算"可命中"，正在拖它的手指不被打断。
- 绘制顺序和拾取的交叉验证测试（现有 draw-order 测试）加裁剪用例，保证渲染层画不出来的地方拾取也点不到。
- 热路径约束：祖先链检查只在指针按下和抬起时执行，一次性的局部坐标换算可以分配；不进入每帧路径。

### 核心：指针捕获转移（`Node2D.capturePointer`）

- `Node2D` 新增 `capturePointer(pointerId: number): boolean`。前提：这根指针当前是按着的、调用方在树里且可命中（`canHit`）。不满足返回 `false`，不改任何状态。
- 成功时：
  1. 原捕获节点（如果有、且不是自己）收到一次 `pointerUp`（位置是该指针最近的位置），**不发 `clicked`**。这和隐藏、暂停、切后台时的取消完全相同，按钮类控件只需处理 `pointerUp` 一条路径就覆盖所有取消。
  2. 捕获表指向调用方；之后这根指针的 `pointerMove`、`pointerUp`、`clicked` 都按普通捕获的规则发给它。
  3. 如果这根指针之前没有被任何节点处理（按在空处、正在触发 `pointerPress()` 绑定），它从"未处理"集合里移除，对应的动作在本帧松开。
- 自己已经是捕获者时返回 `true`、无副作用。
- `Input` 的公开面**不增长**（延续插件机制规格里的约定）：`Node2D.capturePointer` 通过场景树的输入对象调用路由器的内部方法实现，路由器的内部方法以下划线前缀标记。
- 不加"祖先观察子孙的指针事件"这类冒泡机制。滚动容器要观察子节点捕获的指针，走已有的 `InputSource` 扩展点：订阅 `pointerdown` / `pointermove` / `pointerup` / `pointercancel` 原始事件（它们在节点信号之后、同一帧首按序派发，坐标是屏幕坐标，用 `viewport` 换算到设计坐标或世界坐标）。

### 包：`@sapling2d/ui`

- 新 workspace 包 `@sapling2d/ui`，形态照 `@sapling2d/touch`：只依赖 `sapling2d` 的公开 API（不需要 `sapling2d/render`）；`package.json` 声明 `"sapling2d": { "assets": "assets" }`，默认皮肤挂到 `~@sapling2d/ui/`（ADR 0011）；`peerDependencies` 要求支持 `clipRect` / `capturePointer` 的 `sapling2d` 版本。
- `ui(options?)` 插件：`ctx.provide` 一个 `UiTheme` 服务（默认皮肤句柄、全局 `pressEffect` 默认值、全局 `clickSound`），`ctx.preload` 默认皮肤。不装也能用控件：传了自己贴图的照常工作；用默认皮肤但没装插件的控件进树时警告一次（复用 touch 的做法）；不传贴图（`texture: null`）的控件退回纯色绘制，完全不需要插件。
- 所有控件原点在**左上角**，和 `ColorRect` / `NineSliceSprite` / Godot `Control` 一致。`Button` 的按下缩放不改变节点自身的 `scale`，而是缩放一个内部的视觉主体（主体的原点在控件中心），所以布局坐标和 `rect` 在按下期间保持不变。

#### `Control extends Node2D`

- `size: Vector2`、`rect: Rect2`（本地坐标，左上角原点）；`hitTest` 默认用 `rect`（设了 `hitArea` 时用 `hitArea`，和 `ColorRect` 相同）；`inputPickable` 默认 `false`，由子类或游戏打开。
- 可以直接实例化：一个不画东西、带尺寸的布局盒子（放 HUD 的一组按钮、弹窗面板的内容区）。
- `anchor?: { left?; right?; top?; bottom?; centerX?; centerY? }`：数值是到 `safeRect` 对应边 / 中心的距离（设计像素）。进树时和 `viewport.resized` 时按 `size` 重算 `position`；同时给了左右（或上下）时拉伸 `size`。只对 `CanvasLayer` 里的控件有意义（设计坐标）；场景里的控件设了 `anchor` 警告一次。`anchorTo: 'safe' | 'visible'` 选基准矩形，默认 `safe`。
- `dump` 显示 `size`；`anchor` 非空时显示。

#### `Button extends Control`

- 选项：`text`、`fontSize` / `color` / `stroke` / `fontWeight`（透传给内部 `label: Label`，对外可访问）、`texture`（九宫格底图，默认皮肤；`null` 为纯色）、`margins`、`texturePressed`、`backgroundColor`（纯色模式）、`pressEffect`、`clickSound`、`disabled`。
- `pressEffect: { scale?: number; tint?: number; duration?: number } | false`。未指定时取 `UiTheme` 的全局默认，全局默认是 `{ scale: 1.1, duration: 0.08 }`（讨论中给的数字；`tint` 默认不启用）。实现用 `createTween`；按下 / 松开之间先 `kill` 上一个补间；无头模式下主体的 `scale` 同样变化，测试可断言。
- 状态与信号：`isPressed`、`pressed`（按下）、`released`（任何方式松开）、`clicked`（继承：抬起时还在按钮内且没被裁掉）。`disabled = true`：`alpha` 变 0.5（可配置）、`inputPickable = false`，正按着时视为取消。
- 手指路径：按下 → 视觉按下；移动到按钮外 → 视觉松开（不发 `released`，仍持有捕获）；移回 → 视觉再按下；抬起在内 → `clicked`；抬起在外、被取消（隐藏 / 暂停 / 切后台 / 被 `capturePointer` 抢走）→ 只松开。只连接 `pointerDown` / `pointerMove` / `pointerUp` 三个信号。
- `clickSound`：`clicked` 时 `tree.audio.play(stream, { bus: 'SFX' })`；控件自己的选项优先于 `UiTheme` 的全局值；`null` 显式关闭。
- `dump` 显示 `pressed`（按着时）、`disabled`（为真时）。

#### `ProgressBar extends Control`

- `value`（默认 0..1；`minValue` / `maxValue` 可改范围）、`ratio`（0..1，只读）、`fillMode: 'leftToRight' | 'rightToLeft' | 'bottomToTop' | 'topToBottom'`、`background` / `fill` 各自是九宫格贴图或纯色（`textureBackground` / `textureFill` / `backgroundColor` / `fillColor`、`margins`）、`fillPadding`（填充相对底图内缩）。
- 填充**不缩放、不改尺寸**：填充节点始终铺满整个条，用它的 `clipRect` 按 `ratio` 裁掉未填充的部分。这样九宫格填充不变形，也是 `clipRect` 的第一个内部消费者。
- 信号 `valueChanged(value)`；值被夹在范围内；`dump` 显示 `value`。

#### `ScrollContainer extends Control`

- 结构：容器本身 `inputPickable = true`、`clipRect = rect`；`content: Node2D` 是它唯一的直接可见子节点，游戏把条目加到 `content` 下。`contentSize: Vector2` 由游戏给（节点没有通用包围盒）；`scrollOffset: Vector2`（内容向上 / 向左移动的量，夹在 0 到 `contentSize - size` 之间，回弹期间可以短暂越界）；`scrollX` / `scrollY` 便捷读写；`scrollTo(offset, { animate?: boolean })`；`horizontal` / `vertical` 开关（默认只开竖向）；`dragThreshold`（设计像素，默认 12）；`inertia: boolean`（默认开）、`deceleration`（每秒速度衰减比例）、`bounce: boolean`（默认开）。
- 手势：
  1. 按在空白处 → 容器自己捕获（它是可点击的，画在子节点下面，所以子节点优先）。按在子节点上 → 子节点捕获，容器通过 `InputSource` 看到原始事件并记下起点。
  2. 移动超过 `dragThreshold`（只看开启的轴）→ `capturePointer(id)`：子节点收到抬起不发 `clicked`，容器接管；之后按手指位移滚动。
  3. 抬起 → 按最近几帧的速度开始惯性，越界时回弹到边界；`inertia` 关时直接停在夹紧后的位置。
  4. 只认一根指针；第二根手指在滚动期间按下时忽略。
  5. 切后台、容器隐藏 / 暂停 / 被裁 → 走现有的取消路径，拖动结束、速度清零。
- 时间：惯性和回弹在 `process(dt)` 里推进，使用的 `dt` 已含 `timeScale`；暂停菜单里的列表需要 `processMode: 'always'`（文档里写明）。
- 信号 `scrolled(offset)`；`dump` 显示 `scrollOffset`（非零时）、`contentSize`。
- 不画滚动条、不处理鼠标滚轮（平台只产指针事件）。

### 默认皮肤

- `assets/` 里放中性的九宫格：按钮底图、按钮按下态、面板 / 进度条底图、进度条填充。灰白为主、可被 `modulate` 染色，尺寸小（每张 ≤ 64×64）。
- 皮肤句柄以 `UI_SKIN` 导出，游戏可以在自己的 `static assets` 里引用。

### 文档与发布

- `CONTEXT.md` 词汇表加：`clipRect`、指针捕获转移、`Control`、`Button`、`ProgressBar`、`ScrollContainer`、`UiTheme`；"Entry points" 一条加 `@sapling2d/ui`。
- 新 ADR：裁剪是 `Node2D` 属性而非节点、裁剪与拾取共用一套规则、捕获可转移且取消统一表现为不带 `clicked` 的抬起、控件放独立包的判据。
- `llms.template.md` 新节"界面控件（`@sapling2d/ui`）"，示例从 `@sapling2d/ui` 包内 `docs/examples` 引用（和 touch 一样）；节点清单表、dump 属性表、常见陷阱（处于暂停菜单里要 `processMode: 'always'`；`contentSize` 要自己给；按钮按下期间 `rect` 不变）各加条目。`templates/game` 的 agent 指南提到 ui 包。
- 版本：`sapling2d` 升 minor（新增 `Node2D` API），`@sapling2d/ui` 0.1.0。两者用 `pnpm publish`。

### 顺序

1. **真机 spike**（`spikes/clip/`，写 REPORT）：iOS 微信 WebGL1 上两层嵌套 stencil mask + 旋转的容器，截图核对裁剪正确、读 `FrameStats` 看 10 个带裁剪的容器各含 20 个精灵时的帧时间。结论决定是否需要 scissor 路径。
2. 核心：`clipRect` 渲染 + 拾取 + dump + 测试。
3. 核心：`capturePointer` + 测试。
4. 包：`Control` / `Button` / `ProgressBar`（只用 1 和 2）。
5. 包：`ScrollContainer`（用到 3）。
6. 文档、示例、ADR、CONTEXT、版本。

## Testing Decisions

好的测试只看外部行为：节点收到了哪些信号、`dump()` 里的状态、渲染同步后显示对象上的裁剪区域；不测 Pixi 内部的 stencil 细节，不测路由器的私有表。

### 测试缝

- **无头游戏（主缝）**：`createTestGame` + `g.tap` / `g.drag` / `g.pointerDown` / `g.pointerMove` / `g.pointerUp` / `g.setScreen` / `g.setFocus` / `g.dump()`。裁剪影响拾取、捕获转移、按钮的全部手指路径、进度条、滚动容器的阈值 / 惯性 / 回弹、锚点重排，全部在这一层测。先例：engine 的 input、canvas-layer、pause 测试，`@sapling2d/touch` 的两组控件测试（含插件安装、默认皮肤警告、多指）。
- **渲染同步缝**：`PixiRenderer._createForSyncTests()` + `sync(tree)`，断言节点容器的 `mask` 存在与否、矩形几何随 `clipRect` 更新、置 null 后移除、`CanvasLayer` 子树不受祖先裁剪。先例：engine 的 render、color-rect、canvas-layer 测试。
- **绘制顺序 × 拾取交叉验证**：现有 draw-order 测试加裁剪用例，同一棵树在渲染同步里被裁掉的节点在拾取里也点不到。
- **文档缝**：`@sapling2d/ui` 包内 `docs/examples/*.test.ts` 作为可运行示例被 `llms.template.md` 引用，`llms.test.ts` 保证文档不过期。
- **真机 spike** 是手动验证，不进自动测试；结论写进 REPORT。

不新增测试缝。

### 要覆盖的行为（节选）

- `clipRect` 外的 `inputPickable` 子节点：`g.tap` 不发 `clicked`，`pointerPress()` 动作也不触发（容器自己可点击时由容器接住）。
- 嵌套裁剪：内层节点只有同时在两个矩形内才能点到。
- `CanvasLayer` 子树不受祖先 `clipRect` 影响（拾取和渲染同步各测一次）。
- `capturePointer`：原节点收到 `pointerUp` 且无 `clicked`；新节点之后收到 `pointerMove` / `pointerUp`；未处理的指针被接管后 `pointerPress()` 动作松开；指针不存在 / 节点不可命中时返回 `false` 且无副作用。
- `Button`：按下 → 主体缩放到 `pressEffect.scale`；滑出 → 恢复；滑回 → 再按下；抬起在内 → `clicked` 一次并播放 `clickSound`（`g.audio.log`）；抬起在外 / 切后台 / 隐藏 / `disabled` 途中 → 无 `clicked`、主体恢复、`released` 一次；`pressEffect: false` 时主体不动。
- `ProgressBar`：`value` 夹紧；四个 `fillMode` 下填充节点的 `clipRect` 正确；`valueChanged` 只在值真的变化时发。
- `ScrollContainer`：阈值内的 `g.tap` 子按钮 → 子按钮 `clicked`、未滚动；`g.drag` 超过阈值 → 子按钮无 `clicked`、`scrollOffset` 随位移变化；松手后惯性衰减到停止；越界回弹到边界；只开竖向时横向位移不滚动；`horizontal` / `vertical` 组合；`scrollTo` 立即和动画两种；切后台中断拖动；`processMode: 'always'` 下暂停时仍可滚动；确定性（同样输入两次运行得到同样的 `scrollOffset`）。
- `Control.anchor`：`g.setScreen` 换屏后位置按 `safeRect` 重算；左右同时给时拉伸。
- 默认皮肤未装插件时的警告（一次）；`texture: null` 的纯色模式不需要插件。
- `dump()` 片段：`clipRect=…`、`pressed`、`value=…`、`scrollOffset=…`。
- 类型检查（`pnpm check`）是完成条件的一部分：Vitest 不做类型检查。

## Out of Scope

- 圆形 / 贴图（alpha）遮罩、RenderTexture、截图：需要另一套渲染设施，另开规格。
- 渲染层基于包围盒的子树剔除；scissor 优化路径（除非 spike 表明 stencil 在真机上不可接受）。
- 滚动条、鼠标滚轮、多指缩放、嵌套滚动容器之间的手势仲裁。
- `Dialog` / `Overlay` / `Toast` / `Toggle` / `Slider` / `EditBox`（文本输入）/ `RichText` / `BitmapFont`：下一批控件，等 `Button` / `ScrollContainer` 在真实游戏里用过再定。
- 键盘 / 手柄的焦点导航。
- `@sapling2d/touch` 改用 ui 的按下反馈（可以之后做，不在此规格）。
- `@sapling2d/wechat`（分享、震动、登录、开放数据域）：独立规格，排在 ui 之后。
- 把 hero-guard 迁移到 `@sapling2d/ui`：由游戏仓库自己决定；本规格只要求 hero-guard 里的 `Button` / `Overlay` 用例能被新控件覆盖。

## Further Notes

- 判据重申（供后续控件复用）：需要渲染层或路由器私有能力 → 核心原语；公开 API 写得出来、可能带皮肤 → `@sapling2d/ui`。写不出来时补原语，不搬控件进核心。
- iOS 无 JIT 的约束照旧：`ScrollContainer` 的 `InputSource.handle` 和 `process` 里不分配（用数字字段记起点和速度，不建 `Vector2`）；按钮的补间只在按下 / 松开时创建。
- Pixi v8 中 `Container` 作为 mask 走 stencil，嵌套由 stencil 计数实现，理论上支持任意层，但 iOS 微信 WebGL1 的实际表现以 spike 为准；spike 同时记录 `keep` 模式的全屏 mask 和 `clipRect` 叠加时是否正常。
- `capturePointer` 之所以把取消表现为"不带 `clicked` 的抬起"而不是新信号，是为了让所有控件只处理一条松开路径（和现有的隐藏 / 暂停 / 切后台取消保持一致）。如果以后有控件确实需要区分"抬起"和"取消"，再在 `PointerEvent2D` 上加字段，不加信号。
- 滚动容器的 `contentSize` 需要游戏提供，是刻意的：引擎没有通用包围盒，自动测量会把 `Label` 的文字测量等渲染期信息拉进逻辑层。列表条目等高时游戏一行代码就能算出来。
