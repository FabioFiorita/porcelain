import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // Three main-process bundles: the app entry; the standalone stdio MCP
        // server the user's agent spawns (`node out/main/mcp/server.js`), which
        // imports only Node builtins so it runs under a plain `node`; and the
        // daemon (`out/main/daemon/server.js`), the Electron-free backend the
        // shell spawns with ELECTRON_RUN_AS_NODE — it imports only src/backend,
        // Node builtins, and externalized deps (@trpc/server, ws, node-pty, zod,
        // trash), never electron (Biome-fenced in src/backend).
        input: {
          index: resolve('src/main/index.ts'),
          'mcp/server': resolve('src/mcp/server.ts'),
          'daemon/server': resolve('src/backend/server.ts'),
        },
      },
    },
  },
  preload: {},
  renderer: {
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
    plugins: [react(), tailwindcss()],
  },
})
