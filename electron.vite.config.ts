import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // Two main-process bundles: the app entry, and the standalone stdio MCP
        // server the user's agent spawns (`node out/main/mcp/server.js`). The MCP
        // bundle imports only Node builtins, so it runs under a plain `node`.
        input: {
          index: resolve('src/main/index.ts'),
          'mcp/server': resolve('src/mcp/server.ts'),
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
