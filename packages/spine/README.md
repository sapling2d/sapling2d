# @sapling2d/spine

[Spine](https://esotericsoftware.com/) skeletal animation for [sapling2d](https://github.com/sapling2d/sapling2d): a `spineSkeleton()` resource, a `SpineSprite` node, a `SpineBoneNode` that follows a bone, and a `spine()` plugin. Built on the official `@esotericsoftware/spine-core` **4.3** runtime; rendering is the engine's own PixiJS mesh sync, so it runs in the browser, as a WeChat Mini Game and in headless tests.

```sh
npm install @sapling2d/spine
```

```ts
import { Scene, v } from 'sapling2d'
import { startGame } from 'sapling2d/browser'
import { spine, spineSkeleton, SpineBoneNode, SpineSprite } from '@sapling2d/spine'

class Arena extends Scene {
  static assets = { hero: spineSkeleton('hero/hero.json') } // public/assets/hero/hero.json + hero.atlas + hero.png

  override ready() {
    const hero = this.add(new SpineSprite({ skeleton: Arena.assets.hero, animation: 'idle', defaultMix: 0.2, position: v(375, 1100) }))
    hero.play('run')                                // track 0, looping
    hero.play('shoot', { track: 1, loop: false })   // layered on top
    hero.queue('idle')                              // after the current animation on track 0
    hero.animationEvent.connect((name) => { if (name === 'footstep') this.tree.audio.play(STEP) }, this)
    hero.skin = 'red'                               // skins, attachments, flipH, speedScale, bonePosition(), ...
    hero.add(new SpineBoneNode({ bone: 'hand' }))   // children follow the bone every frame
    hero.state.setMix('run', 'idle', 0.3)           // spine-core objects for everything else: hero.state, hero.spine
  }
}

await startGame({ main: Arena, plugins: [spine()] })
```

- **Export from Spine 4.3** as JSON (`.skel` is not supported yet). The runtime version must match the editor's major.minor; other versions fail at load time with a clear message.
- Atlases exported with or without premultiplied alpha both work (`pma: true` is read from the atlas).
- Headless tests (`createTestGame` from `sapling2d/testing`) load the real skeleton and atlas files, so bone positions, events and animation timing are testable in Node.
- Not supported: two-color tinting (tint black; the dark color is ignored with a warning), `.skel` binaries, driving bones from nodes.

The engine's [`llms.txt`](https://github.com/sapling2d/sapling2d/blob/main/packages/engine/llms.txt) has the full API with runnable examples ("Spine 骨骼动画").

## License

This package is MIT. It depends on the Spine Runtimes (`@esotericsoftware/spine-core`), which are covered by the [Spine Runtimes License Agreement](https://esotericsoftware.com/spine-runtimes-license): **every developer using this package must have their own [Spine Editor license](https://esotericsoftware.com/spine-purchase)**, and products that ship the runtimes must include that license agreement in their documentation or materials. Players of your game do not need a license. The example assets (spineboy) belong to Esoteric Software and are used under the same terms for evaluation.
