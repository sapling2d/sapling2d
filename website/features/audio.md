# 音频

音效用 `sfx()`，音乐用 `music()`，和贴图一样在场景的 `static assets` 里声明。格式统一用 mp3。

<<< ../../packages/engine/docs/examples/audio.test.ts#example

## 播放

- 一次性音效：`this.tree.audio.play(stream, { volume, loop, bus, maxVoices })`。
- 背景音乐这类需要控制的声音：`AudioStreamPlayer` 节点，属性 `stream`、`volume`、`loop`、`bus`、`autoplay`，方法 `play()` / `stop()`，信号 `finished`。
- `maxVoices` 限制同一个声音同时播放的数量，超过时这次不播。命中、爆炸这类一帧可能触发几十次的音效都应该设。
- 音效预解码，可以叠加播放；音乐流式播放。

## 总线与音量

- 三条总线：`Master`、`Music`、`SFX`。`setBusMute` / `isBusMuted` 做静音开关。
- 音量是 0–1，不是 dB。

## 平台行为

- 浏览器在第一次触摸、点击或按键时自动解锁声音；切到后台时自动挂起。
- `tree.paused` **不会**暂停声音。

## 测试

无头模式不发声，只记录：`g.audio.log` 是播放记录，`g.audio.playing` 是正在播放的声音，`g.audio.finishAll()` 模拟全部播放结束。

<<< ../../packages/engine/docs/examples/audio.test.ts#test
