import { defineConfig } from '@playwright/test'

// Porcelain's Electron e2e tier. Each test launches the BUILT app
// (`out/main/index.js`) through Playwright's `_electron` so the real preload is
// present and the tRPC/git data layer works — driving the dev URL in a bare
// Chromium does not (see the architecture skill's testing notes). Run `pnpm
// build` first; `pnpm test:e2e` does this for you.
export default defineConfig({
  testDir: './e2e',
  // Pin a paths-free tsconfig: the root tsconfig's `@renderer`/`@main` path
  // aliases would otherwise drive Playwright's tsconfig-paths resolver, which
  // trips on relative TS imports (`context.conditions?.includes is not a
  // function`). e2e code uses relative + bare specifiers only.
  tsconfig: './e2e/tsconfig.json',
  // One Electron instance at a time keeps screenshots deterministic and avoids
  // several apps contending for the window server.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 60_000,
  outputDir: './e2e/.artifacts',
  expect: {
    timeout: 10_000,
    // Snapshots are DOM-only (no native window chrome / vibrancy); a small ratio
    // tolerates sub-pixel font rendering. Baselines are per-platform (`-darwin`).
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  use: { trace: 'on-first-retry' },
})
