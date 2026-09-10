import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/mock.spec.ts',
  forbidOnly: true,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4176', trace: 'retain-on-failure' },
  projects: [
    { name: 'mock-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mock-narrow', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command:
      'VITE_API_MODE=mock pnpm exec vite build --outDir dist/mock && pnpm exec vite preview --outDir dist/mock --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
