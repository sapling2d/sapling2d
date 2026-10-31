import { defineConfig } from 'vitest/config'

// docs/examples 里的示例也是测试（它们被引擎的 llms.txt 引用）。
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'docs/examples/**/*.test.ts'],
  },
})
