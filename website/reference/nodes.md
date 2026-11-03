# 节点清单

引擎和官方插件提供的节点、资源和工具类。

| 节点 | 用途 | 关键成员 |
|---|---|---|
| `Node` | 基类 | `add` `remove` `queueFree` `callDeferred` `addToGroup` `createTween` `processMode` `tree` |
| `Node2D` | 带变换 | `position` `x` `y` `rotation` `scale` `visible` `zIndex` `alpha` `modulate` `selfModulate` `blendMode` `clipRect` `globalPosition` `toLocal` `toGlobal`；`inputPickable` `hitArea` + 信号 `pointerDown` `pointerMove` `pointerUp` `clicked` |
| `Scene` | 场景根 | `static assets` |
| `Sprite2D` | 贴图 | `texture` `centered`（默认 true：以贴图的锚点或中心为原点）`offset` `flipH` `flipV` `flash` `flashColor` |
| `AnimatedSprite2D` | 帧动画（继承 Sprite2D） | `frames` / `animations` `fps` `loop` `autoplay` `processInPhysics` `play()` `pause()` `stop()` `frame` `speedScale` `isPlaying` `animation`；信号 `frameChanged` `animationFinished` |
| `Label` | 文字 | `text` `fontSize` `color` `fontWeight` `align` `verticalAlign` `stroke` `wrapWidth` `lineHeight` |
| `ColorRect` | 纯色矩形（原点在左上角） | `size` `color` `rect` |
| `NineSliceSprite` | 九宫格（界面边框，原点在左上角） | `texture` `margins` `size` `rect` |
| `Particles2D` | 粒子发射器（粒子不是节点） | `texture` `amount` `lifetime` `lifetimeRandomness` `emitting` `oneShot` `rate` `direction` `spread` `speedMin` `speedMax` `gravity` `damping` `scaleStart` `scaleEnd` `alphaStart` `alphaEnd` `localCoords` `emit()` `restart()` `aliveCount`；信号 `finished` |
| `RigidBody2D` | 动态刚体 | `mass` `friction` `bounce` `gravityScale` `linearVelocity` `angularVelocity` `lockRotation` `ccd` `applyCentralImpulse` `applyForce` `sleeping`；信号 `bodyEntered` `bodyExited` |
| `StaticBody2D` | 静态刚体（地面、墙） | `friction` `bounce` |
| `Area2D` | 检测区域 | 信号 `bodyEntered` `bodyExited`；`getOverlappingBodies()` |
| `CollisionShape2D` | 碰撞形状（必须是刚体 / 区域的直接子节点） | `shape`：`circle(r)` `rectangle(w, h)` `polygon(points)`；`disabled` |
| `TileMapLayer` | 一层图块地图 | `tileSet` `width` `height` `collisionLayer` `setCell` `eraseCell` `getCell` `getCellTileData` `localToMap` `mapToLocal` `getUsedRect` `usedCellCount` |
| `CharacterBody2D` | 平台游戏的角色（只和图块地图碰撞） | `shape` `velocity` `velocityX` `velocityY` `setVelocity` `moveAndSlide()` `isOnFloor` `isOnWall` `isOnCeiling` `slideCollisionCount` `getSlideCollision(i)` `collisionMask` |
| `Camera2D` | 相机（画面跟随） | `enabled` `offset` `limitLeft` `limitTop` `limitRight` `limitBottom` `positionSmoothingEnabled` `positionSmoothingSpeed` `makeCurrent()` `isCurrent` `resetSmoothing()` `screenCenter` |
| `CanvasLayer`（不是 Node2D） | 界面层（不跟随相机） | `layer` `visible` |
| `Timer` | 计时器 | `waitTime` `oneShot` `autostart` `processInPhysics` `start()` `stop()` `timeLeft`；信号 `timeout` |
| `AudioStreamPlayer` | 播放声音 | `stream` `volume` `loop` `bus` `autoplay` `play()` `stop()`；信号 `finished` |

## 插件提供的节点

| 节点 | 用途 | 关键成员 |
|---|---|---|
| `TouchScreenButton`（`@sapling2d/touch`） | 屏幕按钮（继承 Sprite2D） | `action` `texturePressed` `isPressed` `hitArea`；信号 `pressed` `released` |
| `TouchJoystick`（`@sapling2d/touch`） | 摇杆（继承 Node2D） | `mode`（`dynamic` / `fixed`）`actions` `radius` `deadzone` `region` `texture` `textureKnob` `vectorX` `vectorY` `vector` `isPressed`；信号 `pressed` `released` |
| `Control`（`@sapling2d/ui`） | 界面控件基类 / 布局盒子（原点在左上角） | `size` `rect` `anchor` `anchorTo` |
| `Button`（`@sapling2d/ui`） | 按钮（继承 Control） | `text` `label` `body` `background` `isPressed` `disabled` `disabledAlpha` `pressEffect` `clickSound`；信号 `pressed` `released` `clicked` |
| `ProgressBar`（`@sapling2d/ui`） | 进度条（继承 Control） | `value` `minValue` `maxValue` `ratio` `fillMode` `fillColor` `fillPadding` `background` `fill`；信号 `valueChanged` |
| `SpineSprite`（`@sapling2d/spine`） | Spine 骨骼动画（继承 Node2D） | `skeleton` `play()` `queue()` `stop()` `animation` `isPlaying` `speedScale` `defaultMix` `mix()` `skin` `setAttachment()` `setupPose()` `refreshPose()` `flipH` `flipV` `physics` `bonePosition()` `boneRotation()` `rect` `state` `spine`；信号 `animationStarted` `animationFinished` `animationEvent` |
| `SpineBoneNode`（`@sapling2d/spine`） | 跟随一根骨骼（`SpineSprite` 的直接子节点） | `bone` |

## 资源和工具类（不是节点）

| 类 | 用途 | 关键成员 |
|---|---|---|
| `TiledMap` | Tiled 关卡 | `tiledMap(path)`；`tileLayers` `tileLayer(name)` `layerNames` `objects(layer?)` `objectLayers` `width` `height` `tileSize` `pixelWidth` `pixelHeight` `tileSets` `properties`；建节点用 `TileMapLayer.fromTiled(map, name?)` |
| `SpineSkeleton`（`@sapling2d/spine`） | Spine 骨架 | `spineSkeleton(path, { atlas?, scale? })`；`data` `pages` `rect` `animationNames` `skinNames` `boneNames` `slotNames` `eventNames` |
| `Curve2D` | 曲线路径，按距离取点 | `Curve2D.catmullRom(points, { closed?, bakeInterval? })` `Curve2D.polyline(points)`；`length` `sample(distance, out)` `angleAt(distance)` `closed` |
| `HitTester` | 两组对象之间的圆 / 矩形命中判定 | `forEachHit(as, bs, hit)`（`hit` 返回 true 表示 a 用掉了）、`HitTester.compact(list)`；对象需要 `x` `y` `hitShape`，可选 `dead` |

## 碰撞层

`collisionLayer` / `collisionMask` 共 32 层，用 `setCollisionLayerValue(n, bool)` 开关单独一层。规则同 Godot：任一方的 mask 包含对方的 layer，两者就碰撞。

## `dump()` 显示的属性

`g.dump()` / `tree.dump()` 每行是 `名字 (类名) 属性=值`，只列出不等于默认值的属性（标"总是显示"的除外）。值的格式：向量 `position=(220, 200)`、布尔 `visible=false`、数字 `zIndex=3`、含空格的字符串加引号 `text="连击 ×2"`、数组 `groups=[coins]`。

| 节点 | 属性 |
|---|---|
| 所有节点 | `groups`、`processMode` |
| `Node2D` 及子类 | `position`（总是显示）、`rotationDegrees`、`scale`、`visible`、`zIndex`、`alpha`、`modulate` / `selfModulate`（`#ff6666` 形式）、`blendMode`、`clipRect`（`(x, y, w, h)`） |
| `Sprite2D` | `texture`（路径；图集的帧是 `sprites.png#enemy_red` / `explosion.png#3`）、`centered`、`offset`、`flipH`、`flipV`、`flash`、`flashColor` |
| `AnimatedSprite2D` | 同 Sprite2D，加 `animation`（有多套时）、`frame`（总是显示）、`playing` |
| `SpineSprite` | `skeleton`（路径，总是显示）、`animation`、`playing`、`skin`、`speedScale`、`flipH`、`flipV`；`SpineBoneNode` 显示 `bone` |
| `Label` | `text`（总是显示）、`fontSize`、`align` |
| `ColorRect` | `size`、`color`（总是显示） |
| `Particles2D` | `texture`、`emitting`、`particles`（存活数，总是显示） |
| `RigidBody2D` | `mass`、`friction`、`bounce`、`linearVelocity`（运动时）、`sleeping`、`collisionLayer`、`collisionMask` |
| `StaticBody2D` / `Area2D` | `friction`、`bounce`（静态刚体）、`collisionLayer`、`collisionMask` |
| `CollisionShape2D` | `shape`（如 `circle(30)`）、`disabled` |
| `Timer` | `waitTime`、`oneShot`、`timeLeft`、`stopped` |
| `AudioStreamPlayer` | `stream`、`playing`、`loop`、`volume` |
| `Control` / `Button` / `ProgressBar`（`@sapling2d/ui`） | `size`（总是显示）、`anchor`（`right:20,top:30` 形式）；按钮按着时 `pressed`、禁用时 `disabled`；进度条 `value`（总是显示）、非默认的 `fillMode` |

自己的节点可以覆写 `dumpProps()` 加入关键状态，见 [无头测试](/guide/testing)。
