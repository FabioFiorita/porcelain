---
name: web-e2e
metadata:
  internal: true
description: Prove apps/web or the Electron renderer in a real browser, or write/debug a Playwright regression. Load only for explicit browser proof or an E2E task; ordinary UI edits use the shared development loop.
---

# Browser proof

Read `docs/development.md` for the shared dev-daemon, Playground, worktree, and process-ownership
flow. This skill owns the Porcelain browser targets and Playwright traps; it does not make E2E a
required check for every UI change.

## Choose the surface

- Use the in-app Browser for interactive proof when it is available. Load the
  `browser:control-in-app-browser` skill before opening or driving it.
- Use Playwright when Browser is unavailable or the deliverable is an automated regression.
- The browser and Electron clients share the `apps/web` renderer. The `electron` Playwright
  project is Mac-local; it is useful for shell-specific behavior and unnecessary for web-only work.

Proof stays on the development daemon and an isolated Playground. Never use production port
43117 or a real checkout for a browser fixture. When a test needs its own daemon, use the helpers'
isolated home, token, and fixture repo rather than the developer's `~/.porcelain-dev`.

## Playwright loop

```bash
pnpm test:e2e
pnpm --dir apps/desktop test:e2e:prebuilt
pnpm --dir apps/desktop test:e2e:update
```

The first command builds before running the browser project. Use `:prebuilt` only when the current
renderer output is known to be fresh. Snapshot updates affect only the project you ran and are
platform-specific.

## Writing a regression

Use the existing fixtures and locator helpers in `apps/desktop/e2e/helpers/app.ts`:

```ts
import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

test('Changes tab lists the working-tree changes', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Changes')
  await expect(loc.changesSummary(page)).toHaveAttribute('data-count', '2')
})
```

- Wait for the shell before assertions, except for the unseeded Welcome case.
- Prefer an existing `loc.*` or `TestIds` helper over raw text/role selectors when a stable test
  id exists. Add a helper beside the existing locators when the surface needs one.
- Keep the fixture isolated and restore any repository state the test mutates.
- Keep `workers: 1` and `fullyParallel: false` for screenshot-sensitive suites.
- Terminal assertions use the test-only `__porcelainTerminalText` hook, not `.xterm-rows`.
- Keep the E2E tsconfig paths-free; the renderer aliases can break Playwright's TS resolver.

## Read failures as evidence

- Rebuild before trusting a result after an `apps/web` change.
- A screenshot mismatch is evidence to inspect, not a reason to rerun until it disappears. Review
  the artifact and distinguish a real layout change from the known headless titlebar repaint quirk.
- Pin `colorScheme: 'dark'` when the assertion depends on System appearance; headless Chromium can
  report a different OS preference than a real client.
- Do not parse CLI prose for fixture paths. Resolve paths through the product helper and keep them
  inside the isolated Playground.

## Completion

Browser proof is complete when the affected flow was exercised on the chosen surface, the final
state was inspected, and any regression artifact records the command and result. Stop every daemon
or browser process owned by the task; leave unrelated sessions alone.
