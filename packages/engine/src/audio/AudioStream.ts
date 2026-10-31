import type { Resource } from '../assets/Resource'
import type { Texture } from '../assets/Texture'
import type { AudioBackend } from './backend'

/**
 * 音频资源句柄。
 * - `sfx(path)`：音效。进入场景前完整解码到内存，可以同时播放多个、延迟低。
 * - `music(path)`：音乐。流式播放，不整首解码，省内存；同一时间通常只放一首。
 *
 * 同一路径永远返回同一个句柄。格式统一用 mp3（浏览器和小游戏都支持）。
 */
export class AudioStream implements Resource {
  private _loaded: boolean
  /** @internal 平台解码后的音频数据（只有 sfx 有）。 */
  _buffer: unknown = null

  /** @internal 请使用 sfx(path) / music(path)。 */
  constructor(
    readonly kind: 'sfx' | 'music',
    readonly path: string,
  ) {
    // 音乐是流式的，不需要预加载
    this._loaded = kind === 'music'
  }

  get isLoaded(): boolean {
    return this._loaded
  }

  /** @internal */
  _setLoaded(buffer: unknown): void {
    this._buffer = buffer
    this._loaded = true
  }

  /** @internal 加载并解码（`Resource`）：只用到平台的音频后端。音乐是流式的，声明时就算加载完。 */
  _load(platform: { readonly audio: AudioBackend }): Promise<void> {
    if (this._loaded) return Promise.resolve()
    return platform.audio.loadSound(this.path).then(
      (buffer) => this._setLoaded(buffer),
      (err: unknown) => {
        throw new Error(`Failed to load sound "${this.path}": ${err instanceof Error ? err.message : String(err)}`)
      },
    )
  }

  /** @internal 释放解码后的音频；音乐是流式的，没有可释放的数据。 */
  _unload(): void {
    if (this.kind === 'music') return
    this._buffer = null
    this._loaded = false
  }

  /** @internal 声音不用图片。 */
  _textures(): Texture[] {
    return []
  }
}

const cache = new Map<string, AudioStream>()

function get(kind: 'sfx' | 'music', path: string): AudioStream {
  const key = `${kind}:${path}`
  let s = cache.get(key)
  if (!s) cache.set(key, (s = new AudioStream(kind, path)))
  return s
}

/** 声明一个音效（预先解码，可叠加播放）。 */
export function sfx(path: string): AudioStream {
  return get('sfx', path)
}

/** 声明一段音乐（流式播放）。 */
export function music(path: string): AudioStream {
  return get('music', path)
}
