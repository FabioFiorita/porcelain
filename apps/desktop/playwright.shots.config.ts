import { defineConfig } from '@playwright/test'

// The marketing-screenshot pipeline runs on its own config so it never rides the
// normal e2e run: testMatch selects ONLY e2e/marketing.shots.ts (which the default
// config's `*.spec.ts` glob ignores). One worker, one daemon, generous timeout —
// it seeds a demo repo and drives five surfaces end to end. See `pnpm shots`.
export default defineConfig({
  testDir: './e2e',
  testMatch: /marketing\.shots\.ts$/,
  // Same paths-free tsconfig the browser/electron projects use (see playwright.config.ts).
  tsconfig: './e2e/tsconfig.json',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 180_000,
  outputDir: './e2e/.artifacts',
})
