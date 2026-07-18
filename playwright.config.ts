import { defineConfig } from '@playwright/test'
import type { AppMode } from './e2e/helpers/app'

// Porcelain's e2e tier — ONE spec suite, two runtimes (see e2e/helpers/app.ts):
//
// - `browser` (day-to-day, per push): headless Chromium driving the daemon-served
//   browser client — the daemon serves the SAME built renderer dist the Electron
//   window loads, over the same tRPC + WS data path, so this asserts everything
//   except the Electron shell layer, with no display server needed.
// - `electron` (release only, macOS + Linux in release.yml): the BUILT app via
//   Playwright's `_electron`, so the real preload, native menu, and window
//   management are present.
//
// Both need `pnpm build` first; the `test:e2e*` scripts do this for you.
export default defineConfig<{ appMode: AppMode }>({
  testDir: './e2e',
  // Pin a paths-free tsconfig: the root tsconfig's `@renderer`/`@main` path
  // aliases would otherwise drive Playwright's tsconfig-paths resolver, which
  // trips on relative TS imports (`context.conditions?.includes is not a
  // function`). e2e code uses relative + bare specifiers only.
  tsconfig: './e2e/tsconfig.json',
  // One app instance at a time keeps screenshots deterministic and avoids
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
    // tolerates sub-pixel font rendering. Baselines are per-project + per-platform
    // (electron keeps the legacy `-darwin`/`-linux` names; browser adds `-browser`).
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  use: { trace: 'on-first-retry' },
  projects: [
    {
      name: 'browser',
      use: { appMode: 'browser' },
      snapshotPathTemplate:
        '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-browser-{platform}{ext}',
    },
    {
      name: 'electron',
      use: { appMode: 'electron' },
      // The pre-projects template, so the committed `-darwin`/`-linux` baselines
      // keep matching (the default would insert the project name).
      snapshotPathTemplate:
        '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{platform}{ext}',
    },
  ],
})
