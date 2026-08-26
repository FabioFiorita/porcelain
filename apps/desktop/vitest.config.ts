import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Anchor every path to THIS file, not to the working directory. `resolve()` alone was correct
// only while the suite was launched from apps/desktop; a runner that starts elsewhere (Stryker
// sandboxes, an editor task) silently resolved the monorepo root to the wrong directory.
const here = dirname(fileURLToPath(import.meta.url))
const resolve = (...segments: string[]): string => resolvePath(here, ...segments)

// Mirror electron.vite.config.ts's build-time version define so daemon-version.ts
// and the CLI resolve `__PORCELAIN_VERSION__` under test.
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
const { version: pluginVersion } = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../plugins/porcelain/.codex-plugin/plugin.json'),
    'utf8',
  ),
) as { version: string }

export default defineConfig({
  define: {
    __PORCELAIN_VERSION__: JSON.stringify(version),
    __PORCELAIN_PLUGIN_VERSION__: JSON.stringify(pluginVersion),
  },
  // The renderer's libghostty-vt ABI tests import the pinned Wasm artifact as
  // a data URL. Mirror apps/web's Vite asset treatment in this shared config.
  assetsInclude: ['**/*.wasm'],
  plugins: [react()],
  resolve: {
    // Same dual-React trap as apps/web (RN pins 19.2.3; desktop/web use 19.2.8).
    // Mobile Board tests share this graph — pin one React + the matching Query peer.
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      react: resolve('node_modules/react'),
      'react-dom': resolve('node_modules/react-dom'),
      'react/jsx-runtime': resolve('node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolve('node_modules/react/jsx-dev-runtime.js'),
      '@tanstack/react-query': resolve('node_modules/@tanstack/react-query'),
      zustand: resolve('node_modules/zustand'),
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
      '@porcelain/client-runtime/board': resolve(
        '../../packages/client-runtime/src/board/index.ts',
      ),
      '@porcelain/client-runtime/projects': resolve(
        '../../packages/client-runtime/src/projects/index.ts',
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
      // Mobile feature tests resolve through the desktop vitest graph; share the same RTL.
      '@testing-library/react': resolve('node_modules/@testing-library/react'),
      '@/': `${resolve('../mobile/src')}/`,
    },
  },
  test: {
    environment: 'jsdom',
    // The suite spans every package, so the project root is the monorepo — coverage `include`
    // globs are resolved against this and silently match nothing when they climb out of it.
    root: resolve('../..'),
    // One suite, one command. Mobile pure tests + daemon + web + shared.
    // A screen test in jsdom with no native runtime fails loudly — correct signal
    // that it belongs in browser e2e, not here.
    include: [
      'apps/desktop/src/**/*.test.{ts,tsx}',
      'apps/daemon/src/**/*.test.{ts,tsx}',
      'apps/web/src/**/*.test.{ts,tsx}',
      'packages/*/src/**/*.test.{ts,tsx}',
      'apps/mobile/src/**/*.test.{ts,tsx}',
    ],
    setupFiles: ['apps/desktop/src/test-setup.ts'],
    // Measurement only — no thresholds. A number nobody has looked at makes a bad gate,
    // so `pnpm quality` snapshots the baseline first and the ratchet lands after.
    // `all` is the whole point: a file with no test must read 0%, not go missing.
    coverage: {
      provider: 'v8',
      all: true,
      reportsDirectory: resolve('coverage'),
      reporter: ['json-summary', 'text-summary'],
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/test-setup.ts',
        // Test doubles and fixtures are scaffolding, not product surface.
        '**/testing/**',
        '**/__fixtures__/**',
        // Generated shadcn primitives — re-applied from upstream, not authored here
        // (Biome excludes them for the same reason).
        '**/components/ui/**',
      ],
    },
  },
})
