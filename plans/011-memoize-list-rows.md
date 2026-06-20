# Plan 011: Memoize the change/feature/tree row components

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/renderer/src/components/git/changes-list.tsx src/renderer/src/components/git/feature-list.tsx src/renderer/src/components/shell/tree-node.tsx`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

`React.memo` appears exactly **once** in the entire renderer (`EditorLine` in
`editor-source.tsx`). The sidebar list rows — `FileRow` (Changes), `FlowNode`
(Feature), `TreeNode` (file tree) — are plain function components, so when their
parent re-renders (the Changes/Feature lists re-render whenever the 3-second
`gitFlow`/`featureView` poll returns changed data — i.e. on **every file the
coding agent touches** during a loop), **all** rows re-render wholesale, each
rebuilding a `ContextMenu` + `AlertDialog` (+ `CommentComposer` for `FileRow`). On
a feature touching 100–200 files that's 100–200 full row-subtree re-renders per
touched file. Memoizing the rows cuts this to only the rows whose data actually
changed.

**Key fact that makes this a one-line-per-component fix**: each row receives only
**stable-by-value props**. The `file`/`entry` objects keep referential identity
across polls (TanStack Query v5 does structural sharing — unchanged nested objects
keep their reference), and the other props are primitives (`repoPath`,
`isReviewed` boolean, `base` string|undefined, `layer` string|null). The inline
`onClick`/`onMouseEnter` closures that the prior audit worried about ("P4") live
**inside** each row and are passed to the row's *children*, not to the row itself —
so they do **not** defeat the row's own `memo`. No callback hoisting is required.

## Current state

All three rows are defined as plain functions and mapped directly:

- `src/renderer/src/components/git/changes-list.tsx`:
  - `function FileRow({ file, repoPath, isReviewed, base }): React.JSX.Element` (line ~60)
  - mapped at line ~320: `group.files.map((file) => (<FileRow key={file.path} file={file} repoPath={repo.path} isReviewed={reviewed.has(file.path)} base={base} />))`
  - `FileRow` is module-private (not exported).
- `src/renderer/src/components/git/feature-list.tsx`:
  - `function FlowNode({ file, repoPath, layer }): React.JSX.Element` (line ~32)
  - mapped at line ~268: `flow.map(({ file, layer }, i) => (<FlowNode key={file.path} file={file} repoPath={repo.path} layer={layer === flow[i - 1]?.layer ? null : layer} />))`
  - `FlowNode` is module-private. (`SourceMarker` is also exported from this file —
    leave it alone; it is not a list row.)
- `src/renderer/src/components/shell/tree-node.tsx`:
  - `export function TreeNode({ entry }): React.JSX.Element` (line ~199) — **exported**
    and **recursively** rendered by `DirNode` (`<TreeNode key={child.path} entry={child} />`, line ~324).

`memo` is imported in this repo as `import { memo } from 'react'` (see
`editor-source.tsx:25`, `editor-source.tsx:34`: `const EditorLine = memo(CodeLine)`).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm typecheck`                         | exit 0 |
| Tests     | `pnpm test -- changes-list feature reading-surface` | existing component tests pass |
| Lint      | `pnpm lint`                              | exit 0 |
| Full gate | `pnpm verify`                            | all four pass |

## Scope

**In scope** (wrap each row in `memo`):
- `src/renderer/src/components/git/changes-list.tsx`
- `src/renderer/src/components/git/feature-list.tsx`
- `src/renderer/src/components/shell/tree-node.tsx`

**Out of scope** (do NOT touch):
- Do NOT hoist or `useCallback` the inline `onClick`/`onMouseEnter` closures — they
  are not props to the memoized rows, so they don't matter for this optimization.
  (If a future change passes a closure *as a prop to a row*, revisit.)
- Do NOT add a custom comparator to `memo` — the default shallow prop comparison is
  correct here (all props are stable-by-value).
- `SourceMarker` (feature-list), `EntryContextMenu`/`DirNode` (tree-node) internals,
  history-list / search-list rows — out of scope for this plan (history/search lists
  aren't on the hot 3s-poll path; keep this change tight).
- The list containers (`ChangesList`/`FeatureList`/`FileTree`) — unchanged.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `perf(lists): memoize change/feature/tree rows`.
- Do NOT push unless instructed.

## Steps

### Step 1: Memoize `FileRow`

In `changes-list.tsx`, add `memo` to the `react` import, and wrap the row:
change `function FileRow({ … }): React.JSX.Element { … }` into a memoized
component. Two equivalent shapes — pick the one that keeps the diff smallest:
- Rename the function to `FileRowImpl` and add `const FileRow = memo(FileRowImpl)`, or
- Keep the function and reassign: define `function FileRow(...)` then export/use a
  `const MemoFileRow = memo(FileRow)` at the map site.
Prefer the first (a single `memo(...)` wrapper next to the definition, mirroring
`EditorLine = memo(CodeLine)`).

### Step 2: Memoize `FlowNode`

Same treatment in `feature-list.tsx` for `FlowNode`.

### Step 3: Memoize `TreeNode` (mind the recursion + the export)

In `tree-node.tsx`, `TreeNode` is exported and recursively rendered. Wrap it so the
exported name stays `TreeNode`:
```tsx
function TreeNodeImpl({ entry }: { entry: DirEntry }): React.JSX.Element { … }
export const TreeNode = memo(TreeNodeImpl)
```
The recursive `<TreeNode … />` inside `DirNode` (defined later in the file) resolves
to the exported `const` — verify the file still compiles. Keep `DirNode` and
`EntryContextMenu` as plain functions (not memoized) — they're rendered once per
`TreeNode` and gain nothing here.

### Step 4: Typecheck and run the affected component tests

**Verify**: `pnpm typecheck` → exit 0.
**Verify**: `pnpm test -- changes-list feature reading-surface` → the existing
component tests still pass (they render `FileRow`s and feature rows; memo must not
change output).

### Step 5: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- No new behavior, so no new behavioral test. Correctness ("memo didn't change what
  renders") is covered by the existing `changes-list.test.tsx` and the
  reading-surface/feature tests.
- **Optional** render-count guard (only if straightforward): add a test that renders
  `ChangesList` (with the `gitFlow`/reviewed hooks mocked, per
  `changes-list.test.tsx`), re-renders with an identical `groups` reference, and
  asserts a spied row body runs fewer times. This is brittle (depends on mock
  identity), so it's optional — do not block the plan on it. If you add it, model
  the hook-mocking on `changes-list.test.tsx`.

## Done criteria

ALL must hold:

- [ ] `FileRow`, `FlowNode`, and `TreeNode` are each wrapped in `memo`
      (`grep -n "memo(" src/renderer/src/components/git/changes-list.tsx src/renderer/src/components/git/feature-list.tsx src/renderer/src/components/shell/tree-node.tsx` shows three wraps)
- [ ] `TreeNode` is still a named export and the file compiles (recursion intact)
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test -- changes-list feature reading-surface` passes
- [ ] `pnpm verify` passes
- [ ] No `memo` custom comparator was added; no inline closures were hoisted
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Any row's props turn out **not** to be stable-by-value (e.g. a row is being passed
  a freshly-built object/array literal as a prop from the list) — that would mean
  `memo` is a no-op and the prop must be stabilized first. Report the prop.
- Wrapping `TreeNode` breaks the recursive render (a "used before defined" or
  circular-reference error) — report it; the `const TreeNode = memo(TreeNodeImpl)`
  form should avoid it, but flag if not.
- The existing component tests fail after wrapping — memo changed observable output,
  which means a prop wasn't actually stable; report rather than forcing it.

## Maintenance notes

- If a list row is ever given a callback prop from its parent, that callback must be
  `useCallback`-stabilized or the `memo` is defeated — this is the "P4" trap. Today
  none of these rows take callback props; keep it that way.
- This pairs with the main-side `flowCache`/`featureViewCache` (which preserve the
  same `groups` object on a no-op poll) — that cache is what makes the row props
  referentially stable across polls. If those caches' keys change (see the perf
  invariant in `.agents/skills/audit/SKILL.md`), re-verify rows still skip on no-op
  polls.
- A reviewer should confirm no `memo` comparator was added and that selection/reveal
  highlighting still updates (those go through fine-grained store selectors inside
  the rows, not through props, so memo doesn't block them).
