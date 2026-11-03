# @sapling2d/pack

Build-time texture atlas packer for [sapling2d](https://github.com/sapling2d/sapling2d). PNGs in, atlas PNG + JSON Hash out: the same format TexturePacker, Pixi and Phaser use, read directly by `atlas()`. No TexturePacker install or licence needed.

```sh
pnpm add -D @sapling2d/pack
pnpm sapling-pack art/items public/assets --json src   # art/items/**/*.png → public/assets/items.png + src/items.json
```

```ts
import { atlas } from 'sapling2d'
import itemsData from './items.json'
static assets = { items: atlas('items.png', itemsData) }
```

- Frame names are paths relative to the input directory (`coin.png`, `hero/attack_01.png`), sorted.
- Trims transparent edges (`--no-trim` to keep them), never rotates, pages are at most 2048 px (`--max-size`), 2 px padding (`--padding`).
- When one page is not enough it writes `items-0.png` / `items-0.json`, `items-1…`; read them with `atlas(['items-0.png', 'items-1.png'], [page0, page1])`.
- Deterministic: the same input gives byte-identical output, so commit the results and re-run after changing the sources.

## From your own script

```ts
import { packAtlas } from '@sapling2d/pack'

const { pages } = packAtlas('items', sprites, { maxSize: 2048, padding: 2, trim: true })
// sprites: { name, image: { data: RGBA Uint8Array, width, height }, pivot? }[]
// pages:   { file: 'items.png' | 'items-0.png'…, image: RGBA, json }[]
```

`packAtlas` is a pure function: it does not read files or encode images, so you can decode and encode with whatever you like (for example sharp's palette quantization). Sprites are packed in the order given; sort them for deterministic output.
