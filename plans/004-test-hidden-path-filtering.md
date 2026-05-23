# Plan 004: Cover hidden-path filtering with unit tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 864f014..HEAD -- src/main/api.ts src/main/repo-config.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `864f014`, 2026-06-12

## Why this matters

Folder hiding is one of Porcelain's two headline differentiators: in a 50 GB
monorepo the user hides the parts they don't care about, and the Cmd+P file
finder must never surface a hidden file. That guarantee rests entirely on the
`visibleFiles` filter in `api.ts`, which has **subtle prefix logic** (it must
match both absolute hidden paths and repo-relative ones, must hide whole
subtrees, and must not false-match a sibling whose name shares a prefix) and
**zero tests**. A regression here silently leaks files the user explicitly hid —
a direct breach of the product promise — with nothing to catch it. This plan
extracts the filter into a pure, exported function and locks its behavior down
with unit tests. It is pure test/refactor hardening: no behavior change.

## Current state

- `src/main/api.ts` — the filter lives inline inside a memo wrapper:

```100:116:src/main/api.ts
function visibleFiles(repoPath: string, files: string[], hidden: ReadonlySet<string>): string[] {
  const hiddenKey = [...hidden].sort().join('\0')
  const cached = visibleFilesCache.get(repoPath)
  if (cached && cached.files === files && cached.hiddenKey === hiddenKey) return cached.visible
  const visible =
    hidden.size === 0
      ? files
      : files.filter((f) => {
          for (const h of hidden) {
            const rel = h.startsWith(`${repoPath}/`) ? h.slice(repoPath.length + 1) : h
            if (f === rel || f.startsWith(`${rel}/`)) return false
          }
          return true
        })
  visibleFilesCache.set(repoPath, { files, hiddenKey, visible })
  return visible
}
```

- It is consumed by the `searchFiles` procedure (the Cmd+P finder):

```350:359:src/main/api.ts
  searchFiles: t.procedure
    .input(z.object({ repoPath: z.string(), query: z.string() }))
    .query(async ({ input }): Promise<string[]> => {
      if (input.query.trim() === '') return []
      const [files, config] = await Promise.all([gitListFiles(input.repoPath), loadConfig()])
      const hidden = hiddenPathsFor(config, input.repoPath)
      return fuzzySearch(input.query, visibleFiles(input.repoPath, files, hidden), 50).map(
        (r) => r.path,
      )
    }),
```

- `hiddenPathsFor` (returns a `Set<string>` of stored hidden paths) and the rest
  of the per-repo config helpers live in `src/main/repo-config.ts`, which already
  has a sibling test file `src/main/repo-config.test.ts`. Hidden paths are stored
  as **absolute** paths (see the architecture notes and `withHiddenPath`), while
  `gitListFiles` returns **repo-relative** paths — which is exactly why the
  filter normalizes `h` against `repoPath` before comparing.

- **Conventions to follow** (verified during recon):
  - Pure logic + sibling Vitest test; `src/main/repo-config.test.ts` is the
    structural model (`describe`/`it`/`expect`, importing named exports).
  - Strict TS, no `any`, no `as` casts. No explanatory code comments (user rule);
    one short `/** */` doc header on the exported function is fine.
  - The memo cache in `api.ts` compares the input `files` array by identity
    (`cached.files === files`); preserve that behavior (see Step 2).

## Commands you will need

| Purpose   | Command                                | Expected on success |
|-----------|----------------------------------------|---------------------|
| Install   | `pnpm install`                         | exit 0              |
| Typecheck | `pnpm typecheck`                       | exit 0, no errors   |
| Test (one)| `pnpm test src/main/repo-config.test.ts` | all pass          |
| Test (all)| `pnpm test`                            | all pass            |
| Lint      | `pnpm lint`                            | exit 0              |
| Build     | `pnpm build`                           | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/main/repo-config.ts` (add the pure exported `visibleFilePaths` function)
- `src/main/repo-config.test.ts` (add a `describe('visibleFilePaths', …)` block)
- `src/main/api.ts` (call the extracted function from inside `visibleFiles`)

**Out of scope** (do NOT touch):
- The `visibleFilesCache` memo and its identity comparison in `api.ts` — keep the
  caching exactly as-is; only the inner filter body moves out.
- `gitListFiles` / `fuzzySearch` / `hiddenPathsFor` — unchanged.
- Any behavior change. This plan must not alter what `searchFiles` returns for
  any input; it only relocates and tests existing logic.

## Git workflow

- Branch: `advisor/004-test-hidden-path-filtering`
- Commit message style: `test: cover hidden-path filtering for the file finder`
  (or `refactor:` if you prefer to emphasize the extraction — either fits the log)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract the filter into a pure exported function

Add to `src/main/repo-config.ts` (place it near `hiddenPathsFor`):

```ts
/**
 * Repo-relative file paths with hidden entries removed. Hidden paths may be
 * absolute (under repoPath) or already repo-relative; a hidden directory hides
 * its whole subtree but never a sibling that merely shares a name prefix.
 */
export function visibleFilePaths(
  repoPath: string,
  files: readonly string[],
  hidden: ReadonlySet<string>,
): string[] {
  if (hidden.size === 0) return [...files]
  return files.filter((file) => {
    for (const h of hidden) {
      const rel = h.startsWith(`${repoPath}/`) ? h.slice(repoPath.length + 1) : h
      if (file === rel || file.startsWith(`${rel}/`)) return false
    }
    return true
  })
}
```

This is byte-for-byte the existing logic (the `hidden.size === 0` early return
now copies the array rather than aliasing it — the memo in Step 2 still caches
the result, so this runs at most once per change).

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Use the extracted function in `api.ts`

Replace the inline filter inside `visibleFiles` with a call to the new function,
keeping the surrounding memo intact. Add `visibleFilePaths` to the existing
import from `./repo-config` at the top of `api.ts` (no inline imports). Result:

```ts
function visibleFiles(repoPath: string, files: string[], hidden: ReadonlySet<string>): string[] {
  const hiddenKey = [...hidden].sort().join('\0')
  const cached = visibleFilesCache.get(repoPath)
  if (cached && cached.files === files && cached.hiddenKey === hiddenKey) return cached.visible
  const visible = visibleFilePaths(repoPath, files, hidden)
  visibleFilesCache.set(repoPath, { files, hiddenKey, visible })
  return visible
}
```

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0; `pnpm test` → all
prior tests still pass (no behavior change yet).

### Step 3: Add unit tests for `visibleFilePaths`

In `src/main/repo-config.test.ts`, add a `describe('visibleFilePaths', () => …)`
block. Use `new Set([...])` for the hidden arg and `'/repo'` as `repoPath`.
Cover at minimum:

- **no hidden entries** → returns all files unchanged
  - files `['src/a.ts', 'src/b.ts']`, hidden `{}` → both returned
- **absolute hidden directory hides its subtree**
  - hidden `{ '/repo/src/foo' }` → `src/foo/a.ts` and `src/foo` removed,
    `src/bar.ts` kept
- **repo-relative hidden directory also works**
  - hidden `{ 'src/foo' }` → `src/foo/a.ts` removed, `src/bar.ts` kept
- **no prefix false-positive**
  - hidden `{ 'src/foo' }` → `src/foobar.ts` is KEPT (must not be hidden)
- **exact file hidden**
  - hidden `{ '/repo/src/a.ts' }` → `src/a.ts` removed, `src/ab.ts` kept

**Verify**: `pnpm test src/main/repo-config.test.ts` → all pass, including the
new cases.

## Test plan

- Add the `visibleFilePaths` describe block to `src/main/repo-config.test.ts`
  covering the 5 cases in Step 3 (empty, absolute-dir subtree, relative-dir,
  prefix non-match, exact file).
- Structural pattern: the existing `describe`/`it` blocks in the same file.
- Verification: `pnpm test` → 56 prior tests pass plus the new cases.

## Done criteria

ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0; new `visibleFilePaths` cases exist and pass
- [ ] `pnpm build` exits 0
- [ ] `visibleFilePaths` is exported from `repo-config.ts` and called by
      `visibleFiles` in `api.ts`; the `visibleFilesCache` memo is unchanged
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `visibleFiles` function or `searchFiles` procedure no longer matches the
  "Current state" excerpts.
- Extracting the function changes any test outcome in the existing suite (it
  should not — this is behavior-preserving).
- You find the prefix-matching logic is actually wrong (e.g. a case where a
  hidden file genuinely leaks) — that is a real bug; report it with the failing
  case rather than "fixing" it silently, so the change is reviewed deliberately.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- If hidden paths ever start being stored as repo-relative (instead of absolute),
  the `rel` normalization in `visibleFilePaths` becomes a no-op but stays correct;
  the tests covering both forms guard that transition.
- A reviewer should confirm no behavior change: the diff in `api.ts` should be a
  pure substitution of the inline filter for the function call.
- This filter only protects the Cmd+P finder. The file *tree* hides entries in
  the `readDir` procedure separately; if a future feature lists files through a
  third path, it must also route through `visibleFilePaths`.
