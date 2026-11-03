/** 文档站里可以玩的示例：examples/<name>，由 scripts/build-demos.ts 构建到 public/demos/<name>/ */
export interface DemoInfo {
  name: string
  title: string
  description: string
  /** 操作说明 */
  controls: string
  /** 演示了哪些功能（链接到功能页） */
  features: { text: string; link: string }[]
  landscape?: boolean
}

export const demos: DemoInfo[] = [
  {
    name: 'merge',
    title: '合成大西瓜',
    description: '两个相同的水果相撞合成更大的水果。物理玩法的完整小游戏，带无头测试。',
    controls: '点击屏幕选位置并丢下水果',
    features: [
      { text: '物理与碰撞', link: '/features/physics' },
      { text: '无头测试', link: '/guide/testing' },
    ],
  },
  {
    name: 'plane',
    title: '飞机大战',
    description: '竖版射击：图集、帧动画、粒子，用 HitTester 做大量子弹的命中判定，支持暂停。',
    controls: '方向键 / WASD 移动，点击或空格开始',
    features: [
      { text: '帧动画与图集', link: '/features/animation' },
      { text: '粒子', link: '/features/particles' },
      { text: '命中判定', link: '/features/hit-tester' },
    ],
  },
  {
    name: 'spinblade',
    title: '转刀',
    description: '俯视角动作：摇杆、打击停顿、屏幕震动、粒子、血条和 Boss。',
    controls: '方向键 / WASD 移动，手机上用摇杆',
    features: [
      { text: '屏幕按钮与摇杆', link: '/features/touch' },
      { text: '暂停与时间缩放', link: '/features/pause-time' },
    ],
  },
  {
    name: 'towerdefense',
    title: '塔防',
    description: '竖版塔防灰盒：随机曲线路径、带出手帧的攻击动画、对象池、三选一升级卡片。',
    controls: '点击屏幕操作',
    features: [
      { text: '曲线路径', link: '/features/curve' },
      { text: '界面控件', link: '/features/ui' },
    ],
  },
  {
    name: 'racer',
    title: '倾斜赛车',
    description: '用倾斜手机转向：motion 插件的 tilt() 和键盘共用同一个动作。',
    controls: '左右方向键 / AD 转向；手机上倾斜',
    features: [{ text: '倾斜', link: '/features/motion' }],
  },
  {
    name: 'spine',
    title: 'Spine 骨骼动画',
    description: 'Spine 4.3 的 spineboy：动画切换、骨骼挂点。',
    controls: '方向键 / AD 移动，空格射击',
    features: [{ text: 'Spine 骨骼动画', link: '/features/spine' }],
  },
  {
    name: 'physics',
    title: '物理沙盒',
    description: '点击丢下物体，看刚体堆叠和碰撞。',
    controls: '点击丢下物体，C 清空，M 静音',
    features: [{ text: '物理与碰撞', link: '/features/physics' }],
  },
  {
    name: 'sprite',
    title: '精灵',
    description: '大量精灵同屏移动。',
    controls: '点击生成，空格反向',
    features: [{ text: '贴图与文字', link: '/features/sprite-label' }],
  },
]
