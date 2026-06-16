# Plan 013: Key every viewer tab branch by its identity

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/renderer/src/components/shell/viewer.tsx`
> If it changed since this plan was written, compare the "Current state" excerpt
> against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Category**: bug
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

The viewer dispatches the active tab's kind to a view component in `PaneView`
(`viewer.tsx`). Only the `file` case is keyed by its identity (`key={activeTab.path}`);
the `diff`, `commit`, `search`, and `explore` cases reuse the single component
instance across tab switches. Combined with `keepPreviousData` on the diff query
(`use-diff.ts:14`, `placeholderData: keepPreviousData`), switching between two open
diff tabs renders the **previous** file's hunks under the **new** file's header
until the new query resolves — a brief but real wrong-content display. The same
unkeyed-instance reuse lets `CommitView`'s locally-held `selected` file leak across
commit-tab switches (it requests a diff for the new commit + the old file's path),
and any local state in the search/explore views carries over.

After this plan, each non-`file` branch gets a fresh component instance keyed by
its identity prop — matching the existing `file` convention — so switching tabs
never shows stale content or leaks local state.

## Current state

`PaneView` in `src/renderer/src/components/shell/viewer.tsx:60-83`:

```ts
function PaneView({ paneIndex }: { paneIndex: number }): React.JSX.Element {
  const activeTab = useTabsStore((s) => {
    const pane = s.panes[paneIndex]
    return pane?.tabs.find((t) => t.id === pane.activeTabId)
  })

  if (!activeTab) return <EmptyViewer />

  switch (activeTab.kind) {
    case 'diff':
      return <DiffView filePath={activeTab.path} />
    case 'commit':
      return <CommitView hash={activeTab.path} />
    case 'search':
      return <SearchView query={activeTab.path} />
    case 'feature':
      return <FeatureView />
    case 'explore':
      return <ExploreView path={activeTab.path} symbol={activeTab.symbol} />
    case 'file':
      // keyed by path so edit state never leaks across tab switches
      return <FileContent key={activeTab.path} path={activeTab.path} line={activeTab.line} />
  }
}
```

Notes:
- `activeTab.path` is overloaded per kind: file path (`diff`), commit hash
  (`commit`), query string (`search`), seed file path (`explore`). `explore` also
  carries an optional `activeTab.symbol`.
- `feature` has no per-tab identity (the `FeatureView` reads the global active
  review set), so it does NOT need a key.
- The `switch` has an annotated return type and no `default`, so it stays
  exhaustive — do not add a `default` branch.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `pnpm install`   | exit 0              |
| Typecheck | `pnpm typecheck` | exit 0              |
| Test (all) | `pnpm test`     | all pass            |
| Lint      | `pnpm lint`      | exit 0              |
| Build     | `pnpm build`     | exit 0              |

## Scope

**In scope**:
- `src/renderer/src/components/shell/viewer.tsx` — add keys to the `diff`,
  `commit`, `search`, and `explore` branches.

**Out of scope** (do NOT touch):
- The `feature` branch (no per-tab identity — leave unkeyed).
- The `file` branch (already keyed).
- `use-diff.ts` / `DiffView` / `CommitView` / `SearchView` / `ExploreView` — the
  `keepPreviousData` on the diff query stays (it's correct for refetch-in-place on
  the *same* file); keying fixes the cross-file reuse without removing it.
- Do NOT add a `default` case to the switch.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
full gate before committing. Conventional Commits; example:
`fix(viewer): key each tab branch so switching never shows stale content`.

## Steps

### Step 1: Key the four non-`file`, non-`feature` branches

Edit the `switch` so each identity-bearing branch is keyed:

```ts
    case 'diff':
      return <DiffView key={activeTab.path} filePath={activeTab.path} />
    case 'commit':
      return <CommitView key={activeTab.path} hash={activeTab.path} />
    case 'search':
      return <SearchView key={activeTab.path} query={activeTab.path} />
    case 'feature':
      return <FeatureView />
    case 'explore':
      return (
        <ExploreView
          key={`${activeTab.path}:${activeTab.symbol ?? ''}`}
          path={activeTab.path}
          symbol={activeTab.symbol}
        />
      )
```

(Keep the `file` and `feature` branches exactly as they are.)

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Test plan

- This is a structural React-keying change; it has no new unit-testable pure
  logic. The existing component tests (`changes-list.test.tsx`,
  `history-list.test.tsx`, `feature-list.test.tsx`) and the Playwright e2e
  (`pnpm test:e2e`, run by the maintainer per the release gate) cover that the
  views still render.
- Verification relies on the full gate passing plus the grep done-criterion that
  the keys are present.
- (Optional, if you want a behavioral guard the repo doesn't currently have:
  manual check in `pnpm dev` — open two diff tabs on different files, switch
  between them, confirm the hunks always match the header. Not required for
  done.)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "key=" src/renderer/src/components/shell/viewer.tsx` shows keys on
      the `DiffView`, `CommitView`, `SearchView`, and `ExploreView` branches (plus
      the pre-existing `FileContent`)
- [ ] The `feature` branch remains unkeyed; the switch has no `default` case
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `PaneView`'s switch no longer matches the "Current state" excerpt (e.g. a new
  tab kind was added) — key the new kind by its identity too, but confirm first.
- Keying a branch causes a test or build failure that isn't an obvious import/JSX
  issue (report it).

## Maintenance notes

- For the reviewer: the rule is "every identity-bearing tab branch is keyed by its
  identity, like the `file` branch." When a new tab kind is added (per the
  architecture skill's 8-step recipe), key its branch in `PaneView` too.
- The `keepPreviousData` on `useDiffFile` is deliberately kept — it gives smooth
  refetch-in-place when the *same* file's diff changes; keying only prevents reuse
  across *different* files.
