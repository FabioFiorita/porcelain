---
name: architecture
description: Porcelain's stack, repo layout, aliases, conventions, and app-shell structure. Read before writing or reviewing any code in this repo.
---

# Porcelain architecture

## Stack

| Area | Decision |
|---|---|
| Shell | Electron via **electron-vite**, React 19, TypeScript (strict) |
| UI | **shadcn/ui on Base UI** (`@base-ui/react`, not Radix) + Tailwind CSS v4, `base-nova` preset, Geist font, dark mode default |
| Client architecture | **Vercel composition patterns** (see `.agents/skills/vercel-composition-patterns/`) |
| Client state | **zustand** — small stores per concern; no other state libraries |
| Git backend | Shell out to `git` CLI from the main process; parse porcelain-format output; no git libraries |
| Per-repo config | App-side JSON store under `~/Library/Application Support/porcelain`, keyed by repo path; never write into work repos |
| Package manager | **pnpm** |
| Lint/format | **Biome** (no ESLint/Prettier) |
| Tests | **Vitest** (unit/component) + **Playwright** (Electron e2e, not yet wired) |

## App shell

- No repo open → full-screen `welcome` component (repo picker); shell renders only once a repo is selected.
- Layout: shadcn `sidebar` left + `SidebarInset` holding the tab bar and viewer + the right Quick Access sidebar. NO embedded terminal — Porcelain is a *companion to* the user's terminal (Ghostty/Warp), never a terminal itself; don't reintroduce one.
- **One repo per window** — window state is scoped to a single repo/worktree.
- Shell components live in `src/renderer/src/components/shell/` (`app-shell`, `app-sidebar`, `right-sidebar`, `file-tree`, `tab-bar`, `viewer`); stores: `stores/tabs.ts`, `stores/repo.ts`.
- File tree: lazy per-directory reads (`readDir` on expand), nothing indexed up front; built from shadcn `SidebarMenu` + `Collapsible` + `ContextMenu`.
- Glass look: `vibrancy: 'under-window'` + `titleBarStyle: 'hiddenInset'` + transparent backgroundColor in main; dark theme `--background`/`--sidebar` have alpha; `.app-drag`/`.app-no-drag` classes mark window-drag chrome. Sidebar header has `pl-[4.75rem]` for traffic lights.
- Sidebar is drag-resizable: `sidebarWidth` in `stores/preferences.ts` (clamped 180–520) feeds `--sidebar-width` on `SidebarProvider`; handle in `sidebar-resize-handle.tsx`. During the drag the handle writes the CSS variable straight onto the `[data-slot="sidebar-wrapper"]` element and commits to the store only on mouseup — store writes per mousemove re-render the whole app.
- Right "Quick Access" sidebar (`right-sidebar.tsx`): a SECOND `SidebarProvider` nested inside `SidebarInset` (controlled via `rightSidebarOpen` preference; `shortcut="."` — the provider gained a `shortcut?: string | null` prop so the two providers don't both grab Cmd+B). `TopBar` lives inside the inner provider, so the left sidebar's toggle/state are captured by `RepoShell` (rendered between the providers, where `useSidebar()` is the outer one) and passed down as props. Sections follow the left sidebar's active tab (`sidebarTab` in `stores/preferences.ts`, the left `Tabs` is controlled by it): Files → Pinned (renders `TreeNode`s from `pinnedEntries`); Changes + History → Quick commands; Changes only → Commit composer (`gitCommitConventions` = `parseConventions` in `src/main/conventions.ts` over the last 200 log subjects → type/scope chips + message). "Commit all" runs `gitCommit` (`gitCommitAll` in git.ts: `git add -A` then `git commit -m`; git stderr rethrown so the mutation error renders inline) and invalidates gitFlow/gitLog/conventions. Quick commands run a WHITELIST (`QUICK_COMMANDS` in git.ts) via the `gitQuickCommand` mutation — stdout+stderr combined (push logs to stderr), shown inline in the section, errors in red; `utils.invalidate()` after every run since pull/stash change everything.
- Pinning: per-repo `pinnedPaths` in the config schema, tree context menu Pin/Unpin (`pinPath`/`unpinPath`, `DirEntry.pinned` flag); invalidate `readDir` + `pinnedEntries` together.
- Tree multi-select: cmd/ctrl-click toggles selection (`stores/selection.ts`); context menu shows "Hide N items" when a selection exists; batch runs hide mutations then one invalidate.
- Folder hiding: hidden paths are absolute, any depth (files or dirs), stored per repo in the app config (`src/main/repo-config.ts` pure logic + `config-store.ts` persistence at `userData/config.json`). `readDir` filters them in the MAIN process; `showHidden` mode returns them flagged (`DirEntry.hidden`) and the UI dims them. Hide/unhide via right-click context menu; eye toggle in sidebar header. Tree refresh = `treeVersion` bump in `stores/repo.ts`.
- Welcome screen lists recent repos (max 10, `recentRepos` query; `openRepoPath` mutation). On startup the last repo auto-opens (`restoreLastRepo` in `stores/repo.ts`); welcome only shows if none/missing.
- Flow-ordered review: pure logic in `src/main/flow.ts` — `DEFAULT_LAYERS` ordered Pages→…→Data→Tests; `layerFor` uses deepest-matching-segment (not first-match; filename patterns like `\.spec\.`/`\.stories\.` naturally beat the containing directory — no special cases); `parseImports` + `resolveImport` (relative + alias-suffix heuristic) connect changed files; `buildFlow` groups in layer order. `gitFlow` procedure reads ≤200 changed files (≤1MB each) for edges. Per-repo `layers` override: edited via `FlowLayersDialog` (`components/settings/`, gear in the sidebar footer) → `repoLayers`/`setRepoLayers` procedures (regex validated in zod) → `layersFor`/`withRepoLayers` in `repo-config.ts`. Changes list renders these groups with `connects` shown as "→ file" lines.
- Worktrees/branch: `gitBranch` (rev-parse, 5s poll) + `gitWorktrees` (`worktree list --porcelain`, parser in diff.ts); `WorktreeSwitcher` in the sidebar footer (shadcn `dropdown-menu`) clears tabs and `openRepoPath`s the chosen worktree. GOTCHA: Base UI requires `DropdownMenuLabel` (GroupLabel) inside `DropdownMenuGroup` — outside one it throws MenuGroupContext missing.
- History: `gitLog`/`gitCommitFiles`/`gitCommitDiff` (parsers `parseLog`/`parseNameStatus`); sidebar History tab opens `commit` tabs rendered by `CommitView` (file list + per-file diff via shared `HunksView`/`DiffModeToggle`).
- Shortcuts: Cmd+W intercepted in main (`before-input-event`, blocks default window-close) → `appEvents` tRPC subscription (the only subscription pattern) → renderer closes active tab or window; Ctrl+Tab/Ctrl+Shift+Tab cycle tabs (`use-app-shortcuts.ts`).
- Tab bar: horizontal shadcn `ScrollArea` (the ui component takes an `orientation` prop); titles truncate at `max-w-40`; middle-click closes; right-click context menu = Close / Close Others / Close to the Left / Close to the Right / Close All (bulk actions in `stores/tabs.ts`, anchor tab activated when the active tab is closed).
- Crash visibility: `ErrorBoundary` wraps the app in `App.tsx` (render crashes show the stack, not a blank window); in dev, main pipes renderer `console-message` and `render-process-gone` to stdout — Claude reads them from the `pnpm dev` log to self-verify.
- Vite: `optimizeDeps.entries` covers `src/**/*.{ts,tsx}` so every `@base-ui/react/*` entry is pre-bundled. A dep discovered lazily mid-session re-optimizes, loads a second React copy, and crashes with "Invalid hook call".
- `readFile` returns a `FileView` union (text | image dataUrl | binary size) — viewer renders each.
- Text file tabs render `TextFileView` (header = relative path + actions). Quick edit: pencil → `FileEditor` (plain textarea, Cmd+S saves via `writeTextFile`, Esc cancels; Save disabled when unchanged; invalidates readFile + gitFlow + gitDiffFile). `FileContent` is keyed by path in `Viewer` so edit state can't leak across tabs. Deliberately NOT an editor: no CodeMirror/Monaco, no LSP.
- Viewer context menu (`SourceContextMenu` in viewer.tsx): Copy / Find references (selection) / Copy path / Copy relative path / Reveal in Finder (`revealInFinder` procedure → shell.showItemInFolder). GOTCHA: the ui `ContextMenuTrigger` defaults to `select-none` — pass `select-text` or text selection silently breaks. Selection is captured in the menu's `onOpenChange`. The edit-mode textarea gets its own Cut/Copy/Paste menu (clipboard API + manual splice).
- Find references: `searchText` procedure = `gitGrep` (`git grep -n -I --untracked --fixed-strings`, ≤500 matches, exit 1 → []; parser `parseGrep` in diff.ts). Results render in a `search`-kind tab (`SearchView`); clicking a match opens the file tab with `Tab.line`, which `VirtualRows`' `scrollToLine` centers and `SourceView` highlights. `openTab` on an existing id updates `line` so repeated jumps work.
- Markdown files get a Reader/Source toggle (`MarkdownContent` in `viewer.tsx`; `markdownMode` preference, reader default). Reader = `MarkdownView` (react-markdown + remark-gfm, `prose prose-invert` via `@tailwindcss/typography`, loaded with `@plugin` in main.css); links get `target="_blank"` so main's `setWindowOpenHandler` opens them externally. Reader view is NOT virtualized — markdown only; never route code files through it.
- UI preferences (diff mode, markdown mode, sidebar tab, right sidebar open, sidebar width) persist via `zustand/middleware` `persist` to localStorage (`porcelain-preferences`).
- Git: pure parsers in `src/main/diff.ts` (porcelain-z status, unified diff → `DiffHunk[]`, synthesized add-diff for untracked) + shell-out in `src/main/git.ts`. Sidebar has Files/Changes tabs (shadcn `Tabs`); changes list opens `diff` tabs; `DiffView` (`components/git/diff-view.tsx`) renders unified or split (toggle, preference in `stores/preferences.ts`; split rows paired del↔add in `toSplitRows`).

## Repo facts

- Renderer alias `@renderer/*` → `src/renderer/src/*`, defined in FOUR places that must stay in sync: `electron.vite.config.ts`, `tsconfig.web.json`, root `tsconfig.json` (needed by the shadcn CLI), `vitest.config.ts`.
- shadcn components: `src/renderer/src/components/ui/` (excluded from Biome); add via `pnpm dlx shadcn@latest add <name>`. Base UI uses `render` prop, not Radix's `asChild` — see `.agents/skills/shadcn/rules/base-vs-radix.md`.
- Tailwind/theme entry: `src/renderer/src/assets/main.css` (imports `shadcn/tailwind.css` and Geist).
- Main process = OS/git/fs access. Renderer = pure UI, no Node APIs.
- **Data fetching = TanStack Query** (`@trpc/react-query@10` + `@tanstack/react-query@4`, versions paired with tRPC v10). Components use `trpc.<proc>.useQuery/useMutation` hooks (from `lib/trpc.ts`), provider in `lib/query.tsx` (staleTime 30s, no focus refetch). zustand stores use the vanilla `trpcClient` export. Invalidate with `trpc.useUtils()` after mutations — never ad-hoc useEffect+useState fetching.
- **Virtualized code rendering**: file viewer and diff view render through `VirtualRows` (`components/viewer/virtual-rows.tsx`, @tanstack/react-virtual, fixed 20px rows) — NEVER render all lines of a file; Shiki tokenizes only mounted rows. Diff hunks flatten to a `DiffRow` union (`header | unified | split`) before virtualization.
- Query freshness: fs-backed queries keep the 30s default staleTime; git-backed queries are live (`gitFlow`: staleTime 0 + 3s poll while mounted; `gitDiffFile`: staleTime 0, keepPreviousData). The 3s `gitFlow` poll is cheap because main memoizes the flow result on a status+numstat+layers key (`flowCache` in `api.ts`) — changed-file contents are re-read only when the working tree actually changes.
- Hover prefetch: changes-list rows prefetch `gitDiffFile` (staleTime 2s) and file-tree rows prefetch `readFile` on mouseenter, so opening feels instant.
- **Syntax highlighting = Shiki**, theme `dark-plus`, singleton in `lib/highlight.ts` (`languageFor(path)` ext→lang map); `CodeLine` + `useHighlighter` in `components/viewer/code-line.tsx` render per-line tokens, shared by file viewer and diffs.
- **IPC = tRPC via `electron-trpc`** (the only IPC pattern). PINNED to tRPC **v10** (`@trpc/*@^10`): electron-trpc 0.7 reads v10 internals (`_def.query`); tRPC v11 silently breaks every call with NOT_FOUND. Don't upgrade until electron-trpc supports v11 (watch `electron-trpc-experimental`). Renderer client uses `createTRPCProxyClient`. Router + procedures in `src/main/api.ts` (zod inputs, exported `AppRouter` + shared types like `RepoInfo`/`DirEntry`); preload calls `exposeElectronTRPC()`; renderer client in `src/renderer/src/lib/trpc.ts` (`import type { AppRouter }` from main — type-only import, no runtime coupling). Never use raw `ipcMain`/`ipcRenderer` channels, never cast (`as unknown as` is banned repo-wide).

- Cmd+P file finder: `file-finder.tsx` (shadcn `command` dialog, `shouldFilter={false}`); search runs in MAIN via `searchFiles` — `git ls-files` (stale-while-revalidate cache in `git.ts`, warmed on repo open) filtered by hidden paths (filter result memoized per repo+hidden set in `api.ts`), ranked by the pure subsequence scorer in `src/main/fuzzy.ts` (contiguity + basename bonuses; supports typing the end of a name). Top 50 results. Renderer debounces keystrokes 100ms, shows "Searching…" while fetching, and resets the query when the dialog closes.

## Conventions

- **shadcn primitives only**: never hand-roll a primitive (sidebar, tabs, dialog, tree, …); search shadcn/registries first; building a new primitive requires user approval.
- Own components: kebab-case filenames, named PascalCase exports, composition-first (no boolean-prop variants). Feature components in `src/renderer/src/components/<area>/`; zustand stores in `src/renderer/src/stores/`, one file per concern.
- Tests live next to source (`foo.test.ts`), named after the unit under test.
- Strict TS, no `any`, no dead code, no commented-out code.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Verification gate before any commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must all pass.
