import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { playgroundBridge } from './development/playground-bridge.ts';

const target = process.env.PORCELAIN_API_TARGET;
const proxy = target
  ? {
      '/api': {
        target,
        rewrite: (path: string) => path.replace(/^\/api(?=\/|$)/, ''),
      },
    }
  : undefined;

export default defineConfig(({ command, isPreview }) => {
  const tokenFile = process.env.PORCELAIN_PLAYGROUND_TOKEN_FILE;
  const bridge =
    command === 'serve' &&
    !isPreview &&
    process.env.PORCELAIN_PLAYGROUND_BRIDGE === '1' &&
    Boolean(tokenFile);
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
      ...(bridge && tokenFile
        ? [
            {
              name: 'porcelain-playground',
              configureServer(server: import('vite').ViteDevServer) {
                server.middlewares.use(playgroundBridge(tokenFile));
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
          ...(tokenFile ? [tokenFile] : []),
        ],
      },
      ...(proxy ? { proxy } : {}),
    },
    preview: { ...(proxy ? { proxy } : {}) },
  };
});
