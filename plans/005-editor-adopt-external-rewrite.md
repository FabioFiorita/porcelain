# Plan 005: Editor adopts an external rewrite that arrived mid-edit

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result before moving on. If a "STOP condition" occurs,
> stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/renderer/src/components/viewer/editor-source.tsx`
> If it changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP — the adoption logic is subtle and the fix depends on its exact
> shape.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

`EditorSource` keeps the open file in local state and adopts an **external**
rewrite (the coding agent editing the file in the terminal — a core Porcelain
workflow) **only when there's nothing unsaved to lose**. The intent is correct,
but the bookkeeping has an ordering bug: the "last seen external content" ref is
advanced **before** the "only adopt when clean" guard. So when an external change
arrives while the user has unsaved edits, the change is skipped (correct) **but
the ref has already moved past it** — and once the buffer later returns to a clean
state, the effect sees "external content unchanged" and never adopts it. Result:
the viewer shows stale content that no longer matches disk, and never reconciles
until a *further* external edit happens. Silent divergence between disk and the
viewer in the exact agent-edits-while-I'm-looking scenario the feature exists for.

## Current state

`src/renderer/src/components/viewer/editor-source.tsx`, the adoption effect
(lines ~81–95), verbatim:
```tsx
// Adopt an external rewrite of this file — readFile refetches with new content
// when the coding agent edits it in the terminal — but ONLY when there's nothing
// unsaved to lose. Mid-edit, the user's in-progress text wins; we never clobber
// it. (The read-only/reader views render straight from the prop; only this editor
// keeps a local copy that needs syncing.) Tracked via a ref so we react to a real
// prop change, not to our own keystrokes updating `content`.
const lastInitial = useRef(initialContent)
useEffect(() => {
  if (initialContent === lastInitial.current) return
  lastInitial.current = initialContent          // <-- advanced BEFORE the guard
  if (content === savedContent) {
    setContent(initialContent)
    setSavedContent(initialContent)
  }
}, [initialContent, content, savedContent])
```

Relevant surrounding facts (already in the file):
- `content` = the live buffer (`useState`), `savedContent` = last persisted value;
  `dirty` ⇔ `content !== savedContent`.
- `save`/autosave (`saveRef`, `AUTOSAVE_DELAY_MS = 800`) sets `savedContent = content`
  and writes to disk; an unmount effect flushes the pending save.
- The prop `initialContent` is the freshly-read file content; it changes when
  `readFile` is invalidated (a `working-tree` push event fires after an external
  edit — see `use-app-events.ts`).

**The bug trace** (why the current order is wrong):
1. clean: `content=V1, saved=V1, lastInitial=V1`.
2. user types: `content=USER, saved=V1` (dirty); `lastInitial` still `V1`.
3. agent writes `V2` → `initialContent=V2`. Effect runs: `V2 !== V1` →
   **`lastInitial=V2`**; `content(USER) !== saved(V1)` → skip adoption.
4. user reverts their edit (or any path back to clean): `content=V1=saved`. Effect
   runs (content changed): `initialContent(V2) === lastInitial(V2)` → early return.
   **Viewer stuck on V1; disk has V2.**

## The fix

Only advance `lastInitial.current` when adoption actually happens — i.e. move the
assignment **inside** the `content === savedContent` block:
```tsx
const lastInitial = useRef(initialContent)
useEffect(() => {
  if (initialContent === lastInitial.current) return
  // Only "consume" the external change once we actually adopt it. If we skip
  // because of unsaved edits, leave lastInitial behind so the change is
  // re-evaluated (and adopted) the next time the buffer is clean.
  if (content === savedContent) {
    lastInitial.current = initialContent
    setContent(initialContent)
    setSavedContent(initialContent)
  }
}, [initialContent, content, savedContent])
```

Re-trace with the fix: at step 3, the skip leaves `lastInitial=V1`; at step 4, when
clean, `V2 !== V1` → adopt V2, `lastInitial=V2`. Viewer = disk. Correct. The
mid-edit "don't clobber" behavior is unchanged (still skipped while dirty).

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `pnpm typecheck`                     | exit 0 |
| Tests     | `pnpm test -- editor-source`         | new test passes |
| Lint      | `pnpm lint`                          | exit 0 |
| Full gate | `pnpm verify`                        | all four pass |

## Suggested executor toolkit

- `EditorSource` uses the domain hook `useWriteTextFile` (`@renderer/hooks/use-files`)
  and `usePathActions`. Component tests in this repo **mock domain hooks** — mock
  `@renderer/hooks/use-files` so `useWriteTextFile` returns `{ save: vi.fn(), isSaving: false, error: null }`,
  and mock `./use-path-actions` to return no-op callbacks. Model the mock style on
  `src/renderer/src/components/git/changes-list.test.tsx`.

## Scope

**In scope**:
- `src/renderer/src/components/viewer/editor-source.tsx` (the 1-block change above)
- `src/renderer/src/components/viewer/editor-source.test.tsx` (create)

**Out of scope** (do NOT touch):
- The autosave/`saveRef` logic, the Cmd+S handler, the context menu, the
  tokenization (`useTokenizedLines`) — none of it changes.
- The "don't clobber mid-edit" behavior — preserve it exactly; this plan only fixes
  the *deferred re-evaluation*, not the skip-while-dirty rule.
- `file-content.tsx` / `text-file-view.tsx` (the read-only and reader views already
  render straight from the prop and have no local copy to sync).

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `fix(editor): adopt an external rewrite once edits are saved/reverted`.
- Do NOT push unless instructed.

## Steps

### Step 1: Move the `lastInitial.current` assignment inside the clean guard

Apply the change shown in "The fix" above. Keep the comment updated to explain why
the assignment is now conditional.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Add a regression test

Create `src/renderer/src/components/viewer/editor-source.test.tsx`. With
`useWriteTextFile` mocked (so no real IPC and no real autosave write), cover three
cases driven by re-rendering the component with a changed `initialContent` prop and
by firing `change` events on the textarea (`aria-label` is `Edit <path>`):

1. **Clean adoption still works (regression guard)**: render with
   `initialContent="V1"`; rerender with `initialContent="V2"` (no edits in between);
   assert the textarea value is now `"V2"`.
2. **Mid-edit is not clobbered**: render `"V1"`; `fireEvent.change` the textarea to
   `"USER"`; rerender with `initialContent="V2"`; assert the textarea value is still
   `"USER"`.
3. **Deferred adoption after returning to clean (the fix)**: continue from case 2's
   state (buffer `"USER"`, external prop `"V2"`); `fireEvent.change` the textarea
   back to `"V1"` (the original saved value, making the buffer clean again); assert
   the textarea value becomes `"V2"`.

Sketch:
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('@renderer/hooks/use-files', () => ({
  useWriteTextFile: () => ({ save: vi.fn(), isSaving: false, error: null }),
}))
vi.mock('./use-path-actions', () => ({
  usePathActions: () => ({
    findReferences: vi.fn(), exploreFlow: vi.fn(), copyPath: vi.fn(),
    copyRelativePath: vi.fn(), reveal: vi.fn(),
  }),
}))

import { EditorSource } from './editor-source'

test('adopts an external rewrite once the buffer is clean again', () => {
  const { rerender } = render(<EditorSource path="/repo/a.ts" initialContent="V1" />)
  const ta = () => screen.getByLabelText('Edit /repo/a.ts') as HTMLTextAreaElement
  fireEvent.change(ta(), { target: { value: 'USER' } })   // dirty
  rerender(<EditorSource path="/repo/a.ts" initialContent="V2" />) // external change, skipped
  expect(ta().value).toBe('USER')                          // not clobbered
  fireEvent.change(ta(), { target: { value: 'V1' } })      // back to clean (== savedContent)
  expect(ta().value).toBe('V2')                            // now adopted
})
```
If `pinTab` (called inside `edit`) needs the tabs store seeded to avoid a crash,
seed it in `beforeEach` (inspect `stores/tabs.ts` for the minimal shape and the
`tabId` helper). The exemplar component tests show the seeding pattern.

**Verify**: `pnpm test -- editor-source` → all cases pass. (Confirm the test is
meaningful: with Step 1 reverted, case 3 fails — the value stays `"V1"`.)

### Step 3: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- `editor-source.test.tsx`: the three cases above (clean adoption regression guard,
  mid-edit not clobbered, deferred adoption after clean). Mock the write hook and
  path-actions hook.
- Verification: `pnpm test -- editor-source` → all pass.

## Done criteria

ALL must hold:

- [ ] In `editor-source.tsx`, `lastInitial.current = initialContent` occurs **only**
      inside the `content === savedContent` block
- [ ] `pnpm test -- editor-source` passes; case 3 (deferred adoption) is present and
      green, and demonstrably fails if Step 1 is reverted
- [ ] `pnpm verify` passes
- [ ] Only the two in-scope files are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The adoption effect in the live code no longer matches the "Current state"
  excerpt (it was refactored since `b224765`) — the one-block move may no longer be
  the right fix.
- Seeding the tabs store for `pinTab` requires non-obvious state that crashes the
  render — report what `edit()`/`pinTab` need rather than guessing.
- You find a *different* place that also clobbers in-progress edits — note it, do
  not fix it here (out of scope).

## Maintenance notes

- This interacts with the file watcher (`file-watch.ts` → `working-tree` event →
  `readFile` invalidate) that produces the changed `initialContent`. If that push
  path changes (e.g. debouncing, or carrying a version), re-verify the adoption
  still fires when the buffer is clean.
- A reviewer should confirm the "never clobber mid-edit" invariant in
  `.agents/skills/architecture/SKILL.md` ("The editor adopts external file changes
  ONLY when clean") still holds — this fix preserves it and additionally fixes the
  deferred re-adoption; it must not flip to "always adopt".
