# Plan 026: Run the Playwright e2e suite on every push, not only at release

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bb4a55..HEAD -- .github/workflows/ci.yml .github/workflows/release.yml package.json`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `7bb4a55`, 2026-06-26

## Why this matters

The Playwright Electron e2e suite (in `e2e/`) is the **only** verification that the real
preload + tRPC/git layer, the multi-window shell, and the embedded terminal actually work —
unit tests mock the domain hooks, so renderer↔main IPC, app-event routing, and the PTY
subsystem have no unit coverage. Today that suite runs **only at release**: `ci.yml` (on
every push/PR) runs `pnpm verify` + `pnpm typecheck:e2e` (which *type-checks* the e2e code
but never *runs* it), while `release.yml` (on a `v*` tag) is the only place `pnpm test:e2e`
executes. So a regression in window lifecycle, IPC, or the terminal can land on `main` and
stay invisible until a release is cut.

Adding an e2e job to per-commit CI closes that gap. **Two real constraints shape the fix
(read before implementing):**

1. **Platform.** The e2e snapshots are committed **per-platform, `-darwin` only** (see
   `playwright.config.ts` — baselines are `-darwin`; the architecture skill confirms it).
   `ci.yml`'s existing `check` job runs on `ubuntu-latest`. Running e2e on Linux would fail
   every screenshot assertion (no `-linux` baselines). **The e2e job must run on
   `macos-14`** (matching `release.yml`).
2. **Recent decision.** Commit `7bb4a55` ("docs(releasing): drop the local e2e gate; trust
   the macos-14 runner") deliberately moved the e2e trust boundary to the release runner.
   This plan adds an e2e leg *earlier* (per-commit) on that same macos-14 runner — it
   complements that decision rather than reversing it, but the maintainer chose it knowing
   macOS runner minutes cost ~10× Linux. That cost is the accepted tradeoff; do not try to
   "optimize" it onto Linux (constraint 1 forbids it).

The fast `ubuntu` `check` job stays as the quick-feedback gate; the e2e job runs in parallel.

## Current state

`.github/workflows/ci.yml` (entire file today):

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
      - run: pnpm verify
      - run: pnpm typecheck:e2e
```

The e2e steps in `.github/workflows/release.yml` (lines 24–29), to mirror exactly:

```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
```

Facts the plan relies on:
- `package.json`: `"test:e2e": "npm run build && PLAYWRIGHT_FORCE_ASYNC_LOADER=1 playwright test"`.
  So `pnpm test:e2e` **builds the app first** — no separate `pnpm build` step is needed in
  the job. The `PLAYWRIGHT_FORCE_ASYNC_LOADER=1` env is baked into the script.
- `playwright.config.ts`: `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0`,
  `workers: 1`. GitHub Actions sets `CI=true` automatically — no extra config needed.
- The e2e fixture launches the **built** `out/main/index.js`; `pnpm exec playwright install
  --with-deps chromium` provisions the browser deps Playwright needs (mirrors release.yml).

## Commands you will need

| Purpose                  | Command                                  | Expected on success |
|--------------------------|------------------------------------------|---------------------|
| Install                  | `pnpm install`                           | exit 0              |
| YAML sanity (parse)      | `pnpm exec node -e "require('node:fs')"` | (see Step 2 note)   |
| Local e2e proof (macOS)  | `pnpm test:e2e`                          | all specs pass      |
| Full gate                | `pnpm verify`                            | all pass            |

## Scope

**In scope** (the only file you should modify):
- `.github/workflows/ci.yml` — add a second job, `e2e`, on `macos-14`.

**Out of scope** (do NOT touch):
- `.github/workflows/release.yml` — leave the release pipeline as-is.
- `playwright.config.ts`, the `e2e/` specs, snapshots, or `package.json` scripts — no code
  or test changes; this is CI wiring only. If the e2e suite is failing locally, that is a
  separate problem — STOP and report (do not "fix" specs to make CI green).
- The existing `check` job — keep it exactly as it is (fast ubuntu feedback).

## Git workflow

- Commit straight to `main` (no branches — the git-guard hook hard-blocks branch creation).
- Conventional Commits. Suggested: `ci: run the Electron e2e suite on every push (macos-14)`
- Do NOT push unless the operator instructed it — pushing is what actually exercises the new
  job, and is the one outward-facing action left to prompt.

## Steps

### Step 1: Add the `e2e` job to `ci.yml`

Add a second job alongside `check`. Final `ci.yml` should be:

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
      - run: pnpm verify
      - run: pnpm typecheck:e2e

  e2e:
    # macos-14 because the committed Playwright snapshots are `-darwin` only
    # (see playwright.config.ts); Linux would fail every screenshot assertion.
    # Runs in parallel with `check`; macOS runner minutes are the accepted cost.
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      # `pnpm test:e2e` builds the app first (see package.json) and bakes in
      # PLAYWRIGHT_FORCE_ASYNC_LOADER=1; no separate build step needed.
      - run: pnpm test:e2e
```

Do not add `pnpm build` — `test:e2e` already builds. Do not set `PLAYWRIGHT_FORCE_ASYNC_LOADER`
in the workflow — it is in the npm script.

**Verify (YAML is well-formed)**: run
`pnpm exec node -e "const c=require('node:child_process'); process.exit(0)"` is *not* a YAML
check — instead confirm the file parses as YAML with:

```
pnpm exec node -e "const fs=require('node:fs'); const t=fs.readFileSync('.github/workflows/ci.yml','utf8'); if(!/jobs:\s/.test(t)||!/e2e:/.test(t)||!/macos-14/.test(t)){throw new Error('e2e job missing')} console.log('ci.yml has the e2e job on macos-14')"
```

Expected: prints `ci.yml has the e2e job on macos-14`.

### Step 2: Prove the e2e suite is green locally before relying on it in CI

So the new CI job won't immediately go red, run the suite once locally. This requires
macOS + a build toolchain (the dev environment is darwin). In a fresh worktree, install
first.

```
pnpm install
pnpm test:e2e
```

Expected: the suite builds the app and all specs pass (Playwright `list` reporter ends with
all green; no failures).

- If `pnpm test:e2e` **passes**: the new job is safe to wire; proceed.
- If it **fails for an environmental reason** (not on macOS, missing system deps, no display
  server): note it and proceed — the workflow change is still correct; record in your report
  that you could not run e2e locally and why.
- If it **fails because a spec actually fails** (a real regression, or a snapshot mismatch):
  **STOP and report.** Do not modify specs or snapshots — that is out of scope and would be
  gaming the gate.

### Step 3: Run the standard gate

The workflow change touches no TypeScript, but run the gate anyway (it must stay green and
the git-guard requires it before commit):

**Verify**: `pnpm verify` → all pass.

## Test plan

This is CI configuration, not application code — there is no unit test to add. Verification is:
- The YAML-shape check in Step 1 (the `e2e` job exists, on `macos-14`).
- A local `pnpm test:e2e` run (Step 2) proving the suite the job will run is currently green.
- The true end-to-end proof is the next push to `main` showing **two** CI jobs (`check` on
  ubuntu, `e2e` on macos-14), both passing — note this in your report for the maintainer to
  confirm after they push.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.github/workflows/ci.yml` contains a second job named `e2e` with `runs-on: macos-14` that runs `pnpm exec playwright install --with-deps chromium` then `pnpm test:e2e`.
- [ ] The existing `check` job on `ubuntu-latest` is unchanged (still `pnpm verify` + `pnpm typecheck:e2e`).
- [ ] The Step-1 YAML-shape check prints `ci.yml has the e2e job on macos-14`.
- [ ] `pnpm test:e2e` was run locally and passed — OR your report states why it could not run locally (environmental), with no spec/snapshot edits.
- [ ] `git status` shows only `.github/workflows/ci.yml` changed.
- [ ] `pnpm verify` passes.
- [ ] `plans/README.md` status row for 026 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm test:e2e` fails on a real spec or a snapshot mismatch (a genuine regression or
  intended-UI-change-without-updated-baseline) — report it; do not touch specs/snapshots.
- `ci.yml` or `release.yml` drifted from the "Current state" excerpts (someone already
  restructured CI).
- You're tempted to run e2e on `ubuntu-latest` to save cost — constraint 1 forbids it
  (no `-linux` snapshots); stop and report if `macos-14` seems unworkable.
- `pnpm verify` fails twice after a reasonable fix attempt.

## Maintenance notes

- macOS runner minutes cost ~10× ubuntu and the e2e job builds the app + launches Electron,
  so this lengthens CI. If the team later wants to bound cost, options (for a future
  decision, not this plan): run `e2e` only on `push` to `main` (not on every PR), or gate it
  behind a path filter. Do not silently drop it back to release-only without recording why.
- When intentional UI changes land, the `-darwin` snapshots must be regenerated with
  `pnpm test:e2e:update` (on macOS) and committed — otherwise this job goes red. That is the
  job doing its job; it is the signal the prior release-only setup lacked.
- This plan deliberately does not add `-linux`/`-win` baselines — Porcelain is macOS-only
  today (the `linux-port` branch is held; see `plans/README.md`).
