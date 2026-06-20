# Plan 003: Bring `src/test-setup.ts` under typechecking

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- tsconfig.web.json tsconfig.node.json src/test-setup.ts vitest.config.ts`
> If any changed since this plan was written, compare against "Current state"; on
> a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

`src/test-setup.ts` is the Vitest setup file (wires jest-dom, an `afterEach`
cleanup, and the `matchMedia` / `elementFromPoint` jsdom stubs that **every**
component test depends on). It sits at the `src/` root, but neither tsconfig's
`include` glob matches it:

- `tsconfig.node.json` includes `src/main/**`, `src/preload/**`, `src/mcp/**`.
- `tsconfig.web.json` includes `src/renderer/src/**/*` and `src/preload/*.d.ts`.

So `pnpm typecheck` (which runs both projects) **never type-checks the test
setup file**. A type error there — e.g. a wrong `MediaQueryList` stub shape, or a
broken jest-dom import — sails through the commit gate green and only fails at
`vitest` runtime. That's a real hole in the "the gate proves it compiles"
guarantee. This plan closes it by adding the file to the web project (it's
DOM/jsdom + React-test code).

## Current state

`src/test-setup.ts` (whole file) imports `@testing-library/jest-dom/vitest`,
`cleanup` from `@testing-library/react`, and `afterEach`/`vi` from `vitest`, and
defines a `document.elementFromPoint` stub and a `window.matchMedia` stub typed as
`MediaQueryList` — all DOM types, so it belongs to the **web** TS project.

`tsconfig.web.json` (whole file):
```jsonc
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.web.json",
  "include": [
    "src/renderer/src/env.d.ts",
    "src/renderer/src/**/*",
    "src/renderer/src/**/*.tsx",
    "src/preload/*.d.ts"
  ],
  "compilerOptions": {
    "composite": true,
    "jsx": "react-jsx",
    "ignoreDeprecations": "6.0",
    "baseUrl": ".",
    "paths": { "@renderer/*": ["src/renderer/src/*"], "@main/*": ["src/main/*"] }
  }
}
```

`vitest.config.ts` already references the file: `setupFiles: ['src/test-setup.ts']`.

Note: `src/preload/*.d.ts` is already included from a sibling of `src/renderer/src`,
so the project's inferred `rootDir` is `src/` — adding another `src/`-level file is
consistent with the existing include set and should not trigger a rootDir error.

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|--------------------------------|---------------------|
| Typecheck (web only) | `pnpm typecheck:web`| exit 0, no errors |
| Typecheck (both)     | `pnpm typecheck`    | exit 0, no errors |
| Tests     | `pnpm test`                    | all pass |
| Full gate | `pnpm verify`                  | all four pass |

## Scope

**In scope**:
- `tsconfig.web.json` (add the one include entry)

**Out of scope** (do NOT touch):
- `tsconfig.node.json` — the file is web/DOM code, not node.
- `vitest.config.ts` — already correct.
- `src/test-setup.ts` — only edit it if Step 2 surfaces a genuine type error in it
  (see STOP conditions); otherwise leave it.
- Do not add a third tsconfig or restructure the project references.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `chore(dx): typecheck src/test-setup.ts`.
- Do NOT push unless instructed.

## Steps

### Step 1: Add the file to the web project's includes

In `tsconfig.web.json`, add `"src/test-setup.ts"` to the `include` array (append
it after `"src/preload/*.d.ts"`).

### Step 2: Typecheck

**Verify**: `pnpm typecheck:web` → exit 0.

If it now reports a **type error inside `src/test-setup.ts`**, that is a latent
bug the gate was hiding — fix it minimally so the stubs typecheck (e.g. correct a
stub's shape), keeping behavior identical. Then re-run. If the error is instead a
**project/config error** (rootDir, composite, "file is not under rootDir",
duplicate-include), STOP and report — do not work around it by restructuring
tsconfigs.

### Step 3: Full gate

**Verify**: `pnpm verify` → lint, typecheck, test, build all pass. (`pnpm test`
must still pass — the setup file's runtime behavior is unchanged.)

## Test plan

- No new tests. The change *is* a verification improvement. The proof is that
  `pnpm typecheck` now compiles `src/test-setup.ts` (Step 2) and the existing
  suite still runs green (Step 3).
- Optional sanity that the file is genuinely covered now: temporarily introduce a
  deliberate type error in `src/test-setup.ts` (e.g. `const x: number = 'a'`),
  run `pnpm typecheck:web`, confirm it now FAILS, then revert. (Do this only to
  convince yourself; revert before finishing — the done criteria require a clean
  tree.)

## Done criteria

ALL must hold:

- [ ] `tsconfig.web.json` `include` contains `"src/test-setup.ts"`
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm verify` passes
- [ ] Only `tsconfig.web.json` (and `src/test-setup.ts` *only if* a real type error
      was fixed) are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Adding the file produces a TS **project/config** error (rootDir/composite/
  references) rather than a content error — report the exact message; the fix may
  need a dedicated test tsconfig, which is a larger decision than this plan.
- `src/test-setup.ts` has many type errors implying it was relying on being
  unchecked in a way that's not a quick fix — report them rather than rewriting
  the setup file wholesale.

## Maintenance notes

- If more root-level test infrastructure files are added later (e.g. a
  `src/test-utils.ts`), include them here too — the same gap would recur.
- A reviewer should confirm `pnpm typecheck:web` time didn't change meaningfully
  (one extra small file; it won't).
- `vitest.config.ts` and `playwright.config.ts` at the repo root are also outside
  both tsconfigs, but those are tool configs (not app/test code) and `pnpm build`/
  the e2e typecheck cover their relevant surface — out of scope here.
