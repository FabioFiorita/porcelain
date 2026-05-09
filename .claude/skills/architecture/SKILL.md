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
| Terminal | **xterm.js** renderer + **node-pty** in main process |
| Per-repo config | App-side JSON store under `~/Library/Application Support/porcelain`, keyed by repo path; never write into work repos |
| Package manager | **pnpm** |
| Lint/format | **Biome** (no ESLint/Prettier) |
| Tests | **Vitest** (unit/component) + **Playwright** (Electron e2e, not yet wired) |
| Pane resizing | **react-resizable-panels v4** via shadcn `resizable` (v4 API: `orientation`, string sizes like `"20%"`/`"160px"`, no `autoSaveId`) |

## App shell

- No repo open → full-screen `welcome` component (repo picker); shell renders only once a repo is selected.
- Layout: shadcn `sidebar` (collapses to rail via `SidebarTrigger`, fixed width, no drag-resize) + `SidebarInset` holding the tabbed viewer and a collapsible bottom terminal pane (vertical `ResizablePanelGroup`).
- **One repo per window** — window state is scoped to a single repo/worktree.
- Shell components live in `src/renderer/src/components/shell/` (`app-shell`, `app-sidebar`, `file-tree`, `tab-bar`, `viewer`, `terminal-pane`); stores: `stores/tabs.ts`, `stores/repo.ts`.
- File tree: lazy per-directory reads (`readDir` on expand), nothing indexed up front; built from shadcn `SidebarMenu` + `Collapsible` + `ContextMenu`.
- Glass look: `vibrancy: 'under-window'` + `titleBarStyle: 'hiddenInset'` + transparent backgroundColor in main; dark theme `--background`/`--sidebar` have alpha; `.app-drag`/`.app-no-drag` classes mark window-drag chrome. Sidebar header has `pl-[4.75rem]` for traffic lights.
- Sidebar is drag-resizable: `sidebarWidth` in `stores/preferences.ts` (clamped 180–520) feeds `--sidebar-width` on `SidebarProvider`; handle in `sidebar-resize-handle.tsx`.
- Tree multi-select: cmd/ctrl-click toggles selection (`stores/selection.ts`); context menu shows "Hide N items" when a selection exists; batch runs hide mutations then one invalidate.
- Folder hiding: hidden paths are absolute, any depth (files or dirs), stored per repo in the app config (`src/main/repo-config.ts` pure logic + `config-store.ts` persistence at `userData/config.json`). `readDir` filters them in the MAIN process; `showHidden` mode returns them flagged (`DirEntry.hidden`) and the UI dims them. Hide/unhide via right-click context menu; eye toggle in sidebar header. Tree refresh = `treeVersion` bump in `stores/repo.ts`.
- Welcome screen lists recent repos (max 10, `recentRepos` query; `openRepoPath` mutation). On startup the last repo auto-opens (`restoreLastRepo` in `stores/repo.ts`); welcome only shows if none/missing.
- Flow-ordered review: pure logic in `src/main/flow.ts` — `DEFAULT_LAYERS` ordered Pages→…→Data→Tests; `layerFor` uses deepest-matching-segment (not first-match); `parseImports` + `resolveImport` (relative + alias-suffix heuristic) connect changed files; `buildFlow` groups in layer order. `gitFlow` procedure reads ≤200 changed files (≤1MB each) for edges; per-repo `layers` override lives in the config schema (no settings UI yet). Changes list renders these groups with `connects` shown as "→ file" lines.
- Git: pure parsers in `src/main/diff.ts` (porcelain-z status, unified diff → `DiffHunk[]`, synthesized add-diff for untracked) + shell-out in `src/main/git.ts`. Sidebar has Files/Changes tabs (shadcn `Tabs`); changes list opens `diff` tabs; `DiffView` (`components/git/diff-view.tsx`) renders unified or split (toggle, preference in `stores/preferences.ts`; split rows paired del↔add in `toSplitRows`).

## Repo facts

- Renderer alias `@renderer/*` → `src/renderer/src/*`, defined in FOUR places that must stay in sync: `electron.vite.config.ts`, `tsconfig.web.json`, root `tsconfig.json` (needed by the shadcn CLI), `vitest.config.ts`.
- shadcn components: `src/renderer/src/components/ui/` (excluded from Biome); add via `pnpm dlx shadcn@latest add <name>`. Base UI uses `render` prop, not Radix's `asChild` — see `.agents/skills/shadcn/rules/base-vs-radix.md`.
- Tailwind/theme entry: `src/renderer/src/assets/main.css` (imports `shadcn/tailwind.css` and Geist).
- Main process = OS/git/fs access. Renderer = pure UI, no Node APIs.
- **Data fetching = TanStack Query** (`@trpc/react-query@10` + `@tanstack/react-query@4`, versions paired with tRPC v10). Components use `trpc.<proc>.useQuery/useMutation` hooks (from `lib/trpc.ts`), provider in `lib/query.tsx` (staleTime 30s, no focus refetch). zustand stores use the vanilla `trpcClient` export. Invalidate with `trpc.useUtils()` after mutations — never ad-hoc useEffect+useState fetching.
- **Virtualized code rendering**: file viewer and diff view render through `VirtualRows` (`components/viewer/virtual-rows.tsx`, @tanstack/react-virtual, fixed 20px rows) — NEVER render all lines of a file; Shiki tokenizes only mounted rows. Diff hunks flatten to a `DiffRow` union (`header | unified | split`) before virtualization.
- Query freshness: fs-backed queries keep the 30s default staleTime; git-backed queries are live (`gitStatus`: staleTime 0 + 3s poll while mounted; `gitDiffFile`: staleTime 0, keepPreviousData).
- **Syntax highlighting = Shiki**, theme `dark-plus`, singleton in `lib/highlight.ts` (`languageFor(path)` ext→lang map); `CodeLine` + `useHighlighter` in `components/viewer/code-line.tsx` render per-line tokens, shared by file viewer and diffs.
- **IPC = tRPC via `electron-trpc`** (the only IPC pattern). PINNED to tRPC **v10** (`@trpc/*@^10`): electron-trpc 0.7 reads v10 internals (`_def.query`); tRPC v11 silently breaks every call with NOT_FOUND. Don't upgrade until electron-trpc supports v11 (watch `electron-trpc-experimental`). Renderer client uses `createTRPCProxyClient`. Router + procedures in `src/main/api.ts` (zod inputs, exported `AppRouter` + shared types like `RepoInfo`/`DirEntry`); preload calls `exposeElectronTRPC()`; renderer client in `src/renderer/src/lib/trpc.ts` (`import type { AppRouter }` from main — type-only import, no runtime coupling). Never use raw `ipcMain`/`ipcRenderer` channels, never cast (`as unknown as` is banned repo-wide).

- Cmd+P file finder: `file-finder.tsx` (shadcn `command` dialog, `shouldFilter={false}`); search runs in MAIN via `searchFiles` — `git ls-files` (30s cache in `git.ts`) filtered by hidden paths, ranked by the pure subsequence scorer in `src/main/fuzzy.ts` (contiguity + basename bonuses; supports typing the end of a name). Top 50 results.
- Terminal: `node-pty` sessions in `src/main/terminal.ts` (Map by id, 256KB scrollback buffer, killed on quit); xterm.js + fit addon in `terminal-pane.tsx`; data streams over a tRPC **subscription** (`termOnData`, the only subscription pattern); session id kept in `stores/terminal.ts` so remounts reattach + replay scrollback. GOTCHA: pnpm strips the exec bit from node-pty's `spawn-helper` prebuilds → `posix_spawnp failed`; postinstall re-chmods it — don't remove that step.

## Conventions

- **shadcn primitives only**: never hand-roll a primitive (sidebar, tabs, dialog, tree, …); search shadcn/registries first; building a new primitive requires user approval.
- Own components: kebab-case filenames, named PascalCase exports, composition-first (no boolean-prop variants). Feature components in `src/renderer/src/components/<area>/`; zustand stores in `src/renderer/src/stores/`, one file per concern.
- Tests live next to source (`foo.test.ts`), named after the unit under test.
- Strict TS, no `any`, no dead code, no commented-out code.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Verification gate before any commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must all pass.
