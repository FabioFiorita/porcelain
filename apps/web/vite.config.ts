import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const root = resolve(import.meta.dirname)
const desktop = resolve(root, '../desktop')
const outRenderer = resolve(desktop, 'out/renderer')

const { version } = JSON.parse(readFileSync(resolve(desktop, 'package.json'), 'utf8')) as {
  version: string
}

/**
 * Self-host Excalidraw fonts under `excalidraw-assets/fonts` so CSP font-src 'self'
 * works (no CDN). Same behavior as the previous electron-vite plugin.
 */
function excalidrawAssetsPlugin(): Plugin {
  const fontsSrc = resolve(desktop, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts')
  // Prefer web's own node_modules when present.
  const fontsWeb = resolve(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts')
  const src = existsSync(fontsWeb) ? fontsWeb : fontsSrc
  const copyTo = (outDir: string): void => {
    if (!existsSync(src)) return
    const dest = join(outDir, 'excalidraw-assets', 'fonts')
    mkdirSync(dest, { recursive: true })
    cpSync(src, dest, { recursive: true })
  }
  return {
    name: 'excalidraw-assets',
    configureServer(server) {
      mkdirSync(resolve(root, 'public'), { recursive: true })
      copyTo(resolve(root, 'public'))
      server.watcher.add(src)
    },
    writeBundle() {
      copyTo(outRenderer)
    },
  }
}

export default defineConfig({
  root,
  base: './', // file:// (Electron loadFile); not Vite's default '/'
  define: { __PORCELAIN_VERSION__: JSON.stringify(version) },
  publicDir: resolve(root, 'public'),
  resolve: {
    /**
     * One React for the whole graph.
     *
     * The store carries two copies (19.2.3 alongside 19.2.8), and a lazily
     * loaded dependency that binds the other one gets a React whose internals
     * are not the ones the app initialised — which surfaces as the canvas dying
     * on `Cannot read properties of null (reading 'useLayoutEffect')`. Only the
     * production bundle the daemon serves hit it; Electron's dev renderer is
     * unbundled, so nothing caught it until a browser did.
     */
    dedupe: ['react', 'react-dom'],
    alias: {
      '@renderer': resolve(root, 'src'),
      '@main': resolve(desktop, 'src/main'),
      '@preload': resolve(desktop, 'src/preload'),
      '@backend': resolve(root, '../daemon/src'),
      '@porcelain/daemon': resolve(root, '../daemon/src'),
      '@shared': resolve(root, '../../packages/shared/src'),
      '@porcelain/shared': resolve(root, '../../packages/shared/src'),
      '@porcelain/contracts': resolve(root, '../../packages/contracts/src'),
      '@porcelain/client-runtime/commit-message': resolve(
        root,
        '../../packages/client-runtime/src/commit-message.ts',
      ),
      '@porcelain/client-runtime/highlight': resolve(
        root,
        '../../packages/client-runtime/src/highlight.ts',
      ),
      '@porcelain/client-runtime/paths': resolve(
        root,
        '../../packages/client-runtime/src/paths.ts',
      ),
      '@porcelain/client-runtime/terminal-keys': resolve(
        root,
        '../../packages/client-runtime/src/terminal-keys.ts',
      ),
      '@porcelain/client-runtime/session-protocol': resolve(
        root,
        '../../packages/client-runtime/src/session-protocol.ts',
      ),
      '@porcelain/client-runtime/word-diff-line': resolve(
        root,
        '../../packages/client-runtime/src/word-diff-line.ts',
      ),
      '@porcelain/client-runtime/word-diff-tokens': resolve(
        root,
        '../../packages/client-runtime/src/word-diff-tokens.ts',
      ),
    },
  },
  plugins: [react(), tailwindcss(), excalidrawAssetsPlugin()],
  build: {
    outDir: outRenderer,
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(root, 'index.html'),
    },
  },
  server: {
    // Dev is still primarily electron-vite; this config is for production build
    // and optional standalone `pnpm --dir apps/web dev` against a running daemon.
    port: 5173,
    strictPort: true,
  },
})
