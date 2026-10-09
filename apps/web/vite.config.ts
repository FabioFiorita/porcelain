import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { devPair } from './dev-pair.ts';

const target = process.env.PORCELAIN_API_TARGET;
const proxy = target
  ? { '/api': { target, ws: true }, '/review-summaries': { target } }
  : undefined;
const ownerSocket = process.env.PORCELAIN_OWNER_SOCKET;
const pairing = ownerSocket && target ? devPair(ownerSocket, target) : null;
const desktopPort = Number(process.env.PORCELAIN_DESKTOP_WEB_PORT ?? 0);
const desktop = desktopPort
  ? {
      port: desktopPort,
      strictPort: true,
      hmr: { host: '127.0.0.1', clientPort: desktopPort },
    }
  : undefined;

export default defineConfig({
  define: { 'import.meta.env.PORCELAIN_DEV_PAIR': JSON.stringify(!!pairing) },
  plugins: [
    ...(pairing ? [pairing] : []),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeTreeFileHeader: [],
      semicolons: true,
    }),
    react(),
    babel({
      exclude: [/node_modules/, /src\/components\/ui\//],
      presets: [reactCompilerPreset({ panicThreshold: 'all_errors' })],
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '127.0.0.1',
    ...(proxy ? { proxy } : {}),
    ...desktop,
  },
  preview: { ...(proxy ? { proxy } : {}) },
});
