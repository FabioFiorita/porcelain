import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const webRoot = resolve('../web')
const webSrc = resolve(webRoot, 'src')
const webPublic = resolve(webRoot, 'public')

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
const define = { __PORCELAIN_VERSION__: JSON.stringify(version) }

const workspaceAliases = {
  '@porcelain/contracts': resolve('../../packages/contracts/src'),
  '@porcelain/shared': resolve('../../packages/shared/src'),
  '@porcelain/client-runtime/commit-message': resolve(
    '../../packages/client-runtime/src/commit-message.ts',
  ),
  '@porcelain/client-runtime/highlight': resolve('../../packages/client-runtime/src/highlight.ts'),
  '@porcelain/client-runtime/paths': resolve('../../packages/client-runtime/src/paths.ts'),
  '@porcelain/client-runtime/terminal-keys': resolve(
    '../../packages/client-runtime/src/terminal-keys.ts',
  ),
  '@porcelain/client-runtime/session-protocol': resolve(
    '../../packages/client-runtime/src/session-protocol.ts',
  ),
  '@porcelain/client-runtime/word-diff-line': resolve(
    '../../packages/client-runtime/src/word-diff-line.ts',
  ),
  '@porcelain/client-runtime/word-diff-tokens': resolve(
    '../../packages/client-runtime/src/word-diff-tokens.ts',
  ),
  '@shared': resolve('../../packages/shared/src'),
  '@backend': resolve('../daemon/src'),
  '@porcelain/daemon': resolve('../daemon/src'),
}

export default defineConfig(({ command }) => {
  const shell = {
    main: {
      define,
      resolve: { alias: workspaceAliases },
      build: {
        rollupOptions: {
          // Shell only. Daemon/CLI: scripts/build-node.mjs. Web (prod): apps/web vite.
          input: {
            index: resolve('src/main/index.ts'),
          },
          output: { interop: 'auto' as const },
        },
      },
    },
    preload: {
      resolve: { alias: workspaceAliases },
    },
  }

  // Production: web is built by apps/web (vite) before this runs. Dev still uses
  // electron-vite's renderer for HMR against apps/web source.
  if (command === 'build') {
    return shell
  }

  return {
    ...shell,
    renderer: {
      root: webRoot,
      define,
      resolve: {
        alias: {
          '@renderer': webSrc,
          '@main': resolve('src/main'),
          '@preload': resolve('src/preload'),
          ...workspaceAliases,
        },
      },
      optimizeDeps: {
        entries: [join(webSrc, '**/*.{ts,tsx}'), join(webRoot, 'index.html')],
      },
      plugins: [react(), tailwindcss()],
      publicDir: webPublic,
    },
  }
})
