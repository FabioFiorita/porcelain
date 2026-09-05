import { defineConfig } from '@playwright/test'
import type { AppMode } from './e2e/helpers/app'

// Porcelain's e2e tier has a browser lane and a native Electron lane (see e2e/helpers/app.ts):
//
// - `browser` (CI smoke plus the local full acceptance command): headless Chromium driving the daemon-served
//   browser client — the daemon serves the SAME built renderer dist the Electron
//   window loads, over the same tRPC + WS data path, so this asserts everything
//   except the Electron shell layer, with no display server needed.
// - `electron` (local macOS or Windows — `pnpm --dir apps/desktop test:e2e:native*`): the
//   BUILT app via Playwright's `_electron`, so the real preload, native menu, and
//   window management are present. Not CI; release packaging does not re-run this.
//
// Both need `pnpm build` first; the build-free `:prebuilt` variants are used after
// a build has already run (for example, by CI's `pnpm verify`).
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
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  outputDir: './e2e/.artifacts',
  expect: {
    timeout: 10_000,
    // Snapshots are DOM-only (no native window chrome / vibrancy); a small ratio
    // tolerates sub-pixel font rendering. Baselines are per-project + per-platform
    // (electron keeps the legacy `-darwin` name; browser adds `-browser`).
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  use: { trace: 'retain-on-failure' },
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
      // The pre-projects template, so the committed `-darwin` baselines keep
      // matching (the default would insert the project name). Windows native tests avoid
      // those macOS-only baselines and prove shell behavior with assertions.
      snapshotPathTemplate:
        '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{platform}{ext}',
    },
  ],
})
