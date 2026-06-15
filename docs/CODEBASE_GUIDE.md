# Porcelain — Codebase Guide

> **Last synced: v0.6.0.** This guide re-syncs against the code on every release (it's step 2 of
> the `releasing` skill's runbook), so you should never need a dedicated "update the guide"
> session. If the stamp here is older than the current `package.json` version, the guide may have
> drifted — the next release will reconcile it.

A human-oriented onboarding guide for understanding this codebase. It assumes you have
**never built an Electron app** and have **never read this code**. It complements (does not
replace) the agent-facing skills in `.agents/skills/` — those are terse and assume Electron
knowledge; this explains the fundamentals and walks you through how the pieces connect.

> If you change architecture, the *source of truth* is still the `architecture` skill plus the
> append-only decision log in the `history` skill. This guide is a map for a human reader, not a spec.

---

## 1. What Porcelain is (the 30-second version)

Porcelain is a **macOS desktop app** for *reviewing code changes*, built for people who drive
coding agents from the terminal. It is **a viewer, not an editor** — it deliberately has no
LSP, no autocomplete, no embedded terminal. Its differentiators:

- **Scoped navigation** — hide/pin folders so a 50 GB monorepo shows only what you care about.
- **Flow-ordered review** — read a diff as a *story* (entry point → query → route → service →
  database), ordered by how the changed files depend on each other, not alphabetically.
- **Feature view + agent channel** — widen the diff into the *whole feature*: not just the
  changed files, but the unchanged files they import (context) and the cross-seam files an agent
  declares (shipped). The agent feeds these "review sets" through a bundled **MCP server**,
  shipped as a one-click **Claude Code plugin**. This is what makes Porcelain a *companion* to
  the agent, not just a diff viewer.

Tagline: *"Review changes as a story."*

It's a small codebase — about **13,500 lines** of TypeScript across main + renderer + the MCP
server, with **28 unit/component test files** (most of them on the pure main-side logic) plus a
small **Playwright e2e suite** (`e2e/`, the release gate).

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

2. **Preload exposes the bridge** — `src/preload/index.ts` exposes a small `window.porcelain`
   object via `contextBridge`: `trpc(request)` carries a serialized call over IPC, and
   `onAppEvent(cb)` is the one main→renderer push channel. (We *own* this ~40-line transport
   instead of depending on the abandoned `electron-trpc` package — see the migration note in the
   `history` skill. The renderer wraps it in tRPC's official `httpBatchLink`; the main side replays
   it through tRPC's official `fetchRequestHandler` in `src/main/ipc.ts`, so all the protocol
   logic stays in tRPC and we only shuttle bytes.) You rarely touch these files.

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
│   ├── main/          ← Node.js backend (git, fs, OS, the agent channel). ~30 files.
│   ├── mcp/           ← the standalone MCP server (a separate node build). The agent's entry point.
│   ├── preload/       ← the IPC bridge. 2 tiny files, rarely touched.
│   └── renderer/src/  ← the entire React UI.
│       ├── components/
│       │   ├── ui/        ← shadcn primitives (button, dialog, sidebar…). Generated; don't hand-edit.
│       │   ├── shell/     ← app frame: sidebars, tab bar, file tree, welcome, notes card, quick-access sections.
│       │   ├── viewer/    ← the file viewer: text/image/markdown rendering, inline editing, find bar.
│       │   ├── git/       ← diffs, commits, history, changes list, feature list + inline read, explore view.
│       │   └── settings/  ← settings dialog sections (general, flow layers, plugin install, updates).
│       ├── hooks/     ← one use-<domain>.ts per data domain. ALL tRPC access lives here.
│       ├── stores/    ← zustand stores: tabs, repo, preferences, selection.
│       ├── lib/       ← trpc client, query provider, highlight, path/cn helpers.
│       └── assets/    ← main.css (Tailwind + theme tokens + the Glaze design system), logo.
├── e2e/               ← Playwright Electron e2e: launches the BUILT app against a seeded fixture repo.
│                         Smoke + screenshot specs (`*.spec.ts`); the release gate, not the per-commit gate.
├── .agents/skills/    ← the canonical agent docs (architecture, product, audit, history, releasing…).
├── .claude/skills/    ← symlinks to .agents/skills/ for Claude discovery.
├── plans/             ← design/improvement plans (001–005), kept after implementation.
├── build/ & resources/← app icons.
├── docs/              ← this guide.
├── CLAUDE.md          ← agent guidance + nomenclature glossary (the "why" log now lives in the history skill).
└── electron-builder.yml, electron.vite.config.ts, playwright.config.ts, *.json ← config.
```

> **Two build targets, one repo.** `electron.vite.config.ts` builds *two* main-process bundles:
> the app itself (`out/main/index.js`) and the standalone MCP server (`out/main/mcp/server.js`).
> The MCP server imports only Node builtins — no Electron — so a plain `node` process (the one an
> agent spawns) can run it. See §8b for the whole agent channel.

### The main process (`src/main/`) — where the real work happens

This is pure Node.js. It is split into **thin procedures** (`api.ts`) and **pure logic modules**
that have no Electron dependency and are unit-tested next to the source (`foo.ts` + `foo.test.ts`):

| File | Responsibility |
|---|---|
| `index.ts` | App entry: creates the window, wires the glass look, intercepts Cmd+W, sets dev config dir. |
| `api.ts` | The tRPC router — **every** procedure the UI can call. Your API surface. |
| `git.ts` | Shells out to the `git` CLI (`git status`, `diff`, `log`, `commit`, `grep`, `worktree`, staging…). No git library. |
| `diff.ts` | Pure parsers: porcelain status, unified diff → `DiffHunk[]`, worktree list, grep. Tested. |
| `flow.ts` | **Flow-ordered review** logic: maps files to layers, parses imports, builds the ordered groups. Tested. |
| `feature-view.ts` | Widens a diff into the whole **feature**: walks one import hop out for *context* files, unions in the agent's *shipped* files, regroups by flow layer. Also assembles the inline-read document (`buildFeatureReading`). Tested. |
| `feature-slice.ts` | Heuristic **symbol slicing** for the inline read: parses import bindings, collects the symbols the in-view files actually use, slices just those definitions out of a context/shipped file (with caps + whole-file fallback). Tested. |
| `feature-explore.ts` | The read-only **explore** walker: from a symbol/file seed, BFS the relative-import graph (injected `readSource` for testability) and build a sliced `FeatureReading`. Tested. |
| `review-set.ts` | Shared types + zod schemas for the agent channel (`FileSource`, `ReviewSet`). |
| `review-store.ts` + `review-watch.ts` | Reads the agent's `~/.porcelain/review-sets.json` (re-validated), watches it to live-refresh the open feature view, and owns the app's one write back (`clearReviewSet`). |
| `plugin.ts` + `plugin-assets.ts` | Builds + installs the **Claude Code plugin** that ships the MCP server (assets are pure + tested; `plugin.ts` does the filesystem + shell work). |
| `repo-config.ts` | Pure logic for per-repo config (hidden paths, pins, layers, notes, recents). Tested. |
| `config-store.ts` + `json-store.ts` | Persists that config to `~/Library/Application Support/porcelain/config.json` (atomic writes, race-free). Tested. |
| `fuzzy.ts` | Subsequence fuzzy scorer for the Cmd+P file finder. Tested. |
| `conventions.ts` | Learns commit type/scope chips from your last 200 commit subjects. Tested. |
| `suggestions.ts` | Turns `git status`/`stash` into "you have changes to push" hints. Tested. |
| `external-url.ts`, `read-limits.ts` | Small security guards (URL allowlist, 10 MB read cap). Tested. |
| `updater.ts` | electron-updater wiring (auto-update from GitHub Releases + the manual "Check for updates"). |
| `app-events.ts` | A tiny pub/sub so main can push events to the renderer (Cmd+W → "close tab", update status, feature-view refresh). |
| `dev-config.ts` | In dev, seeds a separate config so `pnpm dev` never touches your real repos. |

The **`src/mcp/` server** is its own little world: `server.ts` (the stdio MCP entry point an
agent spawns) plus pure, tested `protocol.ts` and `review-file.ts`. It writes review sets that
`review-store.ts` on the app side reads — the two halves only ever talk through that one JSON
file. §8b walks the whole loop.

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

- A "screen" is a **tab**, and every tab has a `kind`:
  `'file' | 'diff' | 'commit' | 'search' | 'feature' | 'explore'`.
- A tab's id is always `tabId(kind, key)` — e.g. `tabId('diff', '/path/to/file.ts')`. Same target
  → same id → same tab (no duplicates).
- `viewer.tsx` is the entire "route table":
  ```ts
  switch (activeTab.kind) {
    case 'diff':    return <DiffView filePath={activeTab.path} />
    case 'commit':  return <CommitView hash={activeTab.path} />
    case 'search':  return <SearchView query={activeTab.path} />
    case 'feature': return <FeatureView />   // the MCP-only inline read; reads the repo from the store
    case 'explore': return <ExploreView path={activeTab.path} symbol={activeTab.symbol} />
    case 'file':    return <FileContent key={activeTab.path} path={activeTab.path} … />
  }
  ```
  The function's return type is annotated so that **forgetting a `case` is a compile error** —
  the compiler forces every tab kind to be handled.
- **Preview tabs:** single-clicking a file opens an *italic preview* tab that the next preview
  replaces (so browsing doesn't pile up tabs). Double-clicking or editing *pins* it.

To add a brand-new screen (say, "blame"), the recipe is: pure logic module + test → procedure in
`api.ts` → hook → add `'blame'` to `TabKind` → a `BlameView` component → a `case` in the switch.
The compiler walks you through it.

### Split view (two panes)

The viewer can split into two side-by-side **panes**, each with its own tab bar and active tab.
This is modeled *inside* the tabs store, not as extra global tab state: the store holds
`panes: Pane[]` (a `Pane` is `{ tabs, activeTabId }`) plus `activePaneIndex`. The crucial design
choice: **`openTab` / `pinTab` / `cycleTab` / `closeAllTabs` keep their old signatures and always
act on the *active* pane**, so every opener (file tree, finder, changes list, …) is pane-agnostic
and needed zero changes when split view landed. Only `openTabToSide(tab)` and the pane-scoped
close/activate ops know about pane indices. Closing a pane's last tab **collapses the split**.
You open a split via "Open to the Side" (a file-tree row's or a tab's context menu) or **Cmd+Shift+S**.

---

## 7. The stores (`stores/`) — client state

Five small zustand stores. Each is one concern; components subscribe to just the field they need.

| Store | Holds | Notable |
|---|---|---|
| `tabs.ts` | The `panes` (each with its tabs + active tab) + `activePaneIndex`; open/close/pin/cycle/split actions. | **This is the router** (§6); also holds the split-view model. |
| `repo.ts` | The current repo, `showHidden` toggle, and `switchTo(path)`. | `switchTo` is the **one** place repo-switching lives — it closes all tabs then opens the new repo. Uses the vanilla `trpcClient`. |
| `preferences.ts` | Persisted UI prefs (diff/markdown mode, pull strategy, sidebar widths/open state, active sidebar tab, split ratio, notes height…). | Persisted to `localStorage` via zustand's `persist` middleware — the **only** thing that survives reload. |
| `selection.ts` | Multi-selected tree rows (for batch hide). | Cmd+click in the tree. |
| `reveal.ts` | The absolute `path` the file tree should expand-to, scroll into view, and highlight. | Set by Changes → **Open file** (`reveal(path)`); tree nodes derive their expansion/highlight from it (VS-Code-style reveal-in-explorer, persists across tab switch). |

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
| **File tree** (lazy, hide/pin, reveal) | `readDir` in `api.ts`, `repo-config.ts` | `shell/file-tree.tsx`, `shell/tree-node.tsx`, `stores/reveal.ts` (expand-to/scroll/highlight a target) |
| **File viewer** (text/image/binary) | `readFile` in `api.ts` | `viewer/file-content.tsx`, `viewer/source-view.tsx` |
| **Editing** (always-on, autosave) | `writeTextFile` | `viewer/text-file-view.tsx`, `viewer/editor-source.tsx` |
| **Syntax highlighting** | — | `lib/highlight.ts` (Shiki), `viewer/code-line.tsx` |
| **Markdown reader** | — | `viewer/markdown-view.tsx` |
| **Diffs** (unified/split) | `gitDiffFile`, `diff.ts` parsers | `git/diff-view.tsx`, `git/hunks-view.tsx`, `git/diff-mode-toggle.tsx` |
| **Changes list + per-file staging** | `gitStatus`/`gitFlow`, `gitStageFile`/`gitUnstageFile`/`gitStageAll` | `git/changes-list.tsx` (dot per row, right-click Stage/Unstage + **Open file**) |
| **Flow-ordered review** | `flow.ts`, `gitFlow` in `api.ts` | `git/changes-list.tsx` (renders the groups) |
| **Feature view** (widen diff → whole feature) | `feature-view.ts` + `feature-slice.ts`, `featureView`/`featureReading` in `api.ts` | **Feature** sidebar tab (`git/feature-list.tsx`, Cmd+4) + the MCP-only inline read (`git/feature-view.tsx` over `git/reading-surface.tsx`) |
| **Explore flow** (read-only, from a symbol/file) | `feature-explore.ts`, `exploreFeature` in `api.ts` | `git/explore-view.tsx` (shares `git/reading-surface.tsx`); opened via right-click "Explore flow" |
| **Agent channel** (MCP review sets) | `src/mcp/` (4 tools), `review-set.ts`, `review-store.ts`, `review-watch.ts` | feeds the feature view; live-refreshes it |
| **Claude Code plugin** (ships the MCP server) | `plugin.ts`, `plugin-assets.ts`, `pluginInfo`/`installPlugin` | `settings/plugin-section.tsx` |
| **History** | `gitLog`, `gitCommitFiles`, `gitCommitDiff` | `git/history-list.tsx`, `git/commit-view.tsx` |
| **Commit composer** | `gitCommit`, `conventions.ts` | `shell/commit-group.tsx` |
| **Quick commands** (pull/push/stash) | `gitQuickCommand` (whitelisted; `quickCommandArgs` adds `--rebase`/`--no-rebase` per the pull-strategy pref) | `shell/quick-commands-group.tsx` |
| **Git suggestions** | `suggestions.ts`, `gitSuggestions` | `shell/quick-commands-group.tsx` |
| **Worktrees / branch** | `gitWorktrees`, `gitBranch` | `git/worktree-switcher.tsx` |
| **Split view** (two panes) | — | `stores/tabs.ts` (`panes`), `shell/tab-bar.tsx`, `shell/viewer.tsx` |
| **Cmd+P file finder** | `searchFiles` + `fuzzy.ts` | `shell/file-finder.tsx` |
| **Find references** (Cmd-click → grep) | `searchText` → `gitGrep` | `viewer/search-view.tsx` |
| **Find in file** (Cmd+F) | — | `viewer/find-bar.tsx` |
| **Pinned files + quick notes** | `pinnedEntries`, `repoNotes` | `shell/files-quick-access.tsx`, `shell/notes-card.tsx` (TipTap editor) |
| **Settings** (general, flow layers, plugin, updates) | `repoLayers`/`setRepoLayers`, `pluginInfo`, `checkForUpdates` | `settings/settings-dialog.tsx` + its four `*-section.tsx` |
| **Auto-update + manual check** | `updater.ts`, `checkForUpdates` | `UpdateButton` in `app-shell.tsx`, `settings/updates-section.tsx` |
| **Welcome / recent repos** | `recentRepos`, `openRepoPath` | `shell/welcome.tsx`, `shell/project-switcher.tsx` |

---

## 8b. The feature view & the agent channel (the newest, most important subsystem)

This is the piece the original guide predates, and it's what turns Porcelain from a diff viewer
into an *agent companion*. Read this slowly.

### The problem it solves

A git diff only shows *changed* files. But to review a feature you often need the files that
*didn't* change — the function being called, the type being implemented — and, crucially, the
files on the **other side of a seam** (a server route the client now calls, a migration) that the
agent touched but that git groups separately or that live in a different diff. The **feature view**
reconstructs the whole feature and lays it out in flow order.

It now has **two surfaces**, both flow-ordered:

- The **Feature sidebar tab** (the fourth tab, Cmd+4 — `git/feature-list.tsx`): a navigation *list*
  of the whole feature, peer to Files/Changes/History. `changed` rows open a diff, `context`/`shipped`
  rows open the file. This is always available (the no-MCP baseline is changed + context).
- The viewer `feature` tab (`git/feature-view.tsx`): an **MCP-only inline reading surface** — the
  whole feature as one flow-ordered document showing *just the relevant lines*: diff hunks for
  `changed` files, heuristic **symbol slices** (`feature-slice.ts`) for `context`/`shipped` (only the
  definitions the in-view files import). It's opened by an "Open inline read" button that appears in
  the list only when an agent fed a review set, and shares its renderer (`git/reading-surface.tsx`)
  with the explore view.

Every file in a feature view carries a **source** tag:

- **changed** — in the working-tree diff (git status wins over everything).
- **context** — *unchanged*, pulled in because a changed file imports it. This is the "no-MCP
  baseline": `feature-view.ts`'s `expandContext` walks **one import hop** out from the changed
  files along their relative imports. You get this for free, no agent required.
- **shipped** — a cross-seam file the **agent explicitly declares** belongs to this feature. This
  is the only part that needs the agent channel.

### The agent channel, end to end

```
  Agent (Claude Code, running in your terminal)
    │  calls an MCP tool: "this feature is these files"
    ▼
  src/mcp/server.js          ← standalone stdio MCP server (plain node, NO Electron)
    │  writes / merges
    ▼
  ~/.porcelain/review-sets.json   ← the ONLY thing the two sides share
    │  (NOT a work repo, NOT Electron's userData — a non-Electron node process
    │   can't resolve userData, so it's a fixed path in the home dir)
    ▲  reads + re-validates (zod)         ▲ watches the directory
  src/main/review-store.ts            src/main/review-watch.ts
    │                                       │ on change → "feature-view" app-event
    ▼                                       ▼
  featureView / featureReading (api.ts)  renderer invalidates those queries
    │  unions changed + context + the declared "shipped" files,
    │  regroups by flow layer (same grouping the Changes list uses)
    ▼
  feature-list.tsx + feature-view.tsx  ← both surfaces live-refresh
```

The agent talks to the MCP server through **four tools** (`src/mcp/protocol.ts`):
`set_feature_review` (replace the set), `add_review_files` (merge more in), `get_feature_review`
(read the stored set back — so the agent can verify an idempotent update or recover after a context
compaction), and `clear_feature_review` (drop it). In the app, the list's two-step **"Clear agent
set"** button calls `clear_feature_review`'s app-side counterpart (`clearReviewSet` in
`review-store.ts` — the app's *only* write to the channel) and reverts to the baseline.

The key architectural facts to remember:

1. **The two halves never call each other.** The MCP server (a separate `node` process the agent
   spawns) and the Electron app communicate *only* by reading/writing one JSON file. That's why
   the MCP build imports nothing but Node builtins.
2. **It live-refreshes.** `review-watch.ts` watches the file's directory; when the agent writes a
   new review set, it pushes a `feature-view` app-event (the same one-way main→renderer push
   channel used for Cmd+W), the renderer invalidates the `featureView` query, and the open view
   updates without you touching anything.
3. **Distribution = a Claude Code plugin.** You don't configure MCP by hand. Settings →
   "Claude Code plugin" (`plugin.ts` + the pure, tested `plugin-assets.ts`) writes a local
   marketplace to `~/.porcelain/plugin/`, **copies the built `server.js` in** (so it runs even
   though the app's own copy is sealed inside `app.asar`), and best-effort runs
   `claude plugin marketplace add` + `claude plugin install`. The plugin bundles the MCP server
   *and* a `review-with-porcelain` skill that teaches the agent when to push a review set.

If you only remember one sentence: **the agent declares a feature by writing a review set through
the MCP server; Porcelain watches that file and renders the union of changed + context + shipped
files in flow order.**

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
  The `featureView` procedure memoizes the same way (keyed on status+numstat+layers+review-set).
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

**Color is fully tokenized** (in `assets/main.css`, below the Glaze block). There are no raw
`text-emerald-500`-style literals in components anymore — every status, diff, and icon hue is a
CSS variable defined for *both* a light `:root` and the `.dark` theme. Two families: **semantic
state** (`--success`/`--warning`/`--info` joining shadcn's `--destructive` — git M=warning,
A/U=success, D=destructive, R=info; plus `--diff-add`/`--diff-del` for hunk tints) and the
**`--ink-*` categorical palette** (blue/green/red/… consumed as `text-ink-*`/`bg-*` for
per-language file icons and the Files/Changes/History category icons). Only **one dark theme
ships** — `<html class="dark">` is hardwired in `index.html`; the light values are pre-authored
but untested, and there is **no theme picker** (a blue option was built and deliberately cut — see
the `history` skill). When you need a color, reach for a token; never hard-code a Tailwind shade.

---

## 12. Dev workflow & commands

```bash
pnpm install        # install deps (Node + pnpm required)
pnpm dev            # run the app with hot-reload. Opens a separate dev config that
                    #   points at ~/Code/porcelain-playground — never your real repos.
pnpm test           # Vitest (unit + component). pnpm test:watch to watch.
pnpm test:e2e       # Playwright Electron e2e (builds, then drives the real app). Release gate, not the
                    #   commit gate. pnpm test:e2e:update regenerates the screenshot baselines.
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

**Releasing** is *not* `pnpm release` from your machine anymore — it runs through a GitHub Actions
pipeline (signing + notarization live in CI secrets). `pnpm dist` still builds a local signed
`.dmg`/`.zip` for testing. The full runbook is the `releasing` skill.

**Tooling choices** (each picked deliberately — see the `history` skill):
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
- **End-to-end** (`e2e/*.spec.ts`, Playwright) is the secondary tier and the **release gate** — it
  `_electron.launch`es the *built* app against a deterministic seeded repo (`e2e/helpers/`), runs a
  handful of high-value full-app flows, and asserts DOM screenshot baselines (`*-darwin.png`, committed).
  It runs headless via `PORCELAIN_E2E=1` and stays *out* of the per-commit gate (it's slow and needs a
  built app). Regenerate baselines after intentional UI changes with `pnpm test:e2e:update`.

---

## 14. The rules that keep this codebase uniform

The project's north star (from `CLAUDE.md`) is **"one way to do everything."** The hard rules:

1. **One way to do everything** — before inventing a new pattern (state, fetching, IPC shape,
   component style), check the `architecture` skill; if undecided, *ask*, then record the answer.
2. **Uniformity everywhere** — match existing patterns exactly (code, tests, commits, naming).
3. **Verification gate** before any commit (§12).
4. **Keep docs in sync** — every architectural decision updates the relevant skill *and* appends an
   entry to the `history` skill in the same commit.
5. **shadcn primitives only** — never hand-roll a sidebar/dialog/tree; building a new primitive
   needs approval.
6. **No type escape hatches** — no `any`, no `as unknown as` casts.
7. **No `void` on promises** — use `async`/`await`.
8. **Commit straight to `main`** — solo project, no `feat/*`/`fix/*` branches, no PRs; run the
   verification gate, then commit directly to `main`.

The **`history` skill** is worth reading top to bottom — it's the append-only, chronological story
of *why* the app is the way it is (every reversal, every "we tried X and cut it" — the blue theme,
the embedded terminal). The other skills tell you *what* the code does now; `history` tells you
*how it got there*. (It used to live at the bottom of `CLAUDE.md`; it was moved out so it loads on
demand instead of into every session.)

---

## 15. Where to go next

- **Read `CLAUDE.md`** end to end — the hard rules + the nomenclature glossary (the shared
  vocabulary for every region of the app).
- **Read the `history` skill** — the chronological *why* behind every decision.
- **Read the `architecture` skill** (`.agents/skills/architecture/SKILL.md`) — the definitive
  technical reference; this guide is the gentle on-ramp to it.
- **Read the `product` skill** — what to build and what to deliberately *not* build. The `audit`
  skill lists the invariants you must not regress.
- **Trace one feature** start to finish using §9 as a template. Picking "Cmd+P file finder" is a
  good one: `file-finder.tsx` → `use-search.ts` → `searchFiles` in `api.ts` → `fuzzy.ts`. For the
  newest subsystem, trace the agent channel in §8b.
- **Run `pnpm dev`** and click around with the source open beside you.
