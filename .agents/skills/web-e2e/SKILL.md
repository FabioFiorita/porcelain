---
name: web-e2e
version: 0.50.0
metadata:
  internal: true
description: Browser proof for the daemon-served apps/web client, with Playwright as the automated-regression fallback. Load when proving apps/web behavior, writing or debugging an e2e spec, or chasing an e2e failure.
---

# Web e2e

## Choose the proof surface

Use the in-app Browser for interactive runtime proof: open the dev-daemon URL, inspect visible and
interactive state, drive the flow, and capture screenshots there. Load and follow the
`browser:control-in-app-browser` skill before browser work. It owns browser selection, setup, and
interaction; this skill owns Porcelain-specific targets and fallback traps.

Use the Playwright browser lane only when Browser is unavailable or the deliverable itself is an
automated regression/CI spec. A passing Playwright run can support that regression artifact, but it
does not replace Browser proof when Browser is available.

Start the dev daemon with `pnpm dev:daemon` (or `pnpm dev:daemon -- --host`), which enables its
secure RFC1918 LAN listeners on the configured port. Open the proof at `http://beelink:<port>`;
use `--loopback` only for proof that stays on this machine. Use an isolated development home and
a Playground repo. Production port 43117 and real repos are outside the proof boundary.

Specs live under `apps/desktop/e2e/` but they drive `apps/web` — the daemon serves the same built
renderer the Electron window loads, over the same tRPC + WS path, so the `browser` Playwright
project is the headless automated fallback against the same client. `mobile/reference/android.md`
is the sibling doc for the other platform.

## Playwright fallback loop

```bash
pnpm test:e2e                 # build + run the browser project — the CI lane
pnpm --dir apps/desktop test:e2e:prebuilt   # expanded 18-test lane; skip the build when `out/` is fresh
pnpm --dir apps/desktop test:e2e:update     # regenerate `browser` snapshot baselines
```

`electron` is the other Playwright project (real Electron shell, `_electron`) — **Mac-local only**
(`test:e2e:native*`), not CI, not `pnpm verify`. Never run it to prove a web-only change; it has no
Linux baseline and downloads nothing on the mac release runner unless you ask for it.

## Anatomy (`e2e/helpers/app.ts`)

- **One daemon per test, spawned fresh.** Isolated `PORCELAIN_HOME`/`PORCELAIN_USER_DATA` under a
  temp dir, an admin token, and a seeded `access.json` client token planted into `localStorage`
  before any renderer script runs (`context.addInitScript`). Nothing touches `~/.porcelain-dev`.
- **`repoDir` fixture** is a fresh fixture git repo at a **fixed path** (`porcelain-e2e-fixture`),
  recreated per test — fixed so screenshots get a stable project name, safe because
  `workers: 1` makes it single-owner. Never point a spec at the human's real repos or prod channels.
- **`seedRepo`** (`test.use({ ... })`) controls whether the isolated fixture project is restored
  before the app boots. `seedRepo: false` lands on Welcome instead. The four critical assertions,
  expanded acceptance lane, and lower-boundary relocation decisions live in
  `apps/desktop/e2e/critical-wiring.md`.
- Fixtures tear themselves down (`rm` the repo, user data, kill the daemon on `SIGTERM`) — a spec
  that mutates the shared fixture repo must restore it, or leave a later test working from the
  wrong tree.

## Writing a spec

```ts
import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

test('Changes tab lists the working-tree changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(loc.changesSummary(page)).toHaveAttribute('data-count', '2')
})
```

- **Always `await waitForShell(page)` first** (except the `seedRepo: false` Welcome case) — it
  waits on the rail Settings test id, long-timeout (60s) to cover a cold daemon boot under load.
- **Locate through `loc.*` / `TestIds`** (`packages/shared/src/test-ids.ts`), never
  `getByText`/`getByRole` for anything with a stable `data-testid`. Add a `loc.*` helper next to the
  existing ones rather than reaching for a raw `page.getByTestId` inline — keeps selectors
  discoverable and renames a one-file fix.
- **New spec files are picked up automatically** — `testDir: './e2e'`, no registration needed.
- `page.evaluate` is fair game for state Playwright can't see structurally (see Terminal below).

## Traps

- **Snapshot baselines are per-project *and* per-platform.** `changes-tab-browser-linux.png` vs
  `changes-tab-darwin.png` — `snapshotPathTemplate` inserts both. `test:e2e:update` only regenerates
  the project you ran (`browser` by default); it will not touch `electron`'s mac baselines, and
  running it on Linux does not "fix" a mac snapshot.
- **The `.app-drag` titlebar row does not repaint in headless Chromium screenshots** after a live
  light/dark flip — it stays the boot color in captures while the DOM (and headed Chromium, and
  real clients) are correct. This is a documented headless-rendering quirk of that one row, not an
  app bug — don't spend time chasing it in `apps/web`.
- **`colorScheme: 'dark'` is pinned on every context/page** (both projects) because the Appearance
  preference defaults to System, and headless Chromium reports `prefers-color-scheme: light`
  regardless of the OS — an unpinned context makes every System-default assertion flip against a
  real machine's actual theme.
- **Terminal assertions go through `__porcelainTerminalText`, never `.xterm-rows`.** The terminal's
  WebGL renderer paints to a `<canvas>` and never fills the DOM rows xterm normally populates —
  `expectTerminalText(page, index, text)` polls the test-only buffer hook the registry installs
  under `PORCELAIN_E2E=1` instead. `index` is terminal creation order, not tab order.
- **The e2e `tsconfig.json` is deliberately paths-free.** The root tsconfig's `@renderer`/`@main`
  path aliases would otherwise drive Playwright's tsconfig-paths resolver, which trips with
  `context.conditions?.includes is not a function` on relative TS imports. e2e code uses relative +
  bare specifiers only — don't add a path alias here to "match the app."
- **Don't parse CLI stdout prose for a filesystem path.** A CLI command's human-readable explainer
  is not a stable contract. Compute paths through the shared product path helper instead of reading
  them back from output; proof fixtures must stay inside their isolated Playground home.
- **`fullyParallel: false`, `workers: 1`.** One app/daemon instance at a time keeps screenshots
  deterministic. Don't add `test.describe.parallel` or bump workers to "speed things up" — it will
  make screenshots and the fixed fixture path racy.
- **`PLAYWRIGHT_FORCE_ASYNC_LOADER=1` is set on every `test:e2e*` script.** If you shell out to
  `playwright test` directly instead of the `pnpm` script, set it yourself or specs referencing
  dynamic imports can fail in ways that look unrelated to your change.
- **Both projects need a fresh `pnpm build` first** — `test:e2e` does this for you; the `:prebuilt`
  variants skip it deliberately for fast iteration once `out/` is current. Stale `out/` after an
  `apps/web` edit is the most common "my fix isn't showing up" cause — rebuild before re-reading
  the failure.
- **A successful run is not proof by itself.** Read what a `toHaveScreenshot` diff actually shows on
  failure (`e2e/.artifacts`, gitignored, delete before stopping per root instructions) rather than re-running
  and hoping it passes; a flaky-looking diff is usually a real layout change.

## CI

`.github/workflows/ci.yml` installs Chromium (`playwright install --with-deps chromium`) and the
Electron binary (`node apps/desktop/node_modules/electron/install.js`, since Electron 42 has no
postinstall), then runs `pnpm test:e2e` — the `browser` project only. The `electron` project never
runs in CI; don't gate a PR on it.
