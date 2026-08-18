import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const webRoot = resolve('../web')
const webSrc = resolve(webRoot, 'src')
const webPublic = resolve(webRoot, 'public')

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
const { version: pluginVersion } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../plugins/porcelain/plugin.json'), 'utf8'),
) as { version: string }
const define = {
  __PORCELAIN_VERSION__: JSON.stringify(version),
  // The shipped plugin is versioned independently of the product (see plugin-assets.ts).
  __PORCELAIN_PLUGIN_VERSION__: JSON.stringify(pluginVersion),
}

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
  '@porcelain/client-runtime/session/transport': resolve(
    '../../packages/client-runtime/src/session/transport.ts',
  ),
  '@porcelain/client-runtime/session/client-runtime': resolve(
    '../../packages/client-runtime/src/session/client-runtime.ts',
  ),
  '@porcelain/client-runtime/session/interests': resolve(
    '../../packages/client-runtime/src/session/interests.ts',
  ),
  '@porcelain/client-runtime/session/recovery': resolve(
    '../../packages/client-runtime/src/session/recovery.ts',
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
        // Dev's `out/main` also holds build-node.mjs's daemon/cli bundles (run by the
        // `dev` script before this starts). Emptying on every main-process rebuild
        // would delete them and the shell's forked daemon would fail to resolve.
        // Prod's `build` script re-runs build-node.mjs after electron-vite build, so a
        // clean sweep there is safe.
        emptyOutDir: command === 'build',
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
      build: {
        // electron-vite's dev preset defaults rollupOptions.input to
        // <cwd>/src/renderer/index.html regardless of renderer.root; this repo's
        // renderer root is apps/web, so dev needs the entry pointed there explicitly
        // or `electron-vite dev` fails with "rollupOptions.input option is required".
        rollupOptions: {
          input: resolve(webRoot, 'index.html'),
        },
      },
    },
  }
})
