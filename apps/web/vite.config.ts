import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { playgroundBridge } from './development/playground-bridge.ts';

const target = process.env.PORCELAIN_API_TARGET;
// Routes exist once, under `/api`, so the dev proxy forwards them unchanged.
const proxy = target ? { '/api': { target } } : undefined;

export default defineConfig(({ command, isPreview }) => {
  const socketPath = process.env.PORCELAIN_PLAYGROUND_SOCKET;
  // The lab moves its socket and its address on every restart, so it mints
  // through an endpoint of its own rather than letting us cache either.
  const mintUrl = process.env.PORCELAIN_PLAYGROUND_MINT;
  const bridge =
    command === 'serve' &&
    !isPreview &&
    process.env.PORCELAIN_PLAYGROUND_BRIDGE === '1' &&
    (Boolean(mintUrl) || (Boolean(socketPath) && Boolean(target)));
  return {
    define: {
      'import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE': JSON.stringify(bridge),
      'import.meta.env.PORCELAIN_PLAYGROUND_AUTO_CONNECT': JSON.stringify(
        bridge && process.env.PORCELAIN_PLAYGROUND_AUTO_CONNECT === '1',
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(bridge
        ? [
            {
              name: 'porcelain-playground',
              configureServer(server: import('vite').ViteDevServer) {
                server.middlewares.use(
                  playgroundBridge(
                    mintUrl
                      ? { mintUrl }
                      : {
                          socketPath: socketPath as string,
                          address: target as string,
                        },
                  ),
                );
              },
            },
          ]
        : []),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      fs: {
        deny: [
          // Retain Vite's default deny list when adding disposable credentials.
          '.env',
          '.env.*',
          '*.{crt,pem,key,p12,pfx,cer,der}',
          '.npmrc',
          '.yarnrc.yml',
          '**/.git/**',
          '**/.playgrounds/**',
          ...(socketPath ? [socketPath] : []),
        ],
      },
      ...(proxy ? { proxy } : {}),
    },
    preview: { ...(proxy ? { proxy } : {}) },
  };
});
