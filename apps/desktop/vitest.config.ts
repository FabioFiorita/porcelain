import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Mirror electron.vite.config.ts's build-time version define so daemon-version.ts
// and the CLI resolve `__PORCELAIN_VERSION__` under test.
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }

export default defineConfig({
  define: { __PORCELAIN_VERSION__: JSON.stringify(version) },
  // The renderer's libghostty-vt ABI tests import the pinned Wasm artifact as
  // a data URL. Mirror apps/web's Vite asset treatment in this shared config.
  assetsInclude: ['**/*.wasm'],
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('../web/src'),
      '@main': resolve('src/main'),
      '@preload': resolve('src/preload'),
      '@backend': resolve('../daemon/src'),
      '@porcelain/daemon': resolve('../daemon/src'),
      '@shared': resolve('../../packages/shared/src'),
      '@porcelain/shared': resolve('../../packages/shared/src'),
      '@porcelain/contracts': resolve('../../packages/contracts/src'),
      '@porcelain/client-runtime/commit-message': resolve(
        '../../packages/client-runtime/src/commit-message.ts',
      ),
      '@porcelain/client-runtime/highlight': resolve(
        '../../packages/client-runtime/src/highlight.ts',
      ),
      '@porcelain/client-runtime/paths': resolve('../../packages/client-runtime/src/paths.ts'),
      '@porcelain/client-runtime/terminal-keys': resolve(
        '../../packages/client-runtime/src/terminal-keys.ts',
      ),
      '@porcelain/client-runtime/session/transport': resolve(
        '../../packages/client-runtime/src/session/transport.ts',
      ),
      '@porcelain/client-runtime/session/client-runtime': resolve(
        '../../packages/client-runtime/src/session/client-runtime.ts',
      ),
      '@porcelain/client-runtime/session/recovery': resolve(
        '../../packages/client-runtime/src/session/recovery.ts',
      ),
      '@porcelain/client-runtime/session/interests': resolve(
        '../../packages/client-runtime/src/session/interests.ts',
      ),
      '@porcelain/client-runtime/testing/daemon-mock': resolve(
        '../../packages/client-runtime/src/testing/daemon-mock.ts',
      ),
      '@porcelain/client-runtime/word-diff-line': resolve(
        '../../packages/client-runtime/src/word-diff-line.ts',
      ),
      '@porcelain/client-runtime/word-diff-tokens': resolve(
        '../../packages/client-runtime/src/word-diff-tokens.ts',
      ),
      '@/': `${resolve('../mobile/src')}/`,
    },
  },
  test: {
    environment: 'jsdom',
    // One suite, one command. Mobile pure tests + daemon + cli + web + shared.
    // A screen test in jsdom with no native runtime fails loudly — correct signal
    // that it belongs in browser e2e, not here.
    include: [
      'src/**/*.test.{ts,tsx}',
      '../daemon/src/**/*.test.{ts,tsx}',
      '../cli/src/**/*.test.{ts,tsx}',
      '../web/src/**/*.test.{ts,tsx}',
      '../../packages/*/src/**/*.test.{ts,tsx}',
      '../mobile/src/**/*.test.{ts,tsx}',
    ],
    setupFiles: ['src/test-setup.ts'],
  },
})
