import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { Schema } from 'effect';
import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, normalizePath } from 'vite-plus';
import { devPair } from './dev-pair.ts';

const packageInfo = Schema.decodeUnknownSync(
  Schema.Struct({ version: Schema.String }),
)(
  JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ),
);

const require = createRequire(import.meta.url);
const fontFiles = [
  require.resolve('@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'),
  require.resolve('@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'),
];
const webRoot = fileURLToPath(new URL('.', import.meta.url));

const fontDirectories = new Set(fontFiles.map((file) => dirname(file)));

function devFontFile(url: string | undefined) {
  const path = decodeURIComponent((url ?? '').split('?')[0] ?? '');
  if (!path.endsWith('.woff2')) return null;
  const file = path.startsWith('/@fs/')
    ? resolve(path.slice('/@fs'.length))
    : resolve(webRoot, `.${path}`);
  return fontDirectories.has(dirname(file)) && existsSync(file) ? file : null;
}

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
  define: {
    'import.meta.env.PORCELAIN_DEV_PAIR': JSON.stringify(!!pairing),
    'import.meta.env.PORCELAIN_VERSION': JSON.stringify(packageInfo.version),
  },
  plugins: [
    {
      name: 'porcelain-font-preloads',
      transformIndexHtml: {
        order: 'pre',
        handler: (_html, context) =>
          fontFiles.map((file) => {
            const href = context.server
              ? `/@fs/${normalizePath(file).replace(/^\/+/, '')}`
              : normalizePath(relative(webRoot, file));
            return {
              tag: 'link',
              attrs: {
                rel: 'preload',
                href,
                as: 'font',
                type: 'font/woff2',
                crossorigin: '',
              },
            };
          }),
      },
    },
    {
      name: 'porcelain-dev-font-cache',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const file = devFontFile(request.url);
          if (!file) return next();
          response.setHeader('Content-Type', 'font/woff2');
          response.setHeader(
            'Cache-Control',
            'public, max-age=31536000, immutable',
          );
          createReadStream(file).pipe(response);
        });
      },
    },
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
  optimizeDeps: {
    include: ['@pierre/diffs/worker', '@pierre/diffs/worker/worker.js'],
  },
  server: {
    host: '127.0.0.1',
    ...(proxy ? { proxy } : {}),
    ...desktop,
  },
  preview: { ...(proxy ? { proxy } : {}) },
});
