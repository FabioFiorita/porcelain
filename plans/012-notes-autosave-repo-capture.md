# Plan 012: Fix notes autosave flushing to the wrong repo on switch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/renderer/src/hooks/use-repo-notes.ts src/renderer/src/components/shell/notes-card.tsx src/renderer/src/components/shell/files-quick-access.tsx`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Category**: bug
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

The per-repo Notes card autosaves on an 800 ms debounce and also flushes pending
text when it unmounts (the card is keyed by repo, so switching repos unmounts it).
But the save closure resolves the **target repo at flush time** via
`useRepoStore.getState().repo?.path` — not the repo that was active when the user
typed. On a repo switch within the debounce window, the store updates to repo B
first, *then* the old card unmounts and flushes; the flush reads `getState()` =
repo B and writes repo A's note text into **repo B's** notes, silently corrupting
B and losing A's edit. The Notes card is one of only two surfaces that mutate
user-owned data, so a silent wrong-target write is a serious (if narrow) bug.

After this plan, the repo path is captured per card instance (the card is already
keyed by repo) and the save always targets the repo that was active when the text
was typed.

## Current state

- `src/renderer/src/hooks/use-repo-notes.ts` — the domain hook. `save` resolves
  the repo at call time (the bug):

  ```ts
  export function useSetRepoNotes(): { save: (notes: string) => void } {
    const utils = trpc.useUtils()
    const mutation = trpc.setRepoNotes.useMutation({
      onSuccess: () => utils.repoNotes.invalidate(),
    })
    return {
      save: (notes) => {
        const repoPath = useRepoStore.getState().repo?.path   // ← resolved at flush time
        if (!repoPath) return
        mutation.mutate({ repoPath, notes })
      },
    }
  }
  ```

- `src/renderer/src/components/shell/notes-card.tsx` — `NotesCard` (no props today)
  reads `useRepoNotes()` and renders `<NotesEditor initialMarkdown={notes} />`.
  `NotesEditor` calls `const { save } = useSetRepoNotes()` and, on the autosave
  timer and the unmount cleanup, runs `saveRef.current(editor)` → `save(next)`
  (`src/renderer/src/components/shell/notes-card.tsx:55-97`). The unmount flush:

  ```ts
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (editor) saveRef.current(editor)
    }
  }, [editor])
  ```

- `src/renderer/src/components/shell/files-quick-access.tsx` — renders the card,
  already keyed by repo path:

  ```ts
  const repoPath = useRepoStore((s) => s.repo?.path)
  …
  {/* remount per repo so the editor reloads that repo's notes */}
  <NotesCard key={repoPath ?? 'none'} />
  ```

Because the card is keyed by `repoPath`, each `NotesCard` instance's lifetime is
exactly one repo, and React unmounts the old instance with its last-committed
props (the old repo) when the key changes. So threading the repo path in as a prop
captures the correct target for the flush.

Convention: component tests mock the domain hook, never tRPC — see
`src/renderer/src/components/shell/notes-card.test.tsx` (mocks `useRepoNotes` /
`useSetRepoNotes`). Handlers/props typed inline; named exports only.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm typecheck`                 | exit 0              |
| Test (this) | `pnpm test notes-card`         | all pass            |
| Test (all) | `pnpm test`                     | all pass            |
| Lint      | `pnpm lint`                      | exit 0              |
| Build     | `pnpm build`                     | exit 0              |

## Scope

**In scope**:
- `src/renderer/src/hooks/use-repo-notes.ts` — `save` takes an explicit repo path
- `src/renderer/src/components/shell/notes-card.tsx` — accept + thread the repo path
- `src/renderer/src/components/shell/files-quick-access.tsx` — pass the repo path prop
- `src/renderer/src/components/shell/notes-card.test.tsx` — keep passing; add a guard

**Out of scope** (do NOT touch):
- `src/main/api.ts` `setRepoNotes` / `repoNotes` procedures — unchanged.
- The `useRepoNotes` (read) hook — reading the store is fine; only the WRITE path
  is the bug.
- The autosave timing/debounce — keep the 800 ms debounce and unmount-flush
  behavior exactly as-is; only the repo-targeting changes.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
full gate before committing. Conventional Commits; example:
`fix(notes): target autosave at the repo active when the note was typed`.

## Steps

### Step 1: Make `save` take an explicit repo path

In `src/renderer/src/hooks/use-repo-notes.ts`, change the `save` signature to
accept the repo path from the caller instead of reading `getState()`:

```ts
export function useSetRepoNotes(): { save: (repoPath: string | undefined, notes: string) => void } {
  const utils = trpc.useUtils()
  const mutation = trpc.setRepoNotes.useMutation({
    onSuccess: () => utils.repoNotes.invalidate(),
  })
  return {
    save: (repoPath, notes) => {
      if (!repoPath) return
      mutation.mutate({ repoPath, notes })
    },
  }
}
```

**Verify**: `pnpm typecheck` → now FAILS at the `NotesEditor` call site (it still
calls `save(next)` with one arg). That's expected — Step 2 fixes it.

### Step 2: Thread the repo path through `NotesCard` → `NotesEditor`

In `src/renderer/src/components/shell/notes-card.tsx`:

- Give `NotesCard` a `repoPath?: string` prop and pass it to `NotesEditor`:

  ```ts
  export function NotesCard({ repoPath }: { repoPath?: string }): React.JSX.Element {
    const notes = useRepoNotes()
    return (
      <div className="flex h-full flex-col border-t border-sidebar-border">
        <div className="flex h-7 shrink-0 items-center px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Notes
        </div>
        {notes === undefined ? (
          <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>
        ) : (
          <NotesEditor initialMarkdown={notes} repoPath={repoPath} />
        )}
      </div>
    )
  }
  ```

- Give `NotesEditor` a `repoPath?: string` prop and pass it to `save`:

  ```ts
  function NotesEditor({
    initialMarkdown,
    repoPath,
  }: {
    initialMarkdown: string
    repoPath?: string
  }): React.JSX.Element {
    const { save } = useSetRepoNotes()
    …
    saveRef.current = (editor: Editor): void => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const next = markdownOf(editor)
      if (next === savedRef.current) return
      savedRef.current = next
      save(repoPath, next)        // ← was save(next)
    }
    …
  }
  ```

  Leave everything else in `NotesEditor` (the debounce, the unmount flush effect,
  the toolbar) unchanged.

**Verify**: `pnpm typecheck` → still fails at the `FilesQuickAccess` call site
(`<NotesCard key=… />` now needs the prop). Step 3 fixes it.

### Step 3: Pass the repo path from `FilesQuickAccess`

In `src/renderer/src/components/shell/files-quick-access.tsx`, pass the same
`repoPath` it already computes for the key:

```ts
<NotesCard key={repoPath ?? 'none'} repoPath={repoPath} />
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Keep the component test green + add a guard

The existing `notes-card.test.tsx` mocks `useSetRepoNotes` as
`{ save: vi.fn() }`; a `vi.fn()` accepts the new 2-arg signature, so the existing
tests pass unchanged — confirm with `pnpm test notes-card`.

Add a lightweight guard test that renders `NotesCard` with a `repoPath` and
asserts it mounts without error (the wiring is now type-checked end-to-end; the
behavioral repo-capture is enforced by the type system + the `getState()` removal).
Model the render setup after the existing cases in the same file:

```ts
it('accepts a repoPath and renders the editor', async () => {
  vi.mocked(useRepoNotes).mockReturnValue('note')
  render(<NotesCard repoPath="/repo-a" />)
  expect(await screen.findByText('note')).toBeInTheDocument()
})
```

**Verify**: `pnpm test notes-card` → all pass.

### Step 5: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Test plan

- Keep all existing `notes-card.test.tsx` cases passing (the mock signature is
  compatible).
- Add the guard test above (renders with a `repoPath`).
- The core regression (flush targets the typed-at repo, not the switched-to repo)
  is enforced structurally: `save` no longer reads `getState()`, and the repo path
  is captured per keyed card instance. The `grep` done-criterion below locks that
  in.
- Verification: `pnpm test notes-card` → all pass; `pnpm test` → full suite green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0 (proves every `save(...)` call passes the repo path)
- [ ] `grep -n "getState" src/renderer/src/hooks/use-repo-notes.ts` returns NO
      match inside `useSetRepoNotes`'s `save` (the call-time resolution is gone)
- [ ] `pnpm test` exits 0; `notes-card.test.tsx` passes incl. the new guard
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `FilesQuickAccess` no longer keys `NotesCard` by `repoPath` (the capture
  assumption — that each card instance is one repo — would be invalid).
- `useRepoNotes` (read) is intertwined with the write in a way that makes the
  signature change cascade beyond the in-scope files.
- The existing `notes-card.test.tsx` cases fail for a reason other than the mock
  signature (report what changed).

## Maintenance notes

- For the reviewer: the fix relies on `NotesCard` being keyed by `repoPath` in
  `files-quick-access.tsx`. If that key is ever removed, the per-instance capture
  breaks and this bug returns — scrutinize any change to that key.
- The sibling editor `EditorSource` (`components/viewer/editor-source.tsx`) is
  already path-safe because it captures the absolute path in the `useWriteTextFile`
  mutation closure; this plan brings the Notes card to parity.
- Optional: a one-line `history` skill bullet noting the fix (bug fix, not an
  architectural decision, so not strictly required by hard rule 4).
