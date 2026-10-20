# Agent guide for this game

This is a [sapling2d](../../packages/engine/llms.txt) game. **Read `node_modules/sapling2d/llms.txt` (or `packages/engine/llms.txt` in the sapling2d repo) before changing code.**

## What it is

The smallest game that uses the `sapling2d/motion` plugin: a portrait road scrolling down, a car that steers by tilting the phone (`tilt('left')` / `tilt('right')`) or with A / D on a keyboard. Both drive the same two actions; the car only reads `getAxis`. The HUD shows the sensor's permission state and raw `x y z roll` so the axes and units can be checked on a real device (see `.scratch/input-plugins/issues/05-device-validation.md`).

- `src/game.ts` — `gameOptions`: `plugins: [motion()]`, the two steer actions, action name registry.
- `src/config.ts` — road geometry, lane marker speed, car size and steer speed.
- `src/nodes/Car.ts` — `physicsProcess`: `velocityX = getAxis * steerSpeed`, clamped to the road.
- `src/scenes/Road.ts` — road and lane markers (`ColorRect`s, no textures), the car, HUD labels (permission hint while `permission === 'prompt'`, sensor readout).
- `test/road.test.ts` — headless: `g.inject({ type: 'motion', … })` drives the car; keyboard drives it too.

## Workflow

Test first with `createTestGame`, `pnpm check`. `pnpm dev` for the browser (desktop has no sensor: the readout says `no sensor`, A / D still work; on an iPhone over the LAN the first tap asks for motion permission). `pnpm build:wechat` for the WeChat Mini Game; build with `SAPLING_LOG_URL` and run `pnpm log-server` to read `[perf]` lines from the phone.
