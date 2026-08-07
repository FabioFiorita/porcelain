import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname)
const desktop = resolve(root, '../desktop')
const outRenderer = resolve(desktop, 'out/renderer')

const { version } = JSON.parse(readFileSync(resolve(desktop, 'package.json'), 'utf8')) as {
  version: string
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
     * The store carries two copies (19.2.3 alongside 19.2.8 — react-native pins
     * the older one), and a lazily loaded dependency that binds the other gets a
     * React whose internals are not the ones the app initialised, which surfaces
     * as a dead pane on `Cannot read properties of null (reading
     * 'useLayoutEffect')`. Only the
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
  plugins: [react(), tailwindcss()],
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
