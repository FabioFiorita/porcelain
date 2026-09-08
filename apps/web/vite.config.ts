import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const target = process.env.PORCELAIN_API_TARGET;
const proxy = target
  ? {
      '/api': {
        target,
        rewrite: (path: string) => path.replace(/^\/api(?=\/|$)/, ''),
      },
    }
  : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    ...(proxy ? { proxy } : {}),
  },
  preview: { ...(proxy ? { proxy } : {}) },
});
