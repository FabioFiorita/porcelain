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
const { version: pluginVersion } = JSON.parse(
  readFileSync(resolve(root, '../../plugins/porcelain/.codex-plugin/plugin.json'), 'utf8'),
) as { version: string }

export default defineConfig(async ({ command }) => ({
  root,
  base: './', // file:// (Electron loadFile); not Vite's default '/'
  define: {
    __PORCELAIN_VERSION__: JSON.stringify(version),
    __PORCELAIN_PLUGIN_VERSION__: JSON.stringify(pluginVersion),
  },
  publicDir: resolve(root, 'public'),
  // `libghostty-vt` and its PTY callback shim are immutable build artifacts.
  // Keep them as URL-addressed assets instead of inlining 600+ KB into the
  // renderer entry chunk, so every split terminal shares one cached module.
  assetsInclude: ['**/*.wasm'],
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
      '@porcelain/client-runtime/session/transport': resolve(
        root,
        '../../packages/client-runtime/src/session/transport.ts',
      ),
      '@porcelain/client-runtime/session/client-runtime': resolve(
        root,
        '../../packages/client-runtime/src/session/client-runtime.ts',
      ),
      '@porcelain/client-runtime/session/interests': resolve(
        root,
        '../../packages/client-runtime/src/session/interests.ts',
      ),
      '@porcelain/client-runtime/session/recovery': resolve(
        root,
        '../../packages/client-runtime/src/session/recovery.ts',
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
  // Dev only. `vite build` never loads the dev-port module, so production is untouched.
  server: command === 'serve' ? await devServer() : undefined,
}))

/**
 * `pnpm dev:web` — the browser development loop.
 *
 * Without it, seeing a web edit in a browser meant rebuilding the renderer dist the daemon
 * serves off disk (`apps/desktop/out/renderer`), so every one-line change cost a full bundle
 * and a hard reload that threw the app state away. This serves the same source over Vite with
 * HMR and proxies every daemon route back to the dev daemon of THIS checkout (port from
 * scripts/dev-env.mjs, so a managed worktree talks to its own daemon and never 43117/43118
 * by accident). Nothing here runs for `vite build`: production is byte-identical.
 *
 * The proxy keeps the client same-origin, which is what its auth depends on — the page origin
 * is the daemon origin, `/dev-auth` hands this origin its own client token, and the `/session`
 * WebSocket passes the daemon's origin check because Host and Origin still agree (no
 * `changeOrigin`). GET /pair must NOT be proxied: it is a client route, and the daemon would
 * answer it with the stale built shell.
 */
async function devServer() {
  const { DEV_PORT, DEV_WEB_PORT } = (await import('../../scripts/dev-env.mjs')) as {
    DEV_PORT: number
    DEV_WEB_PORT: number
  }
  const target = `http://127.0.0.1:${DEV_PORT}`
  const daemonRoute = { target, changeOrigin: false }
  return {
    port: DEV_WEB_PORT,
    strictPort: true,
    proxy: {
      '/trpc': daemonRoute,
      '/session': { ...daemonRoute, ws: true },
      '/dev-auth': daemonRoute,
      '/canvas': daemonRoute,
      '/pair': {
        ...daemonRoute,
        // Only the credential exchange belongs to the daemon; the link itself is a client route.
        bypass: (req: { method?: string }) => (req.method === 'POST' ? undefined : '/index.html'),
      },
    },
  }
}
