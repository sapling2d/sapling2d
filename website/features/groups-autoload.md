# Groups 与 Autoload

sapling2d 不支持按路径查找节点。父节点引用自己的子节点用字段；跨层级找一类节点用 **Groups**；跨场景存在的全局单例用 **Autoload**。

<<< ../../packages/engine/docs/examples/groups-autoload.test.ts#example

## Groups

- 节点通过构造参数 `groups: ['coins']` 或 `addToGroup` 加入组，`this.tree.getNodesInGroup('coins')` 取出组里的所有节点。
- 用声明合并给组名登记类型：`declare module 'sapling2d' { interface GroupRegistry { coins: Coin } }`。之后组名有补全，写错是类型错误，`getNodesInGroup` 直接返回 `Coin[]`。

## Autoload

- Autoload 是跨场景存在的节点，适合放分数、金币、设置这类全局状态。
- 在启动参数里注册：`startGame({ main: Level, autoloads: [GameState] })`。
- 按类型取出：`this.tree.autoload(GameState)`，返回值带类型。
