# Plan 008: Mark-as-reviewed — track review progress on the Changes list

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If anything in
> the "STOP conditions" section occurs, stop and report — do not improvise. This repo is
> **hyper-uniform**: there is exactly one way to do everything, and this feature is a
> near-mechanical copy of the existing per-repo `pinnedPaths` feature. When in doubt,
> mirror `pinnedPaths`. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e1f8d02..HEAD -- src/main/repo-config.ts src/main/api.ts src/renderer/src/components/git/changes-list.tsx`
> If any changed since this plan was written, compare the "Current state" excerpts
> against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (additive per-repo config + one list surface; mirrors `pinnedPaths`)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

Porcelain's identity is *reviewing* changes, but there's no way to track **what you've
already reviewed**. On a large changeset you lose your place every time you switch tabs.
GitHub's "Viewed" checkbox solves exactly this. This adds a per-repo "reviewed" flag per
changed file, a toggle in the Changes-list row context menu, a muted/checked row when
reviewed, and a "N reviewed" count in the Changes-list header — so you can work through a
review and see progress.

The whole feature is a near-mechanical clone of the existing `pinnedPaths` per-repo
feature (config field → pure helpers → tRPC procedures → domain hook → list UI), which
keeps it low-risk and uniform.

## Current state

The exact pattern to clone is `pinnedPaths`. Read all of these before starting.

- `src/main/repo-config.ts` — per-repo config. The schema (lines 4–17) and the
  pinned helpers (lines 109–135) are your template:
  ```ts
  export const appConfigSchema = z.object({
    recentRepos: z.array(z.string()).default([]),
    repos: z.record(z.string(), z.object({
      hiddenPaths: z.array(z.string()).default([]),
      pinnedPaths: z.array(z.string()).default([]),
      layers: z.array(z.object({ label: z.string(), pattern: z.string() })).optional(),
      notes: z.string().default(''),
    })).default({}),
  })
  // …
  const emptyRepo = (): AppConfig['repos'][string] => ({ hiddenPaths: [], pinnedPaths: [], notes: '' })
  // …
  export function withPinnedPath(config, repoPath, path) { /* immutable add, dedupe */ }
  export function withoutPinnedPath(config, repoPath, path) { /* immutable remove */ }
  export function pinnedPathsFor(config, repoPath): string[] { return config.repos[repoPath]?.pinnedPaths ?? [] }
  ```
- `src/main/repo-config.test.ts` — the test exemplar for these pure helpers (mirror its
  pinned-path cases for the reviewed-path ones).
- `src/main/api.ts` — the pin procedures (lines 280–290) are the template for the
  mutations:
  ```ts
  pinPath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await updateConfig((config) => withPinnedPath(config, input.repoPath, input.path))
    }),
  unpinPath: t.procedure /* … withoutPinnedPath … */,
  ```
  and `pinnedEntries` (line 292) shows the read-query shape (loads config, returns data).
  `updateConfig` and `loadConfig` are already imported in `api.ts`.
- `src/renderer/src/components/git/changes-list.tsx` — the surface. Key facts:
  - `FlowFile.path` is the **repo-relative** path (e.g. `src/foo.ts`) — this is the key
    you store as "reviewed".
  - `FileRow` (lines 35–129) already has a `ContextMenu` with items **Open file** /
    **Stage** / **Unstage** (lines 111–122). You add the reviewed toggle here.
  - The `ChangesList` header (lines 143–150) shows `{total} changed files` + a refresh
    button — you add the reviewed count here:
    ```tsx
    const total = groups.reduce((n, g) => n + g.files.length, 0)
    // …
    <span className="text-xs text-muted-foreground">
      {total} changed {total === 1 ? 'file' : 'files'}
    </span>
    ```
  - `FileRow` already receives `repoPath` as a prop (passed from `ChangesList`).
- `src/renderer/src/components/git/changes-list.test.tsx` — the component-test exemplar:
  it **mocks the domain hooks** (never the tRPC proxy) and uses `@main` types for mock
  data. Your new tests mock the new reviewed hook the same way.
- `src/renderer/src/hooks/use-files.ts` — read `useEntryActions` (around line 79) to see
  how a mutation hook owns its invalidation (`onSuccess` → `Promise.all([...invalidate])`).

**Repo conventions that apply** (from the `architecture` skill — follow exactly):
- Data fetching is **TanStack Query via domain hooks**. Components NEVER import
  `@renderer/lib/trpc` (Biome forbids it in `components/**`). All server access goes
  through a `hooks/use-<domain>.ts` hook that owns its post-mutation invalidation.
- One public component per file; named exports; explicit return types; handlers named by
  intent (`toggle`, not `handleToggle`); `cn()` for conditional classes.
- shadcn primitives only; no `any`/`as unknown as`; no `void` on promises (use `await`).
- Conventional Commits (`feat(changes): …`).

## Commands you will need

| Purpose        | Command                          | Expected on success     |
|----------------|----------------------------------|-------------------------|
| Install        | `pnpm install`                   | exit 0                  |
| Lint           | `pnpm lint`                      | exit 0                  |
| Typecheck      | `pnpm typecheck`                 | exit 0, no errors       |
| Tests          | `pnpm test`                      | all pass                |
| Config tests   | `pnpm test -- repo-config`       | reviewed-path cases pass|
| List tests     | `pnpm test -- changes-list`      | new cases pass          |
| Build          | `pnpm build`                     | exit 0                  |

Full gate before committing (hard rule 3): `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Scope

**In scope** (the only files you may modify/create):
- `src/main/repo-config.ts` — add `reviewedPaths` field + three helpers.
- `src/main/repo-config.test.ts` — test the helpers.
- `src/main/api.ts` — add `markReviewed` / `unmarkReviewed` mutations + `reviewedPaths` query.
- `src/renderer/src/hooks/use-reviewed.ts` — **create**; the domain hook.
- `src/renderer/src/components/git/changes-list.tsx` — row toggle + indicator + header count.
- `src/renderer/src/components/git/changes-list.test.tsx` — new cases.

**Out of scope** (do NOT touch):
- `src/renderer/src/components/git/feature-list.tsx` — Feature-list parity is a
  deliberate fast-follow (the rows have no context menu yet; same hook reuses there
  later). Do not add it here.
- The `pinnedPaths` code — read it, copy the *pattern*, never modify the original.
- Any reset-on-content-change logic — a reviewed flag that auto-clears when the file
  changes is a deferred enhancement (see Maintenance notes). v1 is a manual toggle.

## Steps

### Step 1: Add the `reviewedPaths` config field + pure helpers

In `src/main/repo-config.ts`:
1. Add `reviewedPaths: z.array(z.string()).default([])` to the per-repo object in
   `appConfigSchema` (next to `pinnedPaths`).
2. Add `reviewedPaths: []` to `emptyRepo()`.
3. Add `withReviewedPath(config, repoPath, path)`, `withoutReviewedPath(config, repoPath, path)`,
   and `reviewedPathsFor(config, repoPath): string[]` — exact copies of the `pinned`
   trio (lines 109–135) with the field renamed.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Test the helpers

In `src/main/repo-config.test.ts`, mirror the existing pinned-path tests for the new
trio: add to a fresh config, dedupe a double-add, remove, no-op removing a missing path,
and `reviewedPathsFor` on an unknown repo returns `[]`.

**Verify**: `pnpm test -- repo-config` → all pass including the new cases.

### Step 3: Add the tRPC procedures

In `src/main/api.ts`, next to `pinPath`/`unpinPath` (lines 280–290) add:
- `markReviewed` — input `{ repoPath, path }`, mutation calling
  `updateConfig((c) => withReviewedPath(c, input.repoPath, input.path))`.
- `unmarkReviewed` — same shape with `withoutReviewedPath`.
- `reviewedPaths` — input `z.string()` (the repoPath), query returning
  `reviewedPathsFor(await loadConfig(), input)` as `Promise<string[]>` (mirror how
  `pinnedEntries` loads config, but you only need the string array).

Import `withReviewedPath` / `withoutReviewedPath` / `reviewedPathsFor` from
`./repo-config` (add to the existing import).

**Verify**: `pnpm typecheck` → exit 0 (the `AppRouter` type updates automatically).

### Step 4: Create the domain hook `use-reviewed.ts`

`src/renderer/src/hooks/use-reviewed.ts` exporting:
- `useReviewedPaths(): Set<string>` — wraps `trpc.reviewedPaths.useQuery(repo?.path ?? '', { enabled: repo !== null })`, returns the result as a `Set` for O(1) membership (default to empty set while loading).
- `useToggleReviewed(): { mark: (path: string) => Promise<void>; unmark: (path: string) => Promise<void> }`
  — wraps the two mutations; **each `onSuccess` invalidates `reviewedPaths`** via
  `utils.reviewedPaths.invalidate()` (hooks own invalidation). Use `repo.path` for the
  mutation input. Model the structure on `useFileStaging` in
  `src/renderer/src/hooks/use-commit.ts` (read it — same two-mutation + invalidation shape).

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: Wire the Changes-list row toggle + indicator + header count

In `src/renderer/src/components/git/changes-list.tsx`:
1. `ChangesList`: call `const reviewed = useReviewedPaths()`. Compute the reviewed count
   over **currently-changed** files only (so stale config entries can't inflate it):
   ```tsx
   const reviewedCount = groups.reduce(
     (n, g) => n + g.files.filter((f) => reviewed.has(f.path)).length, 0)
   ```
   Render it in the header next to the total, e.g. `{total} changed · {reviewedCount} reviewed`
   (only show the `· N reviewed` clause when `reviewedCount > 0`). Pass `reviewed` down to
   each `FileRow` as a prop (`isReviewed={reviewed.has(file.path)}`).
2. `FileRow`: accept `isReviewed: boolean`; call `const { mark, unmark } = useToggleReviewed()`.
   - Add a context-menu item: when `isReviewed`, **"Unmark reviewed"** → `unmark(file.path)`;
     else **"Mark reviewed"** → `mark(file.path)`. Place it as the first item (above
     "Open file"). Use `await` inside the handler (no `void`).
   - Indicate the reviewed state on the row: when `isReviewed`, add a muted look to the
     filename (`cn('truncate', isReviewed && 'text-muted-foreground line-through')`) and a
     small `Check` icon (from `lucide-react`) before the name. Keep it subtle and
     shadcn/Tailwind-token based (no literal colors — use `text-success` for the check, in
     keeping with the repo's tokenized-color rule).

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 6: Test the surface

In `changes-list.test.tsx`, mock `@renderer/hooks/use-reviewed` (both `useReviewedPaths`
returning a `Set` and `useToggleReviewed` returning `vi.fn()`s), following how the file
already mocks `use-git-flow`/`use-commit`. Add cases:
- A row whose path is in the reviewed set renders the reviewed indicator (e.g. the
  filename has `line-through`, or a `Check`/`aria-label` is present — assert on whatever
  you rendered).
- Right-click → "Mark reviewed" on an un-reviewed row calls `mark` once with the path;
  "Unmark reviewed" on a reviewed row calls `unmark`. (The file already confirms Base UI
  `ContextMenu` opens in jsdom via `fireEvent.contextMenu` — see existing Open-file/Stage
  cases.)
- The header shows the reviewed count when ≥1 file is reviewed.

**Verify**: `pnpm test -- changes-list` → all pass including the new cases.

### Step 7: Full gate + index

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.
Update this plan's row in `plans/README.md` to DONE.

## Test plan

- `repo-config.test.ts`: reviewed-path helper cases (add/dedupe/remove/no-op/empty),
  mirroring the pinned-path cases already there.
- `changes-list.test.tsx`: reviewed indicator renders, context-menu toggle calls the
  mutation, header count shows — mocking `use-reviewed` (never the tRPC proxy).
- Verification: `pnpm test` → all pass, including the new config + component cases.

## Done criteria

ALL must hold:

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all exit 0.
- [ ] `grep -n "reviewedPaths" src/main/repo-config.ts` shows the field + three helpers.
- [ ] `grep -n "markReviewed\|unmarkReviewed\|reviewedPaths" src/main/api.ts` shows the
      two mutations + the query.
- [ ] `src/renderer/src/hooks/use-reviewed.ts` exists; no component imports
      `@renderer/lib/trpc` (`grep -rn "lib/trpc" src/renderer/src/components/git/changes-list.tsx`
      returns nothing).
- [ ] Right-clicking a Changes-list row offers Mark/Unmark reviewed; reviewed rows render
      a distinct indicator; the header shows a reviewed count.
- [ ] New tests for the config helpers and the list surface exist and pass.
- [ ] No files outside the in-scope list are modified (`git status`); `feature-list.tsx`
      untouched.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The `pinnedPaths` pattern in `repo-config.ts`/`api.ts` doesn't match the excerpts
  (drift) — the whole plan is "clone pinnedPaths," so a changed template means re-read
  before cloning.
- `updateConfig`/`loadConfig` are not importable in `api.ts` as shown — find how config
  mutations are actually performed now and match that.
- A verification fails twice after a reasonable fix.
- You're tempted to touch `feature-list.tsx` or add reset-on-change logic — both are out
  of scope by design.

## Maintenance notes

- **Reviewed state is keyed by repo-relative path and is a manual toggle** — it does NOT
  auto-clear when a file's content changes after you marked it reviewed. The header count
  is computed over currently-changed files, so stale config entries never inflate it, but
  a file you reviewed then re-edited will still show "reviewed." A future enhancement
  could store a content hash per reviewed path and clear when it changes (GitHub's
  behavior); deferred to keep v1 simple.
- **Feature-list parity is the natural fast-follow**: the same `use-reviewed` hook +
  toggle apply to `feature-list.tsx` rows, but those rows have no context menu yet, so it
  needs a small affordance (a context menu, or a click-target check). Scoped out here.
- Reviewer should scrutinize: that the new hook owns its invalidation (no blanket
  `utils.invalidate()`), that no component imports `lib/trpc` directly, and that colors
  go through tokens (`text-success`/`text-muted-foreground`), not literal Tailwind scales.
