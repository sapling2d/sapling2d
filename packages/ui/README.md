# @sapling2d/ui

UI controls for [sapling2d](https://github.com/kwoktung/sapling2d): `Control` (size + anchors), `Button` (press feedback, disabled state, click sound) and `ProgressBar`, with a neutral default skin installed as a plugin.

```sh
npm install @sapling2d/ui
```

```ts
import { CanvasLayer, Scene, sfx, v } from 'sapling2d'
import { startGame } from 'sapling2d/browser'
import { Button, ui } from '@sapling2d/ui'

class Menu extends Scene {
  override ready() {
    const hud = this.add(new CanvasLayer())
    const start = hud.add(new Button({ text: 'Start', size: v(360, 110), anchor: { centerX: 0, bottom: 200 } }))
    start.clicked.connect(() => this.tree.changeScene(Battle))
  }
}

await startGame({ main: Menu, plugins: [ui({ clickSound: sfx('click.mp3') })] })
```

- Controls have their origin at the top-left (like `ColorRect`); `anchor` places them relative to the safe area and re-applies on screen changes.
- `Button`: nine-slice background (default skin, your own texture, or `texture: null` for a flat color), centered label, press feedback on an inner body (scale about the center; `pressEffect: { scale, tint, duration } | false`), `disabled`, `clickSound`. Signals: `pressed`, `released`, `clicked`.
- The skin lives in this package's `assets/` and is referenced as `~@sapling2d/ui/...`; the `sapling2d/vite` plugin mounts it for the browser and the WeChat Mini Game build. No configuration needed.
- Headless tests work with `createTestGame({ ..., plugins: [ui()] })` from `sapling2d/testing`; the press feedback is observable as `button.body.scale`.

The engine's [`llms.txt`](https://github.com/kwoktung/sapling2d/blob/main/packages/engine/llms.txt) documents the controls with runnable examples. Built only on sapling2d's public API: a template for your own controls.
