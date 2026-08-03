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
      // Dev: materialize under web public so `/excalidraw-assets/` resolves.
      mkdirSync(webPublic, { recursive: true })
      copyTo(webPublic)
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

// The cross-client wire contract (packages/contracts) is a workspace package with
// no build step, resolved by alias rather than by a `dependencies` entry:
// electron-vite externalizes declared deps, so declaring it would emit a bare
// `require("@porcelain/contracts")` into the dependency-free CLI and the
// standalone daemon bundle. The alias keeps it bundled from source everywhere.
// Workspace packages resolved by alias (not dependencies) so electron-vite does
// not externalize them into bare requires inside the CLI/daemon bundles.
const workspaceAliases = {
  '@porcelain/contracts': resolve('../../packages/contracts/src'),
  '@porcelain/shared': resolve('../../packages/shared/src'),
  '@shared': resolve('../../packages/shared/src'),
  // Daemon source package — still bundled by electron-vite until independent build.
  '@backend': resolve('../daemon/src'),
  '@porcelain/daemon': resolve('../daemon/src'),
}

export default defineConfig({
  main: {
    define,
    resolve: { alias: workspaceAliases },
    build: {
      rollupOptions: {
        // Shell only — daemon and agent CLI are built by `scripts/build-node.mjs`
        // (esbuild) into out/main/{daemon,cli}/ so this package stays Electron chrome.
        input: {
          index: resolve('src/main/index.ts'),
        },
        // External ESM-only deps (trash) required from the CJS bundles need the
        // __esModule-aware interop helper, or their default import becomes a
        // namespace object at runtime ("trash is not a function"); caught by the
        // e2e trash spec.
        output: { interop: 'auto' },
      },
    },
  },
  preload: {
    resolve: { alias: workspaceAliases },
  },
  renderer: {
    // Web client package (apps/web) — independent Vite later; electron-vite still owns the build.
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
      // Pre-bundle every @base-ui entry point used by shadcn components.
      // Discovering one lazily (e.g. opening a dropdown for the first time)
      // makes Vite re-optimize mid-session, which loads a second React copy
      // and crashes the renderer with "Invalid hook call" / a blank window.
      entries: [join(webSrc, '**/*.{ts,tsx}'), join(webRoot, 'index.html')],
    },
    plugins: [react(), tailwindcss(), excalidrawAssetsPlugin()],
    publicDir: webPublic,
    build: {
      outDir: resolve('out/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(webRoot, 'index.html'),
      },
    },
  },
})
