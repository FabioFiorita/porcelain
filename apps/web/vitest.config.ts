import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export const webTestConfiguration = defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});

export default defineConfig({
  ...webTestConfiguration,
  plugins: [react(), tailwindcss()],
  test: {
    name: 'browser',
    include: ['src/**/*.spec.tsx', 'src/domain/html-assets.spec.ts'],
    setupFiles: ['./src/test/setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium', headless: true }],
    },
  },
});
