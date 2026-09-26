import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const target = process.env.PORCELAIN_API_TARGET;
const proxy = target
  ? { '/api': { target, ws: true }, '/review-summaries': { target } }
  : undefined;

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ panicThreshold: 'none' })] }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '127.0.0.1',
    ...(proxy ? { proxy } : {}),
  },
  preview: { ...(proxy ? { proxy } : {}) },
});
