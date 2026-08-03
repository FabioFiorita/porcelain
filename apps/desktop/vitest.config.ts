import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Mirror electron.vite.config.ts's build-time version define so daemon-version.ts
// and the CLI resolve `__PORCELAIN_VERSION__` under test.
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }

export default defineConfig({
  define: { __PORCELAIN_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@main': resolve('src/main'),
      '@backend': resolve('src/backend'),
      '@shared': resolve('../../packages/shared/src'),
      '@porcelain/shared': resolve('../../packages/shared/src'),
      '@porcelain/contracts': resolve('../../packages/contracts/src'),
      '@/': `${resolve('../mobile/src')}/`,
    },
  },
  test: {
    environment: 'jsdom',
    // `apps/mobile` runs no test runner of its own — one suite, one command. The mobile glob is
    // deliberately total: a narrower one (it was once scoped to `lib/`) silently drops any test
    // written outside it, and silence is the one failure a gate must never have. The cost is that
    // a screen test lands in jsdom with no native runtime and fails loudly — which is the correct
    // signal that it belongs in the browser-first e2e suite, not here.
    include: [
      'src/**/*.test.{ts,tsx}',
      '../../packages/*/src/**/*.test.{ts,tsx}',
      '../mobile/src/**/*.test.{ts,tsx}',
    ],
    setupFiles: ['src/test-setup.ts'],
  },
})
