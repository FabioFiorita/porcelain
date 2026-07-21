---
name: close-the-loop
metadata:
  internal: true
description: The development loop every session must complete — intent, paths, execute, test, verify with evidence, sync docs, gate, commit — plus the testing doctrine (unit tests for the daemon, browser-first for the UI) and the autonomy split (fix objective findings yourself, escalate judgment calls). Read at the start of any session that will change code.
---

# Close the loop

Porcelain is a solo side project developed almost entirely by agents. The human's goal is to interact less, not more — a session that ends with "implemented, should work" forces him to do the verification himself, which defeats the point. So every session closes the **full loop**, and the loop's meaning never varies. (Adapted from the no-mistakes philosophy — "the bottleneck isn't writing code, it's validating it" — minus the PR/CI tail a solo repo doesn't need.)

## The loop

1. **Intent** — one or two sentences, written before touching code: what will be true when this is done, and how you'll prove it. Every later phase verifies against this, not against "it compiles."
2. **Paths** — if more than one plausible approach exists, list them with tradeoffs and pick one. An obvious fix needs no ceremony; a fork of the architecture needs a proposal first (CLAUDE.md rule 1).
3. **Execute** — under the standing rules: one architecture, shadcn primitives, type-safety-driven design.
4. **Test** — regression protection, per the testing doctrine below. New behavior gets a test in the tier that owns it.
5. **Verify with evidence** — prove the *intent*, not the tests: exercise the real flow and capture something the human could look at. UI change → drive the running app (see doctrine) and screenshot, or author loop evidence for a bigger feature. Backend change → the failing-then-passing test run, or a real CLI/daemon invocation's output. If evidence genuinely can't be produced (no display, missing credential), end the session saying exactly that — **blocked beats bluffed**.
6. **Docs sync** — update the owning skill *in the same commit* for any decision changed or trap discovered (CLAUDE.md rule 4). While there, cut any skill prose that merely paraphrases the code — mechanics rot, decisions don't.
7. **Gate & commit** — `pnpm verify` (hook-enforced), then commit straight to `main`.

Scale the ceremony to the change: a typo fix is intent + gate; a feature is all seven. What never scales away is phase 5 — no change ships on "should work."

## Autonomy split

Modeled on no-mistakes' finding taxonomy — automate the objective, escalate the judgment call:

- **Just fix, don't ask**: lint/type errors, failing tests, stale docs and dead pointers, broken paths, flaky assertions, anything with one objectively correct resolution.
- **Escalate to the human**: product scope changes, a new dependency, forking an established pattern, UI/UX design that isn't settled by existing surfaces, anything destructive or outward-facing (push is deliberately left prompting).

## Testing doctrine

Decided 2026-07-18 (browser-first); e2e harden 2026-07-21 (testids + isolation + pre-tag native):

- **Backend / business logic** (daemon, git plumbing, stores, CLI, drivers) → **Vitest unit tests** are the regression lock. Manual checks are supplements, never the record.
- **Frontend, day-to-day** → **browser-first**: assert against the **web viewer** — the daemon serves the *same built dist* the Electron window loads, same tRPC + WS data path; the only delta is auth source (preload bridge vs. TokenGate + localStorage). During development, drive a live tab with the Playwright MCP; in CI and locally, `pnpm test:e2e` runs the `browser` Playwright project — headless Chromium on the daemon-served client (one spec suite serves both projects; see `e2e/helpers/app.ts`).
- **Electron native suite** (`pnpm test:e2e:native`) → same specs via Playwright's `_electron`. Runs on **tag** in `release.yml` (mac + Linux) **and** on the **pre-tag dry-run** workflow (`e2e-native-dry-run.yml`) after UI/e2e path changes on main — so a release tag is confirmation, not first discovery. Still not part of the per-commit `pnpm verify` gate.
- **E2e locator contract**: specs use **`data-testid`** from `src/shared/test-ids.ts` via `e2e/helpers/locators.ts`. Prefer test ids over `getByText` / ambiguous roles for automation. Roles and aria-labels stay on the product for humans and a11y; they are not the e2e primary seam. When you add a surface e2e must drive, add a TestIds entry + attribute in the same change.
- **Isolation**: every e2e test starts from a pristine fixture repo (test-scoped `repoDir` in `e2e/helpers/app.ts`). No shared mutation / afterAll rebuild between specs.
- **Stress**: `e2e-stress.yml` (manual) re-runs the browser suite N times with `--retries=0` to prove infinite repeatability.
- **Accepted tradeoff**: the browser can't see the Electron shell layer; native dry-run + tag catch that. Browser CI stays the fast day-to-day path.

Why browser-first also serves the product: Porcelain's direction is a solid daemon with thin viewers (Mac app, Linux app, any browser/iPad tab). Testing through the web viewer keeps that surface first-class instead of an afterthought.
