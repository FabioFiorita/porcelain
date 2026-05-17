# Porcelain

Agent-managed foundations. This file owns project agent guidance; skills live in `.agents/skills/` and are symlinked into `.claude/skills/` for Claude discovery. Keep them accurate and never let the codebase diverge from them. `AGENTS.md` is a symlink to this file. Keep this file slim: detail belongs in skills.

Porcelain is a lightweight macOS viewer + agent companion (Electron). Not an editor.

## Hard rules

1. **One way to do everything.** Before introducing any new pattern (state, data fetching, IPC shape, component or test style), check the `architecture` skill. If undecided, **stop and ask the user**, then record the answer (decision log here, detail in the skill). Two coexisting architectures is a failure state.
2. **Uniformity everywhere** — code, tests, commits, naming. Match existing patterns exactly.
3. **Verification gate before any commit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. **Keep docs in sync:** every architectural/product decision updates the relevant skill and the decision log below in the same commit.
5. **shadcn primitives only.** Always use shadcn components for UI primitives; never hand-roll one (sidebar, tabs, dialogs, trees, etc.). If a needed primitive doesn't exist in shadcn/registries, **get the user's approval before building it**.
6. **No type escape hatches.** No `any`, no `as unknown as` casts. If type safety requires a different design (e.g. tRPC over a hand-rolled bridge), prefer the safer design.
7. **No `void` on promises.** Never write `void somePromise()` to silence floating promises — use `async`/`await` (or `await Promise.all([...])` when batching). Bare calls like `utils.foo.invalidate()` in sync handlers are fine when you truly don't need to wait.

## Skills (in `.agents/skills/`, symlinked at `.claude/skills/`)

- `architecture` — stack, repo facts, aliases, conventions, app shell. Read before writing any code.
- `product` — what Porcelain is, core features, product principles. Read before designing features/UI.
- `shadcn`, `vercel-composition-patterns`, `frontend-design` — vendor skills.

## Decision log
- 2026-06-12: Stack: electron-vite/React 19/TS strict, shadcn+Tailwind v4, pnpm, Biome, Vitest+Playwright, Conventional Commits.
- 2026-06-12: shadcn on **Base UI** instead of Radix (user choice), `base-nova` preset.
- 2026-06-12: zustand; git via CLI shell-out; xterm.js + node-pty; per-repo config in app-side store.
- 2026-06-12: App shell = sidebar + tabs + collapsible bottom terminal; one repo per window; react-resizable-panels.
- 2026-06-12: Docs split: slim CLAUDE.md + project skills in `.agents/skills/` (symlinked at `.claude/skills/`).
- 2026-06-12: IPC = **tRPC over electron-trpc** (user choice over hand-rolled bridge: no casts, zod-validated inputs). File tree = lazy per-directory reads.
- 2026-06-12: shadcn `sidebar` primitive for the app sidebar (user feedback → hard rule 5); sidebar collapses to rail, no drag-resize.
- 2026-06-12: Folder hiding: right-click Hide/Unhide + eye toggle (dimmed in show-hidden mode); filtering in MAIN process. Recents on welcome screen (app config store in userData/config.json).
- 2026-06-12: Auto-open last repo on startup. Git diffs: working-tree first, sidebar Files/Changes tabs, unified + split rendering (user toggle).
- 2026-06-12: Data fetching = TanStack Query via @trpc/react-query (caching, invalidation); vanilla tRPC client only inside zustand stores. Syntax highlighting = Shiki (dark-plus), per-line tokens in viewer + diffs.
- 2026-06-12: Terminal shipped: node-pty in main + xterm.js renderer, streaming via tRPC subscription; scrollback replay on reattach. Window default 1400x900.
- 2026-06-12: Liquid-glass: vibrancy under-window + hiddenInset title bar + alpha theme tokens; drag regions via .app-drag/.app-no-drag. Sidebar drag-resizable (--sidebar-width override, 180-520px). Tree multi-select via cmd-click → batch hide.
- 2026-06-12: Cmd+P file finder: git ls-files (cached 30s) + custom subsequence fuzzy scorer in main; shadcn command dialog, shouldFilter=false (server-side filtering).
- 2026-06-12: Virtualized rendering (@tanstack/react-virtual, VirtualRows) for file viewer + diff rows — never render all lines. gitStatus polls 3s/staleTime 0; gitDiffFile staleTime 0 (git data must be live, unlike fs reads).
- 2026-06-12: Flow-ordered review shipped: default layer conventions (deepest-segment-wins matching) + import-edge parsing of changed files; per-repo layer overrides in config schema (no UI yet). Changes list renders grouped by layer, entry-point → data.
- 2026-06-12: History: sidebar History tab (200 commits, relative dates); commit tab = file list + per-file diff reusing HunksView/DiffModeToggle (extracted from DiffView).
- 2026-06-12: Cmd+W closes tab (before-input-event in main → appEvents subscription), Ctrl+Tab cycles tabs. UI prefs persisted (zustand/persist, localStorage). readFile returns FileView union (text/image/binary).

- 2026-06-12: Worktrees: sidebar footer shows current branch (5s poll) + dropdown switcher (git worktree list --porcelain); switching clears tabs and opens the worktree path as the repo.

- 2026-06-12: Changes rows show +adds/−dels (git diff --numstat merged into gitFlow). Middle-click closes tabs. recentRepos prunes non-existent paths.

- 2026-06-12: Perf batch: gitFlow memoized on status+numstat key (no 3s re-reads), file list stale-while-revalidate + warm on repo open, finder debounce/loading/reset-on-close, hover prefetch (diffs + files), sidebar resize via direct CSS-var writes. ErrorBoundary at root + renderer console piped to dev stdout. All `@base-ui` entries pre-bundled (`optimizeDeps.entries`) — lazy discovery duplicated React and blank-screened. Tab bar on ScrollArea + tab context menu (close others/left/right/all); global themed scrollbars. GOTCHA: Base UI `GroupLabel` must sit inside `Group` (Radix didn't care).

- 2026-06-12: Flow-layer settings UI shipped: gear in sidebar footer → dialog editing per-repo layers (label + regex, reorder, add/remove, reset, inline validation, helper with Stories example); `repoLayers`/`setRepoLayers` procedures. `layerFor` lost its Tests special case — deepest match covers filename layers generally.
- 2026-06-12: Markdown reader: react-markdown + remark-gfm + @tailwindcss/typography prose, Reader/Source toggle (persisted, reader default), links open externally. Markdown files only; reader view is not virtualized.

- 2026-06-12: Right "Quick Access" sidebar: nested second shadcn SidebarProvider (controlled by `rightSidebarOpen` preference, Cmd+. via new `shortcut` prop on the provider; left keeps Cmd+B). Sections follow the left tab (`sidebarTab` preference): Files → Pinned (per-repo `pinnedPaths`, tree context-menu Pin/Unpin, reuses TreeNode); Changes/History → git quick commands; Changes only → commit composer (type/scope chips learned from last 200 subjects via `parseConventions` + message). "Commit all" commits directly (`gitCommit` = `git add -A` + `git commit -m`, stderr surfaced inline); a secondary icon button types the command into the terminal instead. Terminal inserts NEVER auto-execute (no newline); text queued via `pendingInput` if the pane is still opening.
- 2026-06-12: Verification happens in `~/Code/porcelain-playground` (mock repo, recreate at will) — never drive tests against the user's work repos.

- 2026-06-12: **Embedded terminal removed entirely** (user decision: Porcelain must not compete with Ghostty/Warp — being a terminal *companion* requires not having one). node-pty/xterm/react-resizable-panels dropped, postinstall chmod gone, no bottom pane. Quick commands now RUN directly (`gitQuickCommand`, whitelisted `QUICK_COMMANDS` in git.ts) with stdout+stderr shown inline (errors red); everything invalidates after a run.

- 2026-06-12: Quick edits shipped (user decision — relaxes "read-only by design"): pencil on text-file tabs → plain textarea (NOT CodeMirror/Monaco; staying lightweight), Cmd+S saves via `writeTextFile`. Viewer right-click menu: Copy / Find references / Copy (relative) path / Reveal in Finder; edit mode gets Cut/Copy/Paste. Find references = `git grep --fixed-strings` → `search` tab kind, results jump to line (Tab.line + VirtualRows scrollToLine + row highlight). Quick commands got distinct per-command icons. GOTCHA: ui ContextMenuTrigger defaults to `select-none` — pass `select-text` where selection matters.

- 2026-06-12: Branding: porcelain squircle logo (sources from user) → `build/icon.{png,icns,ico}` (832px artwork padded to 1024, regenerate via iconutil) + `src/renderer/src/assets/logo.png` on welcome/empty viewer. Subtitle everywhere: "Review changes as a story".
- 2026-06-12: Packaging & auto-update: `electron-builder.yml` (dmg+zip arm64, Developer ID signing from keychain, hardened runtime, `notarize: false` until notarytool creds exist), `pnpm dist` = local installer, `pnpm release` = publish to GitHub releases (`fabiofiorita/porcelain`, needs `GH_TOKEN`). `electron-updater` in `src/main/updater.ts` (packaged only, 4h checks, auto-download, install on quit), `update-status` AppEvent → `updateStatus` query → `UpdateButton` pill in TopBar ("Update to vX" → quitAndInstall).

- 2026-06-12: Skills canonical in `.agents/skills/`; `.claude/skills/` symlinks all skills for Claude discovery. Root `AGENTS.md` symlinks to `CLAUDE.md` (canonical). Vercel composition skill compiled doc renamed `AGENTS.md` → `GUIDE.md` to avoid colliding with root.
- 2026-06-12: No `void` on promises — use async/await for tRPC invalidation, prefetch, clipboard, etc.

- Agent-session integration design (beyond a plain terminal)
