# Plan 020: Add a `verify` script, run e2e checks in CI, and pin Node

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- package.json .github/workflows/ci.yml .github/workflows/release.yml`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (the e2e-in-CI step is environment-sensitive — see STOP conditions)
- **Category**: dx
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

Three DX gaps, in increasing risk:

1. **No `verify` script.** The 4-command gate `pnpm lint && pnpm typecheck && pnpm
   test && pnpm build` (hard rule 3) is spelled out longhand in CLAUDE.md, README,
   the codebase guide, AND duplicated as four separate CI steps — four places that
   can drift. A single `pnpm verify` would be the one source of truth.
2. **CI never runs `typecheck:e2e`.** The e2e suite has its own tsconfig and a
   `typecheck:e2e` script, but nothing automated invokes it, so the Playwright
   specs' TypeScript can break undetected. This check is cheap (no browser, no
   runner) and safe to add.
3. **No Node pin + a version mismatch.** There's no `engines` field and no
   `.nvmrc`, so contributors guess the Node version; CI pins Node 22 while
   `@types/node` is `^24`. Pinning documents the runtime and removes the guess.

The fourth half of the original finding — running the **full screenshot e2e suite**
in CI — is environment-sensitive (font anti-aliasing differs between a dev Mac and
the CI runner, so committed `-darwin` baselines may not match). It's included as a
clearly-flagged, MED-risk step the maintainer must validate on the first run.

## Current state

`package.json` scripts (relevant subset, `package.json:12-32`):

```json
"typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
"typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
"typecheck": "npm run typecheck:node && npm run typecheck:web",
"test": "vitest run",
"test:e2e": "npm run build && PLAYWRIGHT_FORCE_ASYNC_LOADER=1 playwright test",
"typecheck:e2e": "tsc --noEmit -p e2e/tsconfig.json",
"build": "npm run typecheck && electron-vite build",
"lint": "biome check .",
```

There is **no** `verify` script and **no** `engines` field. No `.nvmrc` /
`.node-version` exists.

`.github/workflows/ci.yml` (the whole file):

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

`.github/workflows/release.yml` runs on `v*` tags on `macos-14`, with steps
`pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → ensure-draft →
`pnpm release` (lines 24-39). It does NOT run e2e. The e2e suite is the documented
release gate (the `releasing` skill, step 2) but is run by hand today.

`pnpm test:e2e` builds the app then runs Playwright (`PLAYWRIGHT_FORCE_ASYNC_LOADER=1`
is required — baked into the script). Playwright is `@playwright/test ^1.61`. The
e2e specs live in `e2e/*.spec.ts`; screenshot baselines are committed under
`e2e/visual.spec.ts-snapshots/*-darwin.png`, with `maxDiffPixelRatio: 0.02` and
`retries: 1` on CI (`playwright.config.ts`).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `pnpm install`   | exit 0              |
| Verify (new) | `pnpm verify` | exit 0 (runs the 4-command gate) |
| Typecheck e2e | `pnpm typecheck:e2e` | exit 0       |
| Validate JSON | `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` | no error |

## Scope

**In scope**:
- `package.json` — add `verify` script + `engines` field
- `.nvmrc` (create)
- `.github/workflows/ci.yml` — use `pnpm verify`, add `pnpm typecheck:e2e`
- `.github/workflows/release.yml` — add `pnpm test:e2e` as a gate (the MED-risk step)

**Out of scope** (do NOT touch):
- The individual `lint`/`typecheck`/`test`/`build` scripts — `verify` composes
  them; do not change their definitions.
- The e2e specs, baselines, or `playwright.config.ts`.
- Do NOT bump the CI Node version or `@types/node` in this plan (that's a separate
  decision — see maintenance notes). Pin to the EXISTING CI Node (22).

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
gate (`pnpm verify`) before committing. Conventional Commits; example:
`ci: add a verify script, run e2e typecheck/suite in CI, pin Node`.

## Steps

### Step 1: Add the `verify` script and `engines` to `package.json`

Add to the `scripts` block (place near the existing gate scripts):

```json
"verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
```

Add a top-level `engines` field (place it next to `packageManager`):

```json
"engines": {
  "node": ">=22"
},
```

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`
→ no error. `pnpm verify` → exit 0 (this runs the full gate; expect it to take a
minute).

### Step 2: Add `.nvmrc`

Create `.nvmrc` with a single line matching CI:

```
22
```

### Step 3: Update `ci.yml` to use `verify` + run the e2e typecheck

Replace the four `run:` gate steps with a single `pnpm verify`, and add the cheap
e2e typecheck:

```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify
      - run: pnpm typecheck:e2e
```

(Keep the rest of `ci.yml` — triggers, runner, setup actions — unchanged.)

**Verify**: locally, `pnpm typecheck:e2e` → exit 0 (confirms the new CI step would
pass). `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')"`
just confirms the file is readable; you can't run the CI runner locally.

### Step 4: Add the full e2e suite to the release gate (MED-risk — read carefully)

In `.github/workflows/release.yml`, add a step that runs the e2e suite **before**
the "Build and publish" step, after `pnpm test`:

```yaml
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
```

`pnpm test:e2e` builds the app and runs Playwright with the required
`PLAYWRIGHT_FORCE_ASYNC_LOADER=1` (already in the script). The release runner is
already `macos-14`, matching the `-darwin` baselines' platform suffix.

**IMPORTANT — this step may fail on its first run** because the committed
screenshot baselines were generated on a developer Mac, and the CI runner's font
anti-aliasing can differ enough to exceed `maxDiffPixelRatio: 0.02`. If it fails on
baseline drift (not a real regression), DO NOT blindly regenerate baselines in CI.
Stop and report to the maintainer per the STOP conditions — regenerating baselines
against the CI runner is a deliberate, maintainer-owned one-time action
(`pnpm test:e2e:update` on a matching environment), not something to automate here.

If you cannot validate this step (you have no macOS CI runner), still add it, but
explicitly flag in your handoff that Step 4 is unverified and needs a maintainer's
first-run confirmation.

### Step 5: Run the gate

**Verify**: `pnpm verify` → exit 0. `pnpm typecheck:e2e` → exit 0.

## Test plan

- No application code changes — verification is: `package.json` parses, `pnpm
  verify` runs the full gate green, `pnpm typecheck:e2e` is green, and `.nvmrc`
  exists with `22`.
- The CI/release YAML changes can't be executed locally; they're verified by the
  maintainer on the next push/tag. Step 4 specifically is flagged unverified.

## Done criteria

Machine-checkable (locally verifiable subset):

- [ ] `package.json` has a `verify` script equal to the 4-command gate and an
      `engines.node` of `>=22`
- [ ] `package.json` parses as valid JSON
- [ ] `.nvmrc` exists and contains `22`
- [ ] `pnpm verify` exits 0
- [ ] `pnpm typecheck:e2e` exits 0
- [ ] `ci.yml` calls `pnpm verify` and `pnpm typecheck:e2e` (grep)
- [ ] `release.yml` calls `pnpm test:e2e` (grep) — flagged as maintainer-verify
- [ ] No application source files modified (`git status` shows only
      `package.json`, `.nvmrc`, the two workflow files, `plans/README.md`)
- [ ] `plans/README.md` status row updated (note Step 4 as needs-maintainer-verify)

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm verify` fails for a reason unrelated to your edits (a pre-existing gate
  failure — report it; do not "fix" unrelated code in this plan).
- You're tempted to regenerate or delete screenshot baselines to make Step 4 pass —
  STOP. Baseline drift on the CI runner is a maintainer decision, not an executor
  action.
- The CI Node version in `ci.yml`/`release.yml` is no longer `22` (then the
  `.nvmrc`/`engines` pin must match whatever it is — re-confirm before pinning).

## Maintenance notes

- For the reviewer: Steps 1-3 are safe and locally verifiable. Step 4 (full e2e in
  release CI) is the one to watch — confirm the first tagged release's e2e run, and
  regenerate baselines on the runner once if AA differs.
- Deferred decision (NOT in this plan): `@types/node` is `^24` while the runtime is
  Node 22. Either bump CI + `.nvmrc` + `engines` to 24, or pin `@types/node` to
  `^22`, to remove the types-vs-runtime mismatch. This plan pins to the existing
  runtime (22) to avoid changing behavior; aligning the major is a follow-up.
- Consider making the docs (CLAUDE.md hard rule 3, README, codebase guide) point at
  `pnpm verify` so the gate is named once — out of scope here to keep the diff
  reviewable, but a natural follow-up.
