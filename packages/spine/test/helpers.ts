import { Scene, type SceneClass } from 'sapling2d'
import { createTestGame, type TestGameOptions } from 'sapling2d/testing'
import { spine, spineSkeleton } from '@sapling2d/spine'

export const FIXTURES = 'test/fixtures'
export const MINIMAL = spineSkeleton('minimal/minimal.json')

/** 一个以 `assets` 为资源、ready 里执行 `build` 的场景；默认装 spine()。 */
export async function setup(build: (scene: Scene) => void, options: Partial<TestGameOptions<Scene>> & { assets?: Record<string, never> | object } = {}) {
  class Main extends Scene {
    static override assets = (options.assets ?? { skeleton: MINIMAL }) as never
    override ready() {
      build(this)
    }
  }
  const { assets: _assets, ...rest } = options
  return createTestGame({ main: Main as SceneClass<Main>, assetsDir: FIXTURES, plugins: [spine()], ...rest })
}
