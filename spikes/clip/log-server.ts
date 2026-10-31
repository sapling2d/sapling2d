// 局域网日志服务：接收真机 / 模拟器转发的 console 输出、错误和截图（logs/）。
// node spikes/clip/log-server.ts
import { startLogServer } from '../../packages/engine/src/vite/index.ts'

startLogServer({ port: 7777, file: new URL('logs/wechat.jsonl', import.meta.url).pathname })
console.log('log server on :7777 (spikes/clip/logs/wechat.jsonl)')
