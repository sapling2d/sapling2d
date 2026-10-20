# sapling2d-touch

Touch controls for [sapling2d](https://github.com/kwoktung/sapling2d): `TouchScreenButton` and `TouchJoystick`, with default skins, installed as a plugin.

```sh
npm install sapling2d-touch
```

```ts
import { key } from 'sapling2d'
import { startGame } from 'sapling2d/browser'
import { touch, TouchJoystick, TouchScreenButton } from 'sapling2d-touch'

class Hud extends CanvasLayer {
  override ready() {
    this.add(new TouchJoystick({ actions: { left: 'left', right: 'right', up: 'up', down: 'down' } })) // default skin
    this.add(new TouchScreenButton({ action: 'jump', position: v(640, 1200) }))
  }
}

await startGame({
  main: Game,
  plugins: [touch()], // preloads the default skins
  actions: { left: [key('KeyA')], right: [key('KeyD')], up: [key('KeyW')], down: [key('KeyS')], jump: [key('Space')] },
})
```

- Both controls drive the same input actions as the keyboard, so the game only reads `this.tree.input.getVector(...)` / `isActionJustPressed(...)`.
- Pass your own `texture` / `textureKnob` to reskin, or `null` for an input-only control.
- The skins live in this package's `assets/` and are referenced as `~sapling2d-touch/...`; the `sapling2d/vite` plugin mounts them for the browser and the WeChat Mini Game build. No configuration needed.
- Headless tests work with `createTestGame({ ..., plugins: [touch()] })` from `sapling2d/testing`.

The engine's [`llms.txt`](https://github.com/kwoktung/sapling2d/blob/main/packages/engine/llms.txt) documents both controls with runnable examples. Built only on sapling2d's public API (`inputPickable`, `hitTest`, pointer signals, `InputSource`): a template for your own controls.
