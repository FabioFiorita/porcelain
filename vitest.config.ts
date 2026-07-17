import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Mirror electron.vite.config.ts's build-time version define so the version-skew
// guard's modules (daemon-version.ts, app-version.ts) resolve `__PORCELAIN_VERSION__`
// under test — and daemon-version.test.ts can assert it matches package.json.
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
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
})
