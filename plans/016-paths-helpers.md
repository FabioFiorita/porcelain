# Plan 016: Add `fileName`/`dirName` to `lib/paths.ts` and replace the inline reimplementations

> **Executor instructions**: Follow step by step. Run every verification command and
> confirm the expected result. If a "STOP condition" occurs, stop and report. When
> done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/renderer/src/lib/paths.ts src/renderer/src/lib/paths.test.ts`
> If either changed since this plan was written, compare against "Current state"; on
> a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

Basename/dirname is reimplemented inline ~17 times across ~7 components
(`split('/').at(-1)`, `split('/').slice(0, -1).join('/')`, `lastIndexOf('/')`),
while `lib/paths.ts` already exists with `relativeTo` but no `fileName`/`dirName`.
The duplication is error-prone (three different idioms for the same thing) and the
inline forms allocate arrays. Centralizing into two tested helpers removes the
repetition and standardizes on the efficient `lastIndexOf` form. Pure refactor, no
behavior change.

## Current state

`src/renderer/src/lib/paths.ts` (whole file):
```ts
export function relativeTo(repoPath: string | undefined, path: string): string {
  return repoPath && path.startsWith(`${repoPath}/`) ? path.slice(repoPath.length + 1) : path
}
```
(`paths.test.ts` already exists for `relativeTo` — extend it.)

Representative inline call sites (confirmed):
- `changes-list.tsx`: `const name = file.path.split('/').at(-1) ?? file.path` and
  `file.path.split('/').slice(0, -1).join('/')` (the dir line).
- `feature-list.tsx`: `const name = file.path.split('/').at(-1) ?? file.path` and
  `const dir = file.path.split('/').slice(0, -1).join('/')`.
- `tree-node.tsx`: `entry.path.slice(0, entry.path.lastIndexOf('/'))`.
- The clean-code audit also lists: `search-list.tsx`, `file-finder.tsx`,
  `comments-group.tsx`, `content-search.tsx`, `search-view.tsx`.

Find all of them with:
`grep -rn "split('/').at(-1)\|split('/').slice(0, -1).join('/')\|lastIndexOf('/')" src/renderer/src`

## The helpers to add

```ts
/** The last path segment (basename). `fileName('a/b/c.ts') === 'c.ts'`; no slash → the input. */
export function fileName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/** Everything before the last slash (dirname). `dirName('a/b/c.ts') === 'a/b'`; no slash → ''. */
export function dirName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}
```

**Behavior parity to preserve at call sites:**
- `split('/').at(-1) ?? file.path` returned the **whole input** when there was no
  slash → `fileName` returns the same (no slash → input). ✔
- `split('/').slice(0, -1).join('/')` returned `''` for a no-slash path → `dirName`
  returns `''`. ✔
- `slice(0, lastIndexOf('/'))` for a no-slash path returned `slice(0, -1)` (drops the
  last char — a latent quirk!). `dirName` returns `''` instead, which is the
  **correct** dirname. Verify each `lastIndexOf`-based site only runs on paths known
  to contain a slash (they do — tree entries are absolute) so the corrected behavior
  is safe; if any site could receive a slash-less path and relied on the old quirk,
  STOP and report.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Tests     | `pnpm test -- paths`       | new cases pass |
| Typecheck | `pnpm typecheck`           | exit 0 |
| Lint      | `pnpm lint`                | exit 0 |
| Full gate | `pnpm verify`              | all four pass |

## Scope

**In scope**:
- `src/renderer/src/lib/paths.ts` (add `fileName`/`dirName`)
- `src/renderer/src/lib/paths.test.ts` (add cases)
- The call sites: `changes-list.tsx`, `feature-list.tsx`, `tree-node.tsx`,
  `search-list.tsx`, `file-finder.tsx`, `comments-group.tsx`, `content-search.tsx`,
  `search-view.tsx` — **only** the basename/dirname expressions, replaced with the
  helper calls.

**Out of scope** (do NOT touch):
- `relativeTo` — unchanged.
- Any logic other than the basename/dirname extraction at each site. Do not refactor
  surrounding code.
- Main-process path handling (`src/main`) — it uses Node's `path` module; this helper
  is renderer-only.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `refactor(paths): extract fileName/dirName, drop inline reimplementations`.
- Do NOT push unless instructed.

## Steps

### Step 1: Add the helpers + tests

Add `fileName`/`dirName` to `paths.ts`. In `paths.test.ts`, add cases: basename and
dirname for `a/b/c.ts`, a slash-less name (`fileName('x') === 'x'`, `dirName('x') === ''`),
a leading-slash absolute path, and a trailing-name-only path.

**Verify**: `pnpm test -- paths` → pass.

### Step 2: Replace the call sites

For each site found by the grep, replace the inline expression with `fileName(p)` /
`dirName(p)` and add the import `import { dirName, fileName } from '@renderer/lib/paths'`
(or extend the existing `paths` import). Keep any `?? file.path` fallback only if the
site needs it — `fileName` already returns the input for a slash-less path, so the
`?? file.path` becomes redundant and can be dropped (the value is identical).

### Step 3: Verify no inline reimplementations remain

**Verify**:
`grep -rn "split('/').at(-1)\|split('/').slice(0, -1).join('/')" src/renderer/src`
→ no matches (the `lastIndexOf('/')` form may legitimately remain inside
`paths.ts` itself — exclude that file when checking).

### Step 4: Full gate

**Verify**: `pnpm verify` → all four pass (typecheck confirms every replaced site
still type-checks; the component tests confirm rendering is unchanged).

## Test plan

- `paths.test.ts`: `fileName`/`dirName` over normal, slash-less, absolute, and
  edge paths (Step 1).
- The existing component tests (`changes-list.test.tsx`, etc.) confirm the replaced
  sites render identically.
- Verification: `pnpm test -- paths` + `pnpm verify`.

## Done criteria

ALL must hold:

- [ ] `paths.ts` exports `fileName` and `dirName`, both tested
- [ ] No `split('/').at(-1)` / `split('/').slice(0, -1).join('/')` reimplementations
      remain in `src/renderer/src` (grep clean)
- [ ] `pnpm verify` passes
- [ ] No behavior change at any call site (component tests pass)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- A `lastIndexOf('/')`-based site relied on the old slash-less quirk (`slice(0, -1)`
  dropping a char) in a way that `dirName` changes — report the site; don't silently
  alter behavior.
- A call site's basename/dirname feeds something where the `?? file.path` fallback
  matters beyond what `fileName` already provides — keep the fallback and note it.

## Maintenance notes

- New components needing basename/dirname should import these helpers, not re-inline
  the split — consider a Biome lint note if the pattern recurs.
- These are renderer helpers (string-only, no Node `path`); the main process keeps
  using `node:path`. Don't unify the two — they have different environments.
