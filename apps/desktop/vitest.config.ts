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
      '@shared': resolve('src/shared'),
      '@porcelain/contracts': resolve('../../packages/contracts/src'),
      '@/': `${resolve('../mobile/src')}/`,
    },
  },
  test: {
    environment: 'jsdom',
    // `apps/mobile` runs no test runner of its own — one suite, one command. Scoped to any
    // `lib/` directory so the glob itself enforces "pure modules only": a screen test would drag
    // React Native into jsdom, which has no native runtime to give it.
    include: [
      'src/**/*.test.{ts,tsx}',
      '../../packages/*/src/**/*.test.{ts,tsx}',
      '../mobile/src/**/lib/**/*.test.ts',
    ],
    setupFiles: ['src/test-setup.ts'],
  },
})
