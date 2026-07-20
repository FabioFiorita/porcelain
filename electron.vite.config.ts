import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

/**
 * Self-host Excalidraw fonts under `excalidraw-assets/fonts` so CSP font-src 'self'
 * works (no CDN). Copied from the package at dev-server start and production build.
 */
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
      // Dev: materialize under the renderer public-ish out so `/excalidraw-assets/` resolves.
      const devPublic = resolve('src/renderer/public')
      mkdirSync(devPublic, { recursive: true })
      copyTo(devPublic)
      server.watcher.add(fontsSrc)
    },
    writeBundle(_options, _bundle) {
      // electron-vite writes renderer to out/renderer
      const outDir = resolve('out/renderer')
      copyTo(outDir)
    },
  }
}

// Bake package.json's version into BOTH the daemon bundle (so `daemonInfo` can
// announce it — Electron-free, no runtime package.json read that the differing
// out/ vs dist-daemon layouts would break) and the renderer bundle (so the client
// knows its own build version). One source of truth, replaced at build time; the
// standalone porcelain-daemon package copies the already-baked bundle unchanged.
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
const define = { __PORCELAIN_VERSION__: JSON.stringify(version) }

export default defineConfig({
  main: {
    define,
    build: {
      rollupOptions: {
        // Three main-process bundles: the app entry; the dependency-free agent CLI
        // (`node out/main/cli/porcelain.js`) copied to ~/.porcelain/porcelain.js, which
        // imports only Node builtins so it runs under a plain `node`; and the
        // daemon (`out/main/daemon/server.js`), the Electron-free backend the
        // shell spawns with ELECTRON_RUN_AS_NODE — it imports only src/backend,
        // Node builtins, and externalized deps (@trpc/server, ws, node-pty, zod,
        // trash), never electron (Biome-fenced in src/backend).
        input: {
          index: resolve('src/main/index.ts'),
          'cli/porcelain': resolve('src/cli/porcelain.ts'),
          'daemon/server': resolve('src/backend/server.ts'),
        },
        // External ESM-only deps (trash) required from the CJS bundles need the
        // __esModule-aware interop helper, or their default import becomes a
        // namespace object at runtime ("trash is not a function"); caught by the
        // e2e trash spec.
        output: { interop: 'auto' },
      },
    },
  },
  preload: {},
  renderer: {
    define,
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@main': resolve('src/main'),
        '@backend': resolve('src/backend'),
        '@shared': resolve('src/shared'),
      },
    },
    optimizeDeps: {
      // Pre-bundle every @base-ui entry point used by shadcn components.
      // Discovering one lazily (e.g. opening a dropdown for the first time)
      // makes Vite re-optimize mid-session, which loads a second React copy
      // and crashes the renderer with "Invalid hook call" / a blank window.
      entries: ['src/**/*.{ts,tsx}', 'index.html'],
    },
    plugins: [react(), tailwindcss(), excalidrawAssetsPlugin()],
    publicDir: resolve('src/renderer/public'),
  },
})
