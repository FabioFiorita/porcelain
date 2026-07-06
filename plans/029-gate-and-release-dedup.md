# Plan 029: Stop typechecking twice per gate and building twice per release

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- package.json .github/workflows/ci.yml .github/workflows/release.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

`pnpm verify` is hook-enforced before **every commit**, and it currently runs
the full two-project typecheck twice (~10s of pure repetition per commit, ~40%
of the gate's fixed cost outside the test suite). The release workflow is worse:
it typechecks three times and runs the full `electron-vite build` twice on the
slowest runner (macos-14) — and ships the *second* build while e2e validated
the *first*, so the artifact that ships is not the artifact that was tested.
Both fixes are pure script/workflow reshuffles.

## Current state

`package.json` scripts (the relevant ones, verbatim):

```json
"typecheck": "npm run typecheck:node && npm run typecheck:web",
"build": "npm run typecheck && electron-vite build",
"dist": "npm run build && electron-builder --mac --publish never",
"release": "npm run build && electron-builder --mac --publish always",
"test": "vitest run",
"test:e2e": "npm run build && PLAYWRIGHT_FORCE_ASYNC_LOADER=1 playwright test",
"verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
```

So `verify` = lint → typecheck → test → (**typecheck again** → electron-vite build).

`.github/workflows/ci.yml` (whole job): checkout → pnpm/node setup (`cache:
pnpm`) → `pnpm install --frozen-lockfile` → `pnpm verify` → `pnpm typecheck:e2e`.
CI therefore also typechecks twice.

`.github/workflows/release.yml:24-41` (steps in order): `pnpm install` →
`pnpm lint` → `pnpm typecheck` → `pnpm test` → `playwright install` →
`pnpm test:e2e` (= **build #1** incl. typecheck #2) → ensure-draft-release →
`pnpm release` (= **build #2** incl. typecheck #3, then electron-builder).

Constraints to preserve:

- `build` must stay self-sufficiently safe for anyone running `pnpm dist` /
  `pnpm release` locally without `verify` first — so keep the typecheck **inside
  `build`** and drop the standalone step from `verify` instead (the error just
  surfaces during the build step rather than before it).
- The e2e suite MUST run against a fresh build (`test:e2e`'s embedded build
  exists because Playwright launches `out/main/index.js`); the release reorder
  must keep "one build, then e2e against it, then publish IT".
- `PLAYWRIGHT_FORCE_ASYNC_LOADER=1` is REQUIRED on any script that invokes
  `playwright test` (documented trap: Node ≥22.15 sync-loader crash).
- The git-guard hook runs `pnpm verify` verbatim — no hook change needed as
  long as the script name keeps working.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Gate      | `time pnpm verify`                        | exit 0; wall-time drops ~10s vs before |
| e2e (opt) | `pnpm test:e2e`                           | passes (macOS only; slow — only if asked) |

## Scope

**In scope**:
- `package.json` (scripts block only)
- `.github/workflows/release.yml`

**Out of scope**:
- `.github/workflows/ci.yml` — it runs `pnpm verify`, which this plan fixes
  transitively; don't edit the workflow itself.
- `.claude/hooks/git-guard.sh` — it invokes `pnpm verify` by name; unchanged.
- `.github/workflows/pages.yml`, `electron-builder.yml`, signing/notarization
  env — untouched.
- Vitest/tsc configs.

## Git workflow

- Commit straight to `main` (branch creation hook-blocked; verify hook-enforced).
  Do NOT push (the release workflow change takes effect on the next tag push —
  the maintainer does that).
- Message: `dx: verify typechecks once (build carries it); release builds once and ships the e2e-tested artifact`

## Steps

### Step 1: De-duplicate `verify`

In `package.json`, change:

```json
"verify": "pnpm lint && pnpm test && pnpm build",
```

(`build` still runs `typecheck` → nothing is lost; it just runs once.)

**Verify**: `time pnpm verify` → exit 0, and the output shows `typecheck:node`/
`typecheck:web` running exactly once (grep the log). Compare wall-time against
a pre-change run if convenient.

### Step 2: Split e2e from its embedded build

Add one script (keep `test:e2e` working as today for local use):

```json
"test:e2e:prebuilt": "PLAYWRIGHT_FORCE_ASYNC_LOADER=1 playwright test",
```

and a publish-only release step:

```json
"release:prebuilt": "electron-builder --mac --publish always",
```

**Verify**: `pnpm run` lists both; `pnpm typecheck` still exits 0 (no code change).

### Step 3: Reorder the release workflow to build once

In `.github/workflows/release.yml`, replace the step sequence
`pnpm test:e2e` … `pnpm release` with:

```yaml
      - run: pnpm test
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e:prebuilt
      - name: Ensure draft release exists
        ...unchanged...
      - name: Build and publish to GitHub Releases
        run: pnpm release:prebuilt
        env:
          ...unchanged env block...
```

and DELETE the now-redundant standalone `pnpm typecheck` step (the `pnpm build`
step carries it). Keep `pnpm lint` and `pnpm test` as-is. Net effect: one
typecheck, one electron-vite build, e2e runs against the exact `out/` that
electron-builder then packages.

**Verify**: `pnpm exec node -e "require('js-yaml')"` isn't available — instead
validate YAML by eye + `git diff`; the real proof is the next tag push (see
Done criteria note).

### Step 4: Full gate

**Verify**: `pnpm verify` → exit 0.

## Test plan

No unit tests — script plumbing. The verification is Step 1's single-typecheck
log check and (deferred to the next release) a green release run. If the
maintainer wants pre-verification of the workflow, `act` is NOT set up in this
repo — don't introduce it.

## Done criteria

- [ ] `pnpm verify` exits 0 and its log contains exactly one `typecheck:node` run
- [ ] `grep -c "npm run build" package.json` → `test:e2e` still has its embedded
      build; `test:e2e:prebuilt` and `release:prebuilt` exist without one
- [ ] `.github/workflows/release.yml` contains exactly one `pnpm build` and no
      standalone `pnpm typecheck` step
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated — with a note that the release-path
      half is **unproven until the next tag push** (expected; flag it for the
      maintainer's next release)

## STOP conditions

- The git-guard hook turns out to invoke the gate steps individually rather
  than `pnpm verify` (check `.claude/hooks/git-guard.sh` before Step 1) — align
  with what it actually runs, or report.
- `electron-builder` in `release:prebuilt` triggers a rebuild anyway (it should
  not — `release` only chained `build` via the script). If its output shows it
  compiling the app again, report before merging the workflow change.

## Maintenance notes

- The invariant to keep: **exactly one** path in each pipeline owns the
  typecheck (`build`), and the released artifact is the e2e-tested one. A
  future script edit that re-chains `typecheck` into `verify` or `build` into a
  playwright script re-introduces the waste — reviewers should eyeball the
  scripts block on any package.json diff.
- The `releasing` skill describes the release flow — after the first successful
  release with this shape, update its runbook wording if it narrates the old
  step order (don't pre-update docs for an unproven pipeline).
