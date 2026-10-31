// 游戏本体：与平台无关。浏览器入口是 main.ts，微信小游戏入口是 main.wechat.ts
import { CanvasLayer, ColorRect, key, Label, pointerPress, Scene, v } from 'sapling2d'
import { spine, spineSkeleton, SpineBoneNode, SpineSprite } from '@sapling2d/spine'
import { touch, TouchScreenButton } from '@sapling2d/touch'

declare module 'sapling2d' {
  interface ActionRegistry {
    left: true
    right: true
    shoot: true
    jump: true
  }
}

// 官方示例角色 spineboy（Spine 4.3 导出）：骨架 JSON + 图集 + 页图都在 public/assets/spineboy/。
// 图集文件名和骨架不同名，所以要指定 atlas；同名时（hero.json + hero.atlas）不用写
export const SPINEBOY = spineSkeleton('spineboy/spineboy-pro.json', { atlas: 'spineboy/spineboy.atlas' })

const WALK_SPEED = 180
const SHOOT_TRACK = 1

export class Main extends Scene {
  static override assets = { boy: SPINEBOY }
  boy!: SpineSprite
  flash!: ColorRect
  footsteps = 0
  private counter!: Label
  private walking = false

  override ready() {
    // 原点在脚底（Spine 的 root 骨骼）；defaultMix 让动作切换时过渡 0.2 秒
    this.boy = this.add(new SpineSprite({ name: 'Spineboy', skeleton: SPINEBOY, animation: 'idle', defaultMix: 0.2, position: v(375, 1150) }))
    // 枪口：跟随 gun-tip 骨骼的节点，下面挂一条黄色的闪光，开枪时亮一下
    const tip = this.boy.add(new SpineBoneNode({ bone: 'gun-tip', name: 'GunTip' }))
    this.flash = tip.add(new ColorRect({ name: 'MuzzleFlash', size: v(70, 14), position: v(0, -7), color: 0xffdd55, visible: false }))
    // Spine 的用户事件：walk / run / jump 的时间轴上打了 footstep
    this.boy.animationEvent.connect((name) => {
      if (name === 'footstep') this.counter.text = `footstep ×${++this.footsteps}`
    }, this)
    // 开枪在轨道 1 叠在走路 / 站立上面：播完混回（清掉轨道 1）
    this.boy.animationFinished.connect((name, track) => {
      if (track === SHOOT_TRACK && name === 'shoot') this.boy.stop(SHOOT_TRACK, 0.15)
    }, this)

    const hud = this.add(new CanvasLayer({ name: 'HUD' }))
    this.counter = hud.add(new Label({ name: 'Footsteps', text: 'footstep ×0', fontSize: 36, position: v(375, 150), align: 'center' }))
    hud.add(new Label({ text: '点空白处：跳 · 按住 ◀ ▶ / A D：走 · ● / 空格：开枪', fontSize: 24, position: v(375, 210), align: 'center', color: 0xaaaaaa }))
    // 屏幕按钮（@sapling2d/touch 的默认皮肤）和键盘共用动作名
    hud.add(new TouchScreenButton({ action: 'left', position: v(110, 1230) }))
    hud.add(new TouchScreenButton({ action: 'right', position: v(270, 1230) }))
    hud.add(new TouchScreenButton({ action: 'shoot', position: v(640, 1230) }))
  }

  override process(dt: number) {
    const input = this.tree.input
    const dir = (input.isActionPressed('right') ? 1 : 0) - (input.isActionPressed('left') ? 1 : 0)
    if (dir !== 0) {
      this.boy.flipH = dir < 0
      this.boy.x = Math.min(640, Math.max(110, this.boy.x + dir * WALK_SPEED * dt))
      if (!this.walking) {
        this.walking = true
        this.boy.play('walk')
      }
    } else if (this.walking) {
      this.walking = false
      this.boy.play('idle')
    }
    if (input.isActionJustPressed('jump') && !this.walking && this.boy.animation !== 'jump') {
      this.boy.play('jump', { loop: false })
      this.boy.queue('idle') // 跳完接回 idle
    }
    if (input.isActionJustPressed('shoot')) this.shoot()
  }

  /** 压力测试（小游戏真机）：再加 n 个跑步 / 走路的 spineboy，主角照常。 */
  addBenchBoys(n: number) {
    for (let i = 0; i < n; i++) {
      const boy = this.add(
        new SpineSprite({
          name: `Bench${i}`,
          skeleton: SPINEBOY,
          animation: i % 2 ? 'run' : 'walk',
          position: v(90 + (i % 5) * 145, 520 + Math.floor(i / 5) * 300),
          scale: v(0.45, 0.45),
          flipH: i % 3 === 0,
          speedScale: 0.8 + 0.05 * i,
        }),
      )
      boy.zIndex = -1 // 主角在前面
    }
  }

  shoot() {
    this.boy.play('shoot', { track: SHOOT_TRACK, loop: false })
    this.flash.visible = true
    this.tree.createTimer(0.12).timeout.connect(() => (this.flash.visible = false))
  }
}

export const gameOptions = {
  main: Main,
  plugins: [spine(), touch()],
  // 点在按钮上的手指不触发 pointerPress()：空白处才算跳
  actions: {
    left: [key('KeyA'), key('ArrowLeft')],
    right: [key('KeyD'), key('ArrowRight')],
    shoot: [key('Space'), key('KeyS')],
    jump: [pointerPress()],
  },
}
