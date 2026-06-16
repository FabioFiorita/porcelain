# Plan 009: Project-wide content search (Cmd+Shift+F)

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If anything in
> "STOP conditions" occurs, stop and report — do not improvise. This feature **reuses the
> existing grep backend** (`searchText` → `gitGrep`) and mirrors the existing Cmd+P file
> finder overlay; you are adding one overlay component + a keybinding, not new
> infrastructure. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e1f8d02..HEAD -- src/renderer/src/components/shell/file-finder.tsx src/renderer/src/hooks/use-search.ts src/renderer/src/components/viewer/search-view.tsx src/main/api.ts`
> If any changed since this plan was written, compare the "Current state" excerpts
> against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (additive overlay; reuses the grep backend + the Cmd+P pattern)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

Search today is **filename fuzzy** (Cmd+P) and **single-symbol find-references** (right-
click → Find references, which `git grep`s one exact string). There is no general "find
this text across the repo" surface — the everyday "where is this string used?" search.
The backend already exists (`searchText` procedure → `gitGrep`, and a results view
`SearchView`); this adds the missing entry point: a Cmd+Shift+F overlay, modeled exactly
on the Cmd+P file finder, that greps the repo live and jumps to a match.

## Current state

Everything you need already exists; you're wiring an entry point.

- `src/main/git.ts` — `gitGrep(repoPath, query)` (line ~231) runs
  `git grep -n -I --untracked --fixed-strings -e <query>`, returns ≤`MAX_GREP_MATCHES`
  `GrepMatch[]` (`{ path, line, text }`), and returns `[]` on no-match (git grep exits 1).
  **Literal (fixed-string) search, not regex** — keep it that way (it's what find-
  references uses). No backend change needed.
- `src/main/api.ts` — the procedure already exists (line ~373):
  ```ts
  searchText: t.procedure
    .input(z.object({ repoPath: z.string(), query: z.string().min(1) }))
    .query(({ input }) => gitGrep(input.repoPath, input.query)),
  ```
  Note `query: z.string().min(1)` — an empty query is an invalid input, so the overlay
  MUST NOT fire the query until it's non-empty (handled by the hook's `enabled` guard).
- `src/renderer/src/hooks/use-search.ts` — two hooks. `useFileSearch(query, enabled)` is
  the template (debounce-friendly, guards empty query):
  ```ts
  export function useFileSearch(query, enabled) {
    const { data: results = [], isFetching } = trpc.searchFiles.useQuery(
      { repoPath: repo?.path ?? '', query },
      { enabled: enabled && repo !== null && query.trim() !== '', placeholderData: keepPreviousData })
    return { results, isFetching }
  }
  export function useTextSearch(query) {  // ← currently always-enabled, no isFetching
    const { data: matches, error } = trpc.searchText.useQuery(
      { repoPath: repo?.path ?? '', query },
      { enabled: repo !== null })
    return { matches, error }
  }
  ```
  `useTextSearch` is currently safe only because its one caller (`SearchView`) always has
  a non-empty query. You will extend it to be overlay-safe (Step 1).
- `src/renderer/src/components/viewer/search-view.tsx` — the find-references results view.
  Its `open(path, line)` is the exact "jump to a match" you reuse:
  ```ts
  const open = (path: string, line: number): void => {
    if (!repo) return
    const name = path.split('/').at(-1) ?? path
    openTab({ id: tabId('file', `${repo.path}/${path}`), kind: 'file', title: name,
              path: `${repo.path}/${path}`, line })
  }
  ```
  `GrepMatch.path` is **repo-relative**; the file tab is keyed by the **absolute** path
  (`${repo.path}/${path}`), with `line` so `VirtualRows` scrolls to and highlights it.
- `src/renderer/src/components/shell/file-finder.tsx` — **the overlay you mirror**. Read
  it in full. It is a `CommandDialog` with: a Cmd+P `keydown` listener that toggles `open`;
  a 100ms debounce (`query` → `debouncedQuery`); reset-on-close; a `searching` flag
  (`isFetching || query !== debouncedQuery`); `Command shouldFilter={false}` (server-side
  filtering); rows rendered from results; `select()` opens a tab + closes. Your overlay is
  this with grep matches instead of filenames.
- `src/renderer/src/components/shell/app-shell.tsx` — `<FileFinder />` is mounted at line
  179. You mount the new overlay right beside it.
- `src/renderer/src/components/viewer/text-file-view.tsx` (line 54) — the **in-file** find
  (Cmd+F) listener is explicitly `e.key === 'f' && (e.metaKey || e.ctrlKey) && !e.shiftKey`.
  Because it requires `!e.shiftKey`, **Cmd+Shift+F is free** and won't collide.

**Repo conventions that apply** (from the `architecture` skill — follow exactly):
- Data fetching through domain hooks (`use-search.ts`); components never import
  `@renderer/lib/trpc` (Biome forbids it in `components/**`).
- **Shortcut tiering**: a shortcut that toggles one component's own local state registers
  its **own** `window` keydown listener in that component (like Cmd+P in `file-finder`,
  Cmd+F in `text-file-view`) — do NOT add it to `use-app-shortcuts.ts`.
- Match the shortcut on **`e.code === 'KeyF'`** (physical key), not `e.key`, so it's
  keyboard-layout-independent — the repo learned this when Cmd+\ failed on a Brazilian
  ABNT layout (see the `history` skill / split-view entry). For a Shift combo `e.key`
  would be `'F'`; `e.code` is stable.
- shadcn primitives only (`Command*` from `components/ui/command`); one public component
  per file; named export; explicit return types; `cn()` for conditional classes; no
  `any`; no `void` on promises.
- Conventional Commits (`feat(search): …`).

## Commands you will need

| Purpose      | Command                       | Expected on success |
|--------------|-------------------------------|---------------------|
| Install      | `pnpm install`                | exit 0              |
| Lint         | `pnpm lint`                   | exit 0              |
| Typecheck    | `pnpm typecheck`              | exit 0, no errors   |
| Tests        | `pnpm test`                   | all pass            |
| Search tests | `pnpm test -- content-search` | new cases pass      |
| Build        | `pnpm build`                  | exit 0              |

Full gate before committing (hard rule 3): `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Scope

**In scope** (the only files you may modify/create):
- `src/renderer/src/hooks/use-search.ts` — extend `useTextSearch` (Step 1).
- `src/renderer/src/components/shell/content-search.tsx` — **create**; the overlay (Step 2).
- `src/renderer/src/components/shell/content-search.test.tsx` — **create**; tests (Step 4).
- `src/renderer/src/components/shell/app-shell.tsx` — mount the overlay (Step 3).

**Out of scope** (do NOT touch):
- `src/main/git.ts` / `src/main/api.ts` — the grep backend is reused as-is. No regex mode,
  no new procedure.
- `src/renderer/src/components/viewer/search-view.tsx` — leave the find-references results
  view alone (it stays the persistent reference-list surface; this overlay is the fast
  transient search — a deliberately different interaction, not a duplicate).
- `src/renderer/src/hooks/use-app-shortcuts.ts` — the shortcut is component-owned (tier 3).
- `file-finder.tsx` — read it as the template; do not modify it.

## Steps

### Step 1: Make `useTextSearch` overlay-safe

In `src/renderer/src/hooks/use-search.ts`, change `useTextSearch` to mirror
`useFileSearch`'s guard signature:
- Signature `useTextSearch(query: string, enabled = true)`.
- Query options: `{ enabled: enabled && repo !== null && query.trim() !== '', placeholderData: keepPreviousData }`.
- Also return `isFetching` (additive) so the overlay can show "Searching…".
- Return `{ matches, error, isFetching }`.

`SearchView` calls `useTextSearch(query)` — with the default `enabled = true` and an
always-non-empty query its behavior is unchanged, and it can ignore the new `isFetching`.

**Verify**: `pnpm typecheck` → exit 0 (SearchView still compiles).

### Step 2: Create the overlay `content-search.tsx`

Create `src/renderer/src/components/shell/content-search.tsx`, modeled on
`file-finder.tsx`:
- A `ContentSearch` component (named export, returns `React.JSX.Element`).
- Local state: `open`, `query`, `debouncedQuery` (100ms debounce, same `useEffect` as
  file-finder); reset `query`/`debouncedQuery` on close.
- A `window` keydown listener toggling `open` on
  `e.code === 'KeyF' && e.shiftKey && (e.metaKey || e.ctrlKey)` → `e.preventDefault()`.
- `const { matches, error, isFetching } = useTextSearch(debouncedQuery, open)`.
  `const searching = isFetching || query !== debouncedQuery`.
- Render a `CommandDialog` (title e.g. "Search in files") with `Command shouldFilter={false}`,
  a `CommandInput` (placeholder "Search in files…"), and a `CommandList`:
  - While `query.trim() !== ''` and no matches: show "Searching…" when `searching`, else a
    `CommandEmpty` "No matches".
  - On `error`: render the error text (muted/destructive), mirroring how `SearchView`
    shows `error.message`.
  - For each match, a `CommandItem` keyed by `` `${match.path}:${match.line}` `` showing
    `path:line` (muted) + the trimmed match text (monospace), `onSelect` → open the file at
    the line and close. Copy `SearchView`'s `open(path, line)` logic verbatim (absolute
    path + `line`).
- Guard everything on `repo` (read `useRepoStore((s) => s.repo)` like file-finder).

Keep the row markup close to `SearchView`'s match buttons but inside `CommandItem`s (so
arrow-key navigation works, like the file finder).

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 3: Mount the overlay

In `src/renderer/src/components/shell/app-shell.tsx`, import `ContentSearch` and render
`<ContentSearch />` right next to `<FileFinder />` (line ~179).

**Verify**: `pnpm typecheck` → exit 0. `grep -n "ContentSearch" src/renderer/src/components/shell/app-shell.tsx` → import + element.

### Step 4: Test the overlay

Create `src/renderer/src/components/shell/content-search.test.tsx`. Mock
`@renderer/hooks/use-search` (`useTextSearch` returning a fixed `matches` array shaped
with the `@main` `GrepMatch` type) and the repo store, following the hook-mocking pattern
in `src/renderer/src/components/git/changes-list.test.tsx` / `history-list.test.tsx`. To
open the dialog, dispatch the keydown (`new KeyboardEvent('keydown', { code: 'KeyF', shiftKey: true, metaKey: true })`)
or render with `open` forced if you factor the dialog out — prefer driving the real
listener. Assert:
- With matches mocked, the result rows render (`path:line` + text visible).
- Selecting a match calls `openTab` with a `file` tab whose `path` is the absolute path
  and that carries the `line` (spy on the tabs store's `openTab`, as the other component
  tests do).
- An empty/`undefined` matches state shows the "Searching…" / "No matches" affordance.

Note: `CommandDialog` renders in a portal; `src/test-setup.ts` already stubs `matchMedia`
and `elementFromPoint`. If a Base UI portal interaction needs a stub the setup lacks, that
is a STOP condition (report it) — do not weaken the test to dodge it.

**Verify**: `pnpm test -- content-search` → all cases pass.

### Step 5: Full gate + index

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.
Update this plan's row in `plans/README.md` to DONE.

## Test plan

- `content-search.test.tsx`: results render from mocked `useTextSearch`; selecting a match
  opens a `file` tab at the absolute path + line; empty-state affordance shows. Mock the
  domain hook, never the tRPC proxy (repo convention).
- Manual smoke (optional, if a dev environment is available): Cmd+Shift+F opens the
  overlay, typing greps live, Enter/click jumps to the file at the line.
- Verification: `pnpm test` → all pass including the new file.

## Done criteria

ALL must hold:

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all exit 0.
- [ ] `useTextSearch` guards on a non-empty query + accepts `enabled` and returns
      `isFetching`; `SearchView` still compiles and behaves the same.
- [ ] `content-search.tsx` exists and is mounted in `app-shell.tsx`; Cmd+Shift+F toggles
      it (matched on `e.code === 'KeyF'`).
- [ ] Selecting a match opens the file at the match line (absolute path + `line`).
- [ ] No component imports `@renderer/lib/trpc`
      (`grep -rn "lib/trpc" src/renderer/src/components/shell/content-search.tsx` → nothing).
- [ ] New tests exist and pass; no backend (`git.ts`/`api.ts`) or `search-view.tsx` change.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `gitGrep` / the `searchText` procedure / `useTextSearch` don't match the excerpts
  (drift) — re-read before wiring.
- You find Cmd+Shift+F is already bound somewhere (grep `KeyF` across
  `src/renderer/src`) — pick another and report, don't double-bind.
- A Base UI `CommandDialog` portal interaction can't be tested with the existing
  `test-setup.ts` stubs — report it rather than weakening the assertions.
- You feel the need to add regex search, a new procedure, or to change `search-view.tsx` —
  all out of scope; the literal grep backend is reused as-is.

## Maintenance notes

- This overlay and the find-references `search` tab share the **same** `gitGrep` backend
  but serve different interaction models on purpose: the overlay is a fast, transient
  "where is this?" search; the `search` tab is a kept reference list seeded by a symbol.
  Keep them distinct — don't merge them into "two ways to do one thing."
- `gitGrep` is fixed-string (literal), capped at `MAX_GREP_MATCHES`, and skips binary
  files (`-I`). If a future request wants regex or case toggles, that's a backend change
  to `gitGrep` + the procedure input, not the overlay.
- Reviewer should scrutinize: the layout-independent `e.code` shortcut match, the empty-
  query guard (so no invalid `min(1)` request fires), and that no `lib/trpc` import leaks
  into the component.
