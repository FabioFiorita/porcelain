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
      '@backend': resolve('../daemon/src'),
      '@porcelain/daemon': resolve('../daemon/src'),
      '@shared': resolve('../../packages/shared/src'),
      '@porcelain/shared': resolve('../../packages/shared/src'),
      '@porcelain/contracts': resolve('../../packages/contracts/src'),
      '@/': `${resolve('../mobile/src')}/`,
    },
  },
  test: {
    environment: 'jsdom',
    // One suite, one command. Mobile pure tests + daemon + shared packages.
    // A screen test in jsdom with no native runtime fails loudly — correct signal
    // that it belongs in browser e2e, not here.
    include: [
      'src/**/*.test.{ts,tsx}',
      '../daemon/src/**/*.test.{ts,tsx}',
      '../../packages/*/src/**/*.test.{ts,tsx}',
      '../mobile/src/**/*.test.{ts,tsx}',
    ],
    setupFiles: ['src/test-setup.ts'],
  },
})
