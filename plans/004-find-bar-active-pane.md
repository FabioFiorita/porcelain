# Plan 004: Cmd+F opens the find bar only in the active pane

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result before moving on. If a "STOP condition" occurs,
> stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/renderer/src/components/viewer/text-file-view.tsx src/renderer/src/components/viewer/file-content.tsx src/renderer/src/components/shell/viewer.tsx`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

In split view, **both** panes mount their own `TextFileView`, and each registers a
`window` keydown listener for Cmd+F with no "am I the active pane?" guard. So
pressing Cmd+F opens the find bar in **both** panes at once, regardless of which
one is focused — and the inactive pane's find bar competes for the match-highlight
state. It's a visible, reproducible defect any time two files are open side by
side. The fix scopes the listener to the active pane.

## Current state

The viewer dispatches a pane's active tab in `src/renderer/src/components/shell/viewer.tsx`.
`PaneView({ paneIndex })` renders the `file` kind as:
```tsx
case 'file':
  return <FileContent key={activeTab.path} path={activeTab.path} line={activeTab.line} />
```
In split view, `Viewer` renders two `<SplitPane paneIndex={0|1} />`, each of which
renders `<PaneView paneIndex={…} />`. The store tracks the focused pane as
`activePaneIndex` (set on pane `onMouseDown` via `setActivePane`). Unsplit, `Viewer`
returns a single `<PaneView paneIndex={0} />`.

`src/renderer/src/components/viewer/file-content.tsx` passes through to the text view:
```tsx
export function FileContent({ path, line }: { path: string; line?: number }): React.JSX.Element {
  ...
  return <TextFileView path={path} content={view.content} line={line} />
}
```

`src/renderer/src/components/viewer/text-file-view.tsx` — the offending listener
(lines ~52–61):
```tsx
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'f' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      setFinding(true)
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [])
```
`TextFileView`'s signature is `{ path, content, line }`. It does **not** currently
know its pane.

The store import pattern to copy (already used in `editor-source.tsx` and
`viewer.tsx`): `import { useTabsStore } from '@renderer/stores/tabs'`, then read the
current value imperatively with `useTabsStore.getState().activePaneIndex`.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm typecheck`                         | exit 0 |
| Tests     | `pnpm test -- text-file-view`            | the new test passes |
| Lint      | `pnpm lint`                              | exit 0 |
| Full gate | `pnpm verify`                            | all four pass |

## Suggested executor toolkit

- Component tests mock **domain hooks**, never the tRPC proxy. `TextFileView`
  itself uses only zustand stores (`useRepoStore`, `usePreferencesStore`,
  `useTabsStore`) — no domain hooks — so the test sets store state directly. Model
  the test file structure after `src/renderer/src/components/git/changes-list.test.tsx`
  (imports, `beforeEach` store reset, `render` from `@testing-library/react`).

## Scope

**In scope** (thread `paneIndex` down and guard the listener):
- `src/renderer/src/components/shell/viewer.tsx` (pass `paneIndex` to `FileContent`)
- `src/renderer/src/components/viewer/file-content.tsx` (accept + forward `paneIndex`)
- `src/renderer/src/components/viewer/text-file-view.tsx` (accept `paneIndex`, guard the listener)
- `src/renderer/src/components/viewer/text-file-view.test.tsx` (create)

**Out of scope** (do NOT touch):
- `find-bar.tsx` — its behavior is fine; the bug is *who opens it*, not the bar.
- The Cmd+P / Cmd+F ownership of any other component — only the in-file find listener.
- `editor-source.tsx`'s own Cmd+S handler — unrelated.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `fix(viewer): open the find bar only in the active split pane`.
- Do NOT push unless instructed.

## Steps

### Step 1: Thread `paneIndex` from `PaneView` into the `file` case

In `viewer.tsx`, the `file` case of `PaneView` passes `paneIndex` to `FileContent`:
```tsx
case 'file':
  return (
    <FileContent
      key={activeTab.path}
      path={activeTab.path}
      line={activeTab.line}
      paneIndex={paneIndex}
    />
  )
```
(`PaneView` already has `paneIndex` in scope.)

### Step 2: Forward `paneIndex` through `FileContent`

In `file-content.tsx`, add `paneIndex` to the props and pass it to `TextFileView`:
```tsx
export function FileContent({
  path,
  line,
  paneIndex,
}: { path: string; line?: number; paneIndex: number }): React.JSX.Element {
  ...
  return <TextFileView path={path} content={view.content} line={line} paneIndex={paneIndex} />
}
```

### Step 3: Guard the keydown listener with the active pane

In `text-file-view.tsx`:
- Add `import { useTabsStore } from '@renderer/stores/tabs'` (if not already imported).
- Add `paneIndex: number` to the destructured props/type.
- In the keydown handler, return early when this pane isn't active:
```tsx
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent): void => {
    if (useTabsStore.getState().activePaneIndex !== paneIndex) return
    if (e.key === 'f' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      setFinding(true)
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [paneIndex])
```
Read `activePaneIndex` from `getState()` **inside** the handler (not as a hook
dependency) so the listener isn't re-subscribed on every pane focus change. Keep
`paneIndex` in the deps array.

### Step 4: Add a component test

Create `src/renderer/src/components/viewer/text-file-view.test.tsx`. It mounts two
`TextFileView`s (paneIndex 0 and 1), sets `activePaneIndex` to 1, dispatches a
Cmd+F keydown on `window`, and asserts the find input (`aria-label="Find in file"`,
placeholder "Find in file…") appears **exactly once**. Then a second case: set
`activePaneIndex` to 0, fire Cmd+F, assert the find input appears once and is the
pane-0 instance.

Sketch (adapt imports/reset to match `changes-list.test.tsx`):
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { useTabsStore } from '@renderer/stores/tabs'
import { useRepoStore } from '@renderer/stores/repo'
import { TextFileView } from './text-file-view'

beforeEach(() => {
  useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } as never })
  // two panes so activePaneIndex is meaningful
  useTabsStore.setState({ activePaneIndex: 1 } as never)
})

test('Cmd+F opens the find bar only in the active pane', () => {
  render(
    <>
      <TextFileView path="/repo/a.ts" content={'const a = 1\n'} paneIndex={0} />
      <TextFileView path="/repo/b.ts" content={'const b = 2\n'} paneIndex={1} />
    </>,
  )
  fireEvent.keyDown(window, { key: 'f', metaKey: true })
  expect(screen.getAllByLabelText('Find in file')).toHaveLength(1)
})
```
If the store's `setState` shape needs more fields to avoid a render crash (e.g.
`panes`), inspect `src/renderer/src/stores/tabs.ts` for the initial state and seed
the minimum needed. The exemplar test files show how this repo seeds stores.

**Verify**: `pnpm test -- text-file-view` → the new test passes; before Step 3 it
would have found 2 inputs (sanity: you can confirm the bug by temporarily reverting
Step 3 and seeing the test fail with length 2).

### Step 5: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- New file `text-file-view.test.tsx`: (1) Cmd+F with pane 1 active → exactly one
  find bar; (2) Cmd+F with pane 0 active → exactly one find bar. Model structure on
  `changes-list.test.tsx`.
- Verification: `pnpm test -- text-file-view` → all pass.

## Done criteria

ALL must hold:

- [ ] `pnpm typecheck` exits 0 (the new `paneIndex` prop is required end-to-end)
- [ ] `pnpm test -- text-file-view` passes; the new test asserts exactly one find bar
- [ ] `pnpm verify` passes
- [ ] Only the four in-scope files are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `TextFileView` is mounted from somewhere **other** than `FileContent` (search:
  `grep -rn "TextFileView" src/renderer/src`) — a second caller would need
  `paneIndex` too, and that changes the plan's surface.
- Seeding the tabs/repo stores in the test crashes the render in a way that needs
  more than minimal state (report what `TextFileView` actually requires).
- The store's active-pane field is not named `activePaneIndex` in the live code
  (it is in `viewer.tsx` today) — report the actual name.

## Maintenance notes

- Any future tab kind that adds its own `window`-level Cmd+F (or similar
  pane-local global shortcut) must apply the same active-pane guard — the tiered
  keyboard-ownership rules in `.agents/skills/architecture/SKILL.md` ("Keyboard
  shortcuts — tiered ownership") put per-component toggles like this in the
  component, so the guard belongs here, not in `use-app-shortcuts.ts`.
- A reviewer should confirm the listener still works unsplit (single pane,
  `paneIndex` 0, `activePaneIndex` 0) — the guard must not break the common case.
