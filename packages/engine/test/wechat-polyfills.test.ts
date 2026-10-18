import { afterEach, describe, expect, it, vi } from 'vitest'

/** 假的 WebGL1 上下文：没有 WebGL2 的常量（TEXTURE_COMPARE_MODE 等），只记录调用。 */
function fakeGl() {
  const calls: unknown[][] = []
  return {
    calls,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    texParameteri: (...args: unknown[]) => calls.push(['texParameteri', ...args]),
    texParameterf: (...args: unknown[]) => calls.push(['texParameterf', ...args]),
    bufferSubData: (...args: unknown[]) => calls.push(['bufferSubData', ...args]),
  }
}

/** 装上假的 wx，重新加载补丁模块，返回打过补丁的上屏 canvas 的 WebGL 上下文。 */
async function patchedGl() {
  const gl = fakeGl()
  vi.stubGlobal('wx', { createCanvas: () => ({ getContext: () => gl }), getPerformance: () => ({ now: () => 0 }) })
  vi.resetModules()
  const { screenCanvas } = await import('../src/platform/wechat/polyfills')
  return { gl, ctx: screenCanvas.getContext('webgl') as ReturnType<typeof fakeGl> }
}

afterEach(() => vi.unstubAllGlobals())

describe('微信 WebGL1 补丁', () => {
  it('texParameter 的参数名是 WebGL2 常量（WebGL1 上为 undefined）时跳过，不产生 INVALID_ENUM', async () => {
    const { gl, ctx } = await patchedGl()
    const glAny = ctx as unknown as Record<string, number | undefined>
    ctx.texParameteri(ctx.TEXTURE_2D, glAny.TEXTURE_COMPARE_MODE as never, 0)
    ctx.texParameterf(ctx.TEXTURE_2D, glAny.TEXTURE_MAX_LEVEL as never, 0)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, 0x2601)
    expect(gl.calls).toEqual([['texParameteri', 0x0de1, 0x2801, 0x2601]])
  })

  it('5 参数的 bufferSubData 改成 3 参数（截取 srcOffset..srcOffset+length）', async () => {
    const { gl, ctx } = await patchedGl()
    const data = new Float32Array([1, 2, 3, 4, 5])
    ctx.bufferSubData(1, 8, data, 1, 2)
    ctx.bufferSubData(1, 0, data)
    expect(gl.calls).toEqual([
      ['bufferSubData', 1, 8, new Float32Array([2, 3])],
      ['bufferSubData', 1, 0, data],
    ])
  })

  it('同一个上下文只打一次补丁', async () => {
    const { ctx } = await patchedGl()
    const patched = ctx.texParameteri
    const { screenCanvas } = await import('../src/platform/wechat/polyfills')
    expect((screenCanvas.getContext('webgl') as ReturnType<typeof fakeGl>).texParameteri).toBe(patched)
  })
})
