# Porcelain — Codebase Guide

A human-oriented onboarding guide for understanding this codebase. It assumes you have
**never built an Electron app** and have **never read this code**. It complements (does not
replace) the agent-facing skills in `.agents/skills/` — those are terse and assume Electron
knowledge; this explains the fundamentals and walks you through how the pieces connect.

> If you change architecture, the *source of truth* is still the `architecture` skill plus the
> decision log in `CLAUDE.md`. This guide is a map for a human reader, not a spec.

---

## 1. What Porcelain is (the 30-second version)

Porcelain is a **macOS desktop app** for *reviewing code changes*, built for people who drive
coding agents from the terminal. It is **a viewer, not an editor** — it deliberately has no
LSP, no autocomplete, no embedded terminal. Its two differentiators:

- **Scoped navigation** — hide/pin folders so a 50 GB monorepo shows only what you care about.
- **Flow-ordered review** — read a diff as a *story* (entry point → query → route → service →
  database), ordered by how the changed files depend on each other, not alphabetically.

Tagline: *"Review changes as a story."*

It's a small codebase — about **9,000 lines** of TypeScript across main + renderer, with **15
test files**.

---

## 2. Electron in five minutes (read this first if Electron is new to you)

An Electron app is **a Chrome browser and a Node.js process glued together**. That's the whole
idea. It ships a copy of Chromium to render your UI with web tech (React, CSS) and a Node.js
runtime to do everything a browser can't (touch the filesystem, run `git`, open OS dialogs).

There are **three processes**, and almost every Electron concept is just "which of these three
is this code running in?"

| Process | Think of it as… | Can it touch the OS / filesystem? | In this repo |
|---|---|---|---|
| **Main** | The Node.js backend | ✅ Yes — full Node access | `src/main/` |
| **Renderer** | A Chrome tab running your React app | ❌ No — it's sandboxed, like a web page | `src/renderer/` |
| **Preload** | A tiny trusted bridge loaded into the renderer before your app | ⚠️ Limited — wires up the bridge only | `src/preload/` |

Why the split? **Security.** If the renderer (which displays untrusted file contents, diffs,
etc.) had raw filesystem access and got compromised, it could do anything. So the renderer is
sandboxed and must *ask* the main process to do privileged work. That request crosses a boundary
called **IPC** (inter-process communication).

The mental model for this app:

```
┌─────────────────────────────────────────────────────────────┐
│  RENDERER  (Chrome tab — React, your whole UI)              │
│  "Hey main, read this file / run git status / open a dialog" │
└───────────────────────────┬─────────────────────────────────┘
                            │  IPC  (messages across the boundary)
┌───────────────────────────┴─────────────────────────────────┐
│  PRELOAD  (the bridge — sets up the IPC channel safely)      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│  MAIN  (Node.js — runs git, reads files, owns the window)    │
└─────────────────────────────────────────────────────────────┘
```

**Key takeaway:** any time the UI needs real data (a file's contents, a git diff), it cannot
just `fs.readFile` — it must send a message to main and wait for the answer. The next section is
about how this app makes that *feel* like calling a normal function.

---

## 3. The single most important pattern: tRPC over IPC

Raw Electron IPC is stringly-typed and ugly: you send `'read-file'` with some payload and hope
the other side understands. This app replaces that with **tRPC**, which makes calling the main
process feel like calling a typed function — with full TypeScript autocomplete and validation.

Here's the entire round trip for "read a file":

1. **Main defines a procedure** — `src/main/api.ts` is one big `router({...})`. Each entry is a
   "procedure" (a query for reads, a mutation for writes), with its input validated by a
   [zod](https://zod.dev) schema:
   ```ts
   readFile: t.procedure.input(z.string()).query(async ({ input }): Promise<FileView> => {
     const info = await stat(input)        // real Node.js filesystem access
     // …returns { type: 'text', content } | { type: 'image', … } | …
   })
   ```
   The router's type is exported as `AppRouter` (the last line of `api.ts`).

2. **Preload exposes the channel** — `src/preload/index.ts` calls `exposeElectronTRPC()`. That's
   the bridge. You rarely touch this file.

3. **Renderer gets a typed client** — `src/renderer/src/lib/trpc.ts` imports the `AppRouter`
   **type only** (no runtime code crosses the boundary) and builds two clients:
   - `trpc` — React Query hooks (`trpc.readFile.useQuery(...)`), used in components *via wrappers*.
   - `trpcClient` — a plain promise-based client, used only inside zustand stores.

4. **A domain hook wraps it** — components never call `trpc.*` directly. Instead, `hooks/use-files.ts`:
   ```ts
   export function useReadFile(path: string) {
     const { data: view, error } = trpc.readFile.useQuery(path)
     return { view, error }
   }
   ```

5. **A component calls the hook** — `FileContent` calls `useReadFile(path)` and renders.

Because the renderer imports the router's *type*, if you rename a procedure or change its input,
**the renderer fails to compile** until you fix the callers. That's the safety the whole app is
built around — there are no untyped string channels, no `any`, no casts.

> **Why the indirection (component → hook → trpc)?** Three reasons, all enforced by lint:
> components stay pure UI; all cache-invalidation logic lives in one place (the hook); and
> component tests can mock the hook instead of faking the entire IPC layer. A Biome rule makes it
> a **lint error** to import `lib/trpc` from a component.

---

## 4. The data-flow stack (memorize this diagram)

Every feature in the renderer follows the same five layers, top to bottom:

```
src/main/api.ts            ← procedures (the API surface), thin
  └─ src/main/<thing>.ts   ← pure logic (git parsing, fuzzy search, flow ordering) — heavily tested
       │  (IPC boundary)
  lib/trpc.ts              ← THE client (import-restricted to hooks/ and stores/)
    └─ hooks/use-<domain>.ts  ← data hooks: queries, mutations, and cache invalidation
         └─ components/<area>/*.tsx  ← UI only; consume hooks + stores
  stores/*.ts              ← zustand: client-only state (tabs, repo, prefs, selection)
```

Two kinds of state, never mixed:

- **Server/git/filesystem state** → always through TanStack Query (the data hooks). Cached,
  auto-invalidated, polled when it needs to be live.
- **Client-only UI state** (which tabs are open, which repo, user prefs) → zustand stores.

If you only remember one thing about the renderer: **data comes from hooks, UI state comes from
stores, and components are dumb glue between them.**

---

## 5. Directory tour

```
porcelain/
├── src/
│   ├── main/          ← Node.js backend (git, fs, OS). ~25 files.
│   ├── preload/       ← the IPC bridge. 2 tiny files, rarely touched.
│   └── renderer/src/  ← the entire React UI.
│       ├── components/
│       │   ├── ui/        ← shadcn primitives (button, dialog, sidebar…). Generated; don't hand-edit.
│       │   ├── shell/     ← app frame: sidebars, tab bar, file tree, welcome screen.
│       │   ├── viewer/    ← the file viewer: text/image/markdown rendering, editor, find bar.
│       │   ├── git/       ← diffs, commits, history.
│       │   └── settings/  ← settings dialog (flow layers, general prefs).
│       ├── hooks/     ← one use-<domain>.ts per data domain. ALL tRPC access lives here.
│       ├── stores/    ← zustand stores: tabs, repo, preferences, selection.
│       ├── lib/       ← trpc client, query provider, highlight, path/cn helpers.
│       └── assets/    ← main.css (Tailwind + theme tokens), logo.
├── .agents/skills/    ← the canonical agent docs (architecture, product, shadcn, …).
├── .claude/skills/    ← symlinks to .agents/skills/ for Claude discovery.
├── plans/             ← design/improvement plans (001–005), kept after implementation.
├── build/ & resources/← app icons.
├── docs/              ← this guide.
├── CLAUDE.md          ← agent guidance + the append-only decision log (the project's "why").
└── electron-builder.yml, electron.vite.config.ts, *.json ← config.
```

### The main process (`src/main/`) — where the real work happens

This is pure Node.js. It is split into **thin procedures** (`api.ts`) and **pure logic modules**
that have no Electron dependency and are unit-tested next to the source (`foo.ts` + `foo.test.ts`):

| File | Responsibility |
|---|---|
| `index.ts` | App entry: creates the window, wires the glass look, intercepts Cmd+W, sets dev config dir. |
| `api.ts` | The tRPC router — **every** procedure the UI can call. Your API surface. |
| `git.ts` | Shells out to the `git` CLI (`git status`, `diff`, `log`, `commit`, `grep`, `worktree`…). No git library. |
| `diff.ts` | Pure parsers: porcelain status, unified diff → `DiffHunk[]`. Tested. |
| `flow.ts` | **Flow-ordered review** logic: maps files to layers, parses imports, builds the ordered groups. Tested. |
| `repo-config.ts` | Pure logic for per-repo config (hidden paths, pins, layers, notes, recents). Tested. |
| `config-store.ts` + `json-store.ts` | Persists that config to `~/Library/Application Support/porcelain/config.json` (atomic writes). |
| `fuzzy.ts` | Subsequence fuzzy scorer for the Cmd+P file finder. Tested. |
| `conventions.ts` | Learns commit type/scope chips from your last 200 commit subjects. Tested. |
| `suggestions.ts` | Turns `git status`/`stash` into "you have changes to push" hints. Tested. |
| `external-url.ts`, `read-limits.ts` | Small security guards (URL allowlist, 10 MB read cap). Tested. |
| `updater.ts` | electron-updater wiring (auto-update from GitHub Releases). |
| `app-events.ts` | A tiny pub/sub so main can push events to the renderer (e.g. Cmd+W → "close tab"). |
| `dev-config.ts` | In dev, seeds a separate config so `pnpm dev` never touches your real repos. |

**The pattern to notice:** procedures in `api.ts` are *thin* — they validate input and delegate
to a pure module. The pure module is where logic and tests live. This is why most of the test
coverage is on the main side: pure functions are trivial to test.

### The renderer (`src/renderer/src/`) — the UI

Organized by the data-flow stack above. A few anchors:

- **`App.tsx`** — the root: `<ErrorBoundary><ApiProvider><AppShell/></ApiProvider></ErrorBoundary>`.
  `ApiProvider` sets up TanStack Query; `ErrorBoundary` shows a stack trace instead of a blank
  window if React crashes.
- **`components/shell/app-shell.tsx`** — the app frame. If no repo is open → `<Welcome/>`.
  Otherwise: left sidebar + main panel (tab bar + viewer) + right "Quick Access" sidebar. The
  glass/floating-tile look lives here.
- **`components/shell/viewer.tsx`** — **the router's render switch.** It reads the active tab and
  `switch`es on its `kind` to render the right view. More on this next.

---

## 6. How navigation works: "the tabs store is the router"

There is **no React Router, no URLs.** Navigation state *is* the list of open tabs in
`stores/tabs.ts`. This is unusual if you come from web dev, so it's worth internalizing.

- A "screen" is a **tab**, and every tab has a `kind`: `'file' | 'diff' | 'commit' | 'search'`.
- A tab's id is always `tabId(kind, key)` — e.g. `tabId('diff', '/path/to/file.ts')`. Same target
  → same id → same tab (no duplicates).
- `viewer.tsx` is the entire "route table":
  ```ts
  switch (activeTab.kind) {
    case 'diff':   return <DiffView filePath={activeTab.path} />
    case 'commit': return <CommitView hash={activeTab.path} />
    case 'search': return <SearchView query={activeTab.path} />
    case 'file':   return <FileContent key={activeTab.path} path={activeTab.path} … />
  }
  ```
  The function's return type is annotated so that **forgetting a `case` is a compile error** —
  the compiler forces every tab kind to be handled.
- **Preview tabs:** single-clicking a file opens an *italic preview* tab that the next preview
  replaces (so browsing doesn't pile up tabs). Double-clicking or editing *pins* it.

To add a brand-new screen (say, "blame"), the recipe is: pure logic module + test → procedure in
`api.ts` → hook → add `'blame'` to `TabKind` → a `BlameView` component → a `case` in the switch.
The compiler walks you through it.

---

## 7. The stores (`stores/`) — client state

Four small zustand stores. Each is one concern; components subscribe to just the field they need.

| Store | Holds | Notable |
|---|---|---|
| `tabs.ts` | Open tabs + active tab; open/close/pin/cycle actions. | **This is the router** (§6). |
| `repo.ts` | The current repo, `showHidden` toggle, and `switchTo(path)`. | `switchTo` is the **one** place repo-switching lives — it closes all tabs then opens the new repo. Uses the vanilla `trpcClient`. |
| `preferences.ts` | Persisted UI prefs (diff mode, sidebar widths/open state, active sidebar tab…). | Persisted to `localStorage` via zustand's `persist` middleware — the **only** thing that survives reload. |
| `selection.ts` | Multi-selected tree rows (for batch hide). | Cmd+click in the tree. |

Rule of thumb for "where does this state go?":
- Comes from git/fs/disk? → a **data hook**, never a store.
- Read by more than one component? → a **store**.
- Survives an app restart? → the **preferences** store.
- Otherwise → component-local `useState`.

---

## 8. Feature map — where each feature lives

Use this as a "I want to change X, where do I look?" index.

| Feature | Main (logic) | Renderer (UI) |
|---|---|---|
| **File tree** (lazy, hide/pin) | `readDir` in `api.ts`, `repo-config.ts` | `shell/file-tree.tsx`, `shell/tree-node.tsx` |
| **File viewer** (text/image/binary) | `readFile` in `api.ts` | `viewer/file-content.tsx`, `viewer/source-view.tsx` |
| **Editing** (always-on, autosave) | `writeTextFile` | `viewer/text-file-view.tsx`, `viewer/editor-source.tsx` |
| **Syntax highlighting** | — | `lib/highlight.ts` (Shiki), `viewer/code-line.tsx` |
| **Markdown reader** | — | `viewer/markdown-view.tsx` |
| **Diffs** (unified/split) | `gitDiffFile`, `diff.ts` parsers | `git/diff-view.tsx`, `git/hunks-view.tsx`, `git/diff-mode-toggle.tsx` |
| **Changes list + staging** | `gitStatus`, `gitStageFile`/`gitUnstageFile`/`gitStageAll` | `git/changes-list.tsx` |
| **Flow-ordered review** | `flow.ts`, `gitFlow` in `api.ts` | `git/changes-list.tsx` (renders the groups) |
| **History** | `gitLog`, `gitCommitFiles`, `gitCommitDiff` | `git/history-list.tsx`, `git/commit-view.tsx` |
| **Commit composer** | `gitCommit`, `conventions.ts` | `shell/commit-group.tsx` |
| **Quick commands** (pull/push/stash) | `gitQuickCommand` (whitelisted) | `shell/quick-commands-group.tsx` |
| **Git suggestions** | `suggestions.ts`, `gitSuggestions` | `shell/quick-commands-group.tsx` |
| **Worktrees / branch** | `gitWorktrees`, `gitBranch` | `git/worktree-switcher.tsx` |
| **Cmd+P file finder** | `searchFiles` + `fuzzy.ts` | `shell/file-finder.tsx` |
| **Find references** (Cmd-click → grep) | `searchText` → `gitGrep` | `viewer/search-view.tsx` |
| **Find in file** (Cmd+F) | — | `viewer/find-bar.tsx` |
| **Pinned files + quick notes** | `pinnedEntries`, `repoNotes` | `shell/files-quick-access.tsx`, `shell/notes-card.tsx` (TipTap editor) |
| **Settings** (flow layers, prefs) | `repoLayers`/`setRepoLayers` | `settings/settings-dialog.tsx` |
| **Auto-update** | `updater.ts` | `UpdateButton` in `app-shell.tsx` |
| **Welcome / recent repos** | `recentRepos`, `openRepoPath` | `shell/welcome.tsx`, `shell/project-switcher.tsx` |

---

## 9. Two end-to-end walkthroughs

### A. Opening a file from the tree

1. You click a row in the tree → `tree-node.tsx` calls `openTab({ id: tabId('file', path), … })`.
2. The tabs store adds/activates that tab.
3. `viewer.tsx` re-renders, sees `kind === 'file'`, renders `<FileContent path=… />`.
4. `FileContent` calls `useReadFile(path)` → `trpc.readFile.useQuery(path)`.
5. That sends an IPC message → main's `readFile` procedure → `fs.stat` + `fs.readFile` → returns a
   `FileView` union (`text` / `image` / `binary` / `too-large`).
6. TanStack Query caches the result; `FileContent` renders the right view (highlighted text,
   `<img>`, "binary file", or "too large").
7. (Bonus: hovering the row *before* clicking already prefetched the file via `useReadFilePrefetch`,
   so the open feels instant.)

### B. Committing staged changes

1. The right sidebar's `commit-group.tsx` shows type/scope chips. Those came from `gitCommitConventions`,
   which ran `parseConventions` over your last 200 commit subjects.
2. You write a message and hit Commit → `useCommit` hook → `gitCommit` mutation.
3. Main runs `git commit -m "<message>"` on the **staged** changes only (Porcelain never auto-stages
   — staging is a separate, explicit action; it's a review tool).
4. On success, the hook invalidates `gitFlow`, `gitLog`, and the conventions query, so the changes
   list, history, and chips all refresh automatically.

Notice in both cases: **UI → hook → procedure → pure logic / git CLI → typed result → cache →
re-render.** That loop is the whole app.

---

## 10. Performance: why it stays fast on a 50 GB monorepo

Performance is treated as a product feature. The techniques you'll see everywhere:

- **Lazy filesystem reads** — the tree reads one directory at a time on expand; nothing is indexed up front.
- **Virtualized rendering** — files and diffs render through `VirtualRows` (only the ~visible 20px
  rows are in the DOM; Shiki only highlights mounted rows). Never render all lines of a file.
- **Caching + smart freshness** — filesystem reads cache for 30s; git data is "live" (`gitFlow`
  polls every 3s). The 3s poll is cheap because main **memoizes** the flow result on a
  status+numstat+layers key — file contents are only re-read when the working tree actually changes.
- **Hover prefetch** — hovering a tree row or a changes row prefetches its contents/diff.
- **Read caps** — files over 10 MB return `too-large` without being read; files over 5,000 lines
  fall back to a read-only virtualized view.

---

## 11. The macOS / glass / window stuff

This is the Electron-specific chrome, mostly in `main/index.ts` and `assets/main.css`:

- The window uses `vibrancy` + `titleBarStyle: 'hiddenInset'` + a transparent background so the
  macOS desktop blurs through — the "liquid glass" look. The dark theme tokens have alpha so the
  panels are translucent.
- The sidebars and main panel are **floating tiles** over that vibrancy "void" (8px gaps) — the
  "Glaze" design system (`plans/005-glaze-design-system.md`).
- macOS traffic-light buttons are repositioned (`trafficLightPosition`) to center them in the
  48px header. `.app-drag` / `.app-no-drag` CSS classes mark which chrome you can drag the window by.
- **One repo per window.**
- ⚠️ Edits to `main/index.ts` (like the traffic-light position) need an **Electron restart** — they
  don't hot-reload like renderer changes do.

---

## 12. Dev workflow & commands

```bash
pnpm install        # install deps (Node + pnpm required)
pnpm dev            # run the app with hot-reload. Opens a separate dev config that
                    #   points at ~/Code/porcelain-playground — never your real repos.
pnpm test           # Vitest (unit + component). pnpm test:watch to watch.
pnpm lint           # Biome (lint + format check). pnpm lint:fix to autofix.
pnpm typecheck      # tsc on both the node + web tsconfigs.
pnpm build          # typecheck + bundle.
pnpm dist           # build a local signed .dmg/.zip (no publish).
pnpm release        # build + publish to GitHub Releases (for auto-update).
```

**The verification gate** (a hard rule before any commit):
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
All four must pass. CI (`.github/workflows/ci.yml`) runs the same on every push/PR.

**Tooling choices** (each picked deliberately — see the decision log):
- **pnpm** (not npm/yarn), **Biome** (not ESLint/Prettier), **Vitest** (not Jest),
  **Conventional Commits** (`feat:`, `fix:`, `chore:`…), **electron-vite** as the build tool.

---

## 13. Testing strategy

- **Most coverage is on the main side**, on **pure functions** — `diff.ts`, `flow.ts`, `fuzzy.ts`,
  `repo-config.ts`, etc., each with a `*.test.ts` next door. Keeping logic pure and main-side is
  *why* it's so testable. This is the highest-leverage place to add tests.
- **Component tests** (`*.test.tsx`) mock the **domain hooks**, never the tRPC layer (the hooks
  layer exists partly so tests don't need to fake IPC). Copy `git/changes-list.test.tsx` or
  `git/history-list.test.tsx` as templates.
- `test-setup.ts` wires jest-dom, cleanup, and a couple of jsdom stubs (`matchMedia`,
  `elementFromPoint`).

---

## 14. The rules that keep this codebase uniform

The project's north star (from `CLAUDE.md`) is **"one way to do everything."** The hard rules:

1. **One way to do everything** — before inventing a new pattern (state, fetching, IPC shape,
   component style), check the `architecture` skill; if undecided, *ask*, then record the answer.
2. **Uniformity everywhere** — match existing patterns exactly (code, tests, commits, naming).
3. **Verification gate** before any commit (§12).
4. **Keep docs in sync** — every architectural decision updates the relevant skill *and* the
   decision log in the same commit.
5. **shadcn primitives only** — never hand-roll a sidebar/dialog/tree; building a new primitive
   needs approval.
6. **No type escape hatches** — no `any`, no `as unknown as` casts.
7. **No `void` on promises** — use `async`/`await`.

The **decision log** at the bottom of `CLAUDE.md` is worth reading top to bottom — it's the
chronological story of *why* the app is the way it is (every reversal, every "we tried X and cut
it"). The skills tell you *what* the code does now; the log tells you *how it got there*.

---

## 15. Where to go next

- **Read `CLAUDE.md`** end to end — especially the decision log.
- **Read the `architecture` skill** (`.agents/skills/architecture/SKILL.md`) — the definitive
  technical reference; this guide is the gentle on-ramp to it.
- **Read the `product` skill** — what to build and what to deliberately *not* build.
- **Trace one feature** start to finish using §9 as a template. Picking "Cmd+P file finder" is a
  good one: `file-finder.tsx` → `use-search.ts` → `searchFiles` in `api.ts` → `fuzzy.ts`.
- **Run `pnpm dev`** and click around with the source open beside you.
