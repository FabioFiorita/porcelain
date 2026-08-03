import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

/**
 * Self-host Excalidraw fonts under `excalidraw-assets/fonts` so CSP font-src 'self'
 * works (no CDN). Used only for `electron-vite dev` (serve); production web is
 * `pnpm build:web` (apps/web vite).
 */
const webRoot = resolve('../web')
const webSrc = resolve(webRoot, 'src')
const webPublic = resolve(webRoot, 'public')

function excalidrawAssetsPlugin(): Plugin {
  const fontsSrc = resolve('node_modules/@excalidraw/excalidraw/dist/prod/fonts')
  const copyTo = (outDir: string): void => {
    if (!existsSync(fontsSrc)) return
    const dest = join(outDir, 'excalidraw-assets', 'fonts')
    mkdirSync(dest, { recursive: true })
    cpSync(fontsSrc, dest, { recursive: true })
  }
  return {
    name: 'excalidraw-assets',
    configureServer(server) {
      mkdirSync(webPublic, { recursive: true })
      copyTo(webPublic)
      server.watcher.add(fontsSrc)
    },
    writeBundle() {
      copyTo(resolve('out/renderer'))
    },
  }
}

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
const define = { __PORCELAIN_VERSION__: JSON.stringify(version) }

const workspaceAliases = {
  '@porcelain/contracts': resolve('../../packages/contracts/src'),
  '@porcelain/shared': resolve('../../packages/shared/src'),
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
      plugins: [react(), tailwindcss(), excalidrawAssetsPlugin()],
      publicDir: webPublic,
    },
  }
})
