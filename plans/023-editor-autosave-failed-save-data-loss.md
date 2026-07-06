# Plan 023: A failed autosave keeps the buffer dirty instead of silently losing the edit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/renderer/src/components/viewer/editor-source.tsx src/renderer/src/hooks/use-files.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

The editor advances its "saved" watermark **before** the save request resolves.
When a `writeTextFile` mutation fails (permission error, disk full, path
vanished), the buffer therefore *looks* clean (`content === savedContent`), and
two silent data-loss paths open:

1. The unmount flush (`saveRef.current()` on tab close / mode switch) early-returns
   on `content === savedContent`, so the failed save is **never retried** —
   closing the tab discards the user's text while the file on disk still holds
   the old content.
2. The external-adopt effect (which pulls in on-disk changes made by the coding
   agent) adopts whenever `content === savedContent` — so the next `readFile`
   refetch **overwrites the user's unsaved text** with the on-disk content.

Porcelain's product promise is "text files are always editable in place with
debounced autosave — no save button". A save failure must surface as a dirty
buffer + error badge, not as a clean-looking buffer that evaporates.

## Current state

- [src/renderer/src/components/viewer/editor-source.tsx](../src/renderer/src/components/viewer/editor-source.tsx) —
  the in-place editor (textarea over a Shiki mirror).
- [src/renderer/src/hooks/use-files.ts](../src/renderer/src/hooks/use-files.ts) —
  `useWriteTextFile`, the domain hook wrapping the `writeTextFile` tRPC mutation.

The optimistic watermark advance, `editor-source.tsx:58-64`:

```ts
const saveRef = useRef<() => void>(() => {})
saveRef.current = (): void => {
  if (timerRef.current) clearTimeout(timerRef.current)
  if (content === savedContent) return
  setSavedContent(content)   // <-- advanced BEFORE the mutation settles
  save(content)              // <-- fire-and-forget (mutation.mutate)
}
```

The hook has an `onSuccess` but **no `onError` and no rollback**, `use-files.ts:87-108`:

```ts
export function useWriteTextFile(path: string): {
  save: (content: string) => void
  isSaving: boolean
  error: { message: string } | null
} {
  const utils = trpc.useUtils()
  const mutation = trpc.writeTextFile.useMutation({
    onSuccess: async (_data, variables) => {
      // the edit changes git state too, not just the file
      await Promise.all([
        utils.readFile.invalidate(variables.path),
        utils.gitFlow.invalidate(),
        utils.gitDiffFile.invalidate(),
      ])
    },
  })
  return {
    save: (content) => mutation.mutate({ path, content }),
    isSaving: mutation.isPending,
    error: mutation.error,
  }
}
```

The external-adopt effect that clobbers after a failed save, `editor-source.tsx:88-99`:

```ts
const lastInitial = useRef(initialContent)
useEffect(() => {
  if (initialContent === lastInitial.current) return
  if (content === savedContent) {          // <-- true after a FAILED save too
    lastInitial.current = initialContent
    setContent(initialContent)
    setSavedContent(initialContent)
  }
}, [initialContent, content, savedContent])
```

The unmount flush, `editor-source.tsx:75-80` (calls `saveRef.current()`, which
early-returns when the watermark already advanced).

The dirty indicator, `editor-source.tsx:132` and `186-198`: `dirty = content !== savedContent`;
the footer badge shows `saveError.message`, else `Saving…`, else `Unsaved`.

Repo conventions that apply:

- Hooks own their mutations and invalidation; components consume hooks
  (`use-files.ts` is the exemplar — match its shape).
- Never `void` a promise; never `any` / `as unknown as`.
- TanStack Query v5: `mutation.mutate(vars, { onSuccess })` per-call callbacks
  run in addition to the hook-level ones and are the sanctioned way to give the
  caller a completion signal without exposing the raw mutation.
- Component tests mock the **domain hook**, never the tRPC proxy — exemplars
  `src/renderer/src/components/git/changes-list.test.tsx`,
  `history-list.test.tsx`. Setup facts: `src/test-setup.ts` wires jest-dom +
  `afterEach(cleanup)`; import test APIs from `'vitest'` (globals off).

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Lint      | `pnpm lint`                      | exit 0              |
| Typecheck | `pnpm typecheck`                 | exit 0              |
| One test  | `pnpm test -- editor-source`     | all pass            |
| Full gate | `pnpm verify`                    | exit 0 (lint+typecheck+test+build) |

## Scope

**In scope** (the only files you should modify/create):
- `src/renderer/src/components/viewer/editor-source.tsx`
- `src/renderer/src/hooks/use-files.ts`
- `src/renderer/src/components/viewer/editor-source.test.tsx` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/backend/api.ts` (`writeTextFile` procedure) — the server side is correct;
  this is purely a client watermark bug.
- The external-adopt effect's *policy* (adopt only when clean) — it is a
  documented decision (architecture skill: "The editor adopts external file
  changes ONLY when clean"). Do not make it always/never adopt; the fix is to
  make "clean" truthful.
- `read-only`/reader views — they render from props and have no save path.

## Git workflow

- Commit **straight to `main`** — this repo hard-blocks branch creation via its
  git-guard hook and runs `pnpm verify` before any commit (both enforced).
  Do NOT create a branch. Do NOT push.
- Message style: Conventional Commits, e.g.
  `fix: keep the editor buffer dirty when an autosave fails — the watermark advanced before the write settled, so the unmount flush no-oped and the external adopt clobbered the edit`

## Steps

### Step 1: Give the save call a completion signal

In `use-files.ts`, change `useWriteTextFile`'s returned `save` so the caller can
react to success without owning the mutation:

```ts
save: (content, onSaved) => mutation.mutate({ path, content }, { onSuccess: onSaved }),
```

with the signature `save: (content: string, onSaved?: () => void) => void`.
Keep the hook-level `onSuccess` (invalidation) untouched — per-call and
hook-level callbacks both run in v5.

**Verify**: `pnpm typecheck` → exit 0 (the widened signature compiles; the one
caller is `editor-source.tsx`).

### Step 2: Advance the watermark only on success

In `editor-source.tsx`, rewrite `saveRef.current` so `setSavedContent` happens
in the completion callback, pinned to the *saved* content (not whatever
`content` is by then — the user may have kept typing, and that newer text must
stay dirty):

```ts
saveRef.current = (): void => {
  if (timerRef.current) clearTimeout(timerRef.current)
  if (content === savedContent) return
  const snapshot = content
  save(snapshot, () => setSavedContent(snapshot))
}
```

Notes:
- A success callback firing after unmount is a state update on an unmounted
  component — React 18+ treats that as a no-op; no guard needed.
- After a *failed* save, `savedContent` stays at the last truly-saved value, so
  `dirty` stays true, the `Unsaved` badge persists (the `saveError` badge takes
  precedence per the existing footer ternary), the unmount flush retries the
  write, and the adopt effect refuses to clobber. That is the whole fix.

**Verify**: `pnpm test -- editor-source` (will fail until Step 3 adds the test
file — run `pnpm typecheck` here instead → exit 0).

### Step 3: Characterization tests

Create `src/renderer/src/components/viewer/editor-source.test.tsx`. Mock the
domain hook (never `lib/trpc`):

```ts
const save = vi.fn()
vi.mock('@renderer/hooks/use-files', () => ({
  useWriteTextFile: () => ({ save, isSaving: false, error: null }),
}))
```

Drive the debounce with `vi.useFakeTimers()` (the autosave delay is
`AUTOSAVE_DELAY_MS = 800`, `editor-source.tsx:32`). `EditorSource` renders a
`ContextMenu` and a textarea labelled `Edit <path>` — query by role/label.
Also mock `./use-path-actions` (it pulls hooks that need providers): return
no-op functions for `findReferences`, `exploreFlow`, `copyPath`,
`copyRelativePath`, `reveal`.

Cases (name them like this):

1. **failed save keeps the buffer dirty** — type into the textarea, advance
   timers past 800ms, assert `save` was called with the new text; do NOT invoke
   the `onSaved` callback (simulating failure); assert the `Unsaved` badge is
   still in the document.
2. **failed save blocks external adopt** — same setup, then rerender with a new
   `initialContent` prop; assert the textarea still shows the user's text, not
   the new prop.
3. **successful save marks clean and allows adopt** — same setup, but invoke the
   captured `onSaved` callback (`save.mock.calls[0][1]()` inside `act`); assert
   the `Unsaved` badge is gone; rerender with new `initialContent`; assert the
   textarea now shows the external content.
4. **typing during an in-flight save stays dirty after it lands** — type "a",
   fire the debounce, type "ab" before invoking `onSaved` for "a"; invoke it;
   assert the badge still shows `Unsaved` (watermark pinned to the snapshot).

**Verify**: `pnpm test -- editor-source` → 4 tests pass.

### Step 4: Full gate

**Verify**: `pnpm verify` → exit 0.

## Test plan

Covered by Step 3 (the four named cases). Structural pattern:
`src/renderer/src/components/git/changes-list.test.tsx` (hook-mocked component
test). No e2e needed — the failure path can't be driven from Playwright without
fault injection.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm verify` exits 0
- [ ] `pnpm test -- editor-source` shows ≥4 passing tests including one named
      like `failed save keeps the buffer dirty`
- [ ] `grep -n "setSavedContent(content)" src/renderer/src/components/viewer/editor-source.tsx`
      returns no match inside `saveRef.current` (the optimistic advance is gone;
      the adopt effect's `setSavedContent(initialContent)` remains)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the "Current state" locations doesn't match the excerpts.
- `useWriteTextFile` has grown other callers (currently `editor-source.tsx` is
  the only one — check with `grep -rn "useWriteTextFile" src/`); a second caller
  means the signature change needs their review too.
- The test for case 2 fails because the adopt effect fires before the save
  debounce — that would mean the effect's dependency timing changed; report
  rather than reworking the effect.

## Maintenance notes

- If a retry mechanism is ever added to autosave, it should key off the same
  "watermark only advances on success" rule — never re-introduce an optimistic
  `setSavedContent`.
- Reviewer should scrutinize: the snapshot capture in Step 2 (must pin the
  callback to `snapshot`, not `content`), and that the hook-level invalidation
  `onSuccess` still runs (per-call options do not replace hook-level ones).
- Deferred deliberately: surfacing a toast on save failure (the inline badge
  already shows `saveError.message`; a toast is a design call, not a bug fix).
