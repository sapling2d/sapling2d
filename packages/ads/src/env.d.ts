// 只用 ES2022 标准库，不引入 DOM / wx 类型（和引擎核心一样）。console 不属于 ES 标准，这里声明用到的最小子集。
declare var console: {
  log(...data: unknown[]): void
  info(...data: unknown[]): void
  warn(...data: unknown[]): void
  error(...data: unknown[]): void
}
