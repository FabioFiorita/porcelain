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
- `shadcn`, `frontend-design` — vendor skills.

## Releasing

Cutting a new release (publishes a signed + notarized macOS build to GitHub Releases for `electron-updater`):

1. Land your changes on `main` and confirm CI is green (CI runs on every push to `main` + PRs).
2. Bump and tag in one step: `pnpm version <patch|minor|major>` — updates `package.json`, regenerates `CHANGELOG.md` from the conventional commits (the `version` lifecycle hook → `pnpm changelog`, staged into the release commit), commits, and creates a matching `vX.Y.Z` git tag. The tag **must** equal `v<package.json version>`, or electron-builder publishes a mismatched release.
3. `git push --follow-tags` — pushing the `v*` tag triggers `.github/workflows/release.yml` (macOS runner): it re-runs the gate, then `pnpm release` builds, signs, notarizes, and uploads `dmg` + `zip` + `latest-mac.yml`.
4. electron-builder uploads to a **draft** release (the workflow pre-creates it with auto-generated notes so both uploaders share one release — no split-draft race) — open it on GitHub, verify the assets and notes, then **Publish** (and "Set as latest") so users and the auto-updater can see it.

Signing/notarization secrets live on the repo (`gh secret list`): `CSC_LINK` (base64 Developer ID `.p12`), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Identity is pinned in `electron-builder.yml`. To ship **unsigned** instead, drop the `CSC_*`/`APPLE_*` env from `release.yml`, set `CSC_IDENTITY_AUTO_DISCOVERY: "false"`, and set `notarize: false`.

## Decision log
- Stack: electron-vite/React 19/TS strict, shadcn+Tailwind v4, pnpm, Biome, Vitest+Playwright, Conventional Commits.
- shadcn on **Base UI** instead of Radix (user choice), `base-nova` preset.
- zustand; git via CLI shell-out; xterm.js + node-pty; per-repo config in app-side store.
- App shell = sidebar + tabs + collapsible bottom terminal; one repo per window; react-resizable-panels.
- Docs split: slim CLAUDE.md + project skills in `.agents/skills/` (symlinked at `.claude/skills/`).
- IPC = **tRPC over electron-trpc** (user choice over hand-rolled bridge: no casts, zod-validated inputs). File tree = lazy per-directory reads.
- shadcn `sidebar` primitive for the app sidebar (user feedback → hard rule 5); sidebar collapses to rail, no drag-resize.
- Folder hiding: right-click Hide/Unhide + eye toggle (dimmed in show-hidden mode); filtering in MAIN process. Recents on welcome screen (app config store in userData/config.json).
- Auto-open last repo on startup. Git diffs: working-tree first, sidebar Files/Changes tabs, unified + split rendering (user toggle).
- Data fetching = TanStack Query via @trpc/react-query (caching, invalidation); vanilla tRPC client only inside zustand stores. Syntax highlighting = Shiki (dark-plus), per-line tokens in viewer + diffs.
- Terminal shipped: node-pty in main + xterm.js renderer, streaming via tRPC subscription; scrollback replay on reattach. Window default 1400x900.
- Liquid-glass: vibrancy under-window + hiddenInset title bar + alpha theme tokens; drag regions via .app-drag/.app-no-drag. Sidebar drag-resizable (--sidebar-width override, 180-520px). Tree multi-select via cmd-click → batch hide.
- Cmd+P file finder: git ls-files (cached 30s) + custom subsequence fuzzy scorer in main; shadcn command dialog, shouldFilter=false (server-side filtering).
- Virtualized rendering (@tanstack/react-virtual, VirtualRows) for file viewer + diff rows — never render all lines. gitStatus polls 3s/staleTime 0; gitDiffFile staleTime 0 (git data must be live, unlike fs reads).
- Flow-ordered review shipped: default layer conventions (deepest-segment-wins matching) + import-edge parsing of changed files; per-repo layer overrides in config schema (no UI yet). Changes list renders grouped by layer, entry-point → data.
- History: sidebar History tab (200 commits, relative dates); commit tab = file list + per-file diff reusing HunksView/DiffModeToggle (extracted from DiffView).
- Cmd+W closes tab (before-input-event in main → appEvents subscription), Ctrl+Tab cycles tabs. UI prefs persisted (zustand/persist, localStorage). readFile returns FileView union (text/image/binary).

- Worktrees: sidebar footer shows current branch (5s poll) + dropdown switcher (git worktree list --porcelain); switching clears tabs and opens the worktree path as the repo.

- Changes rows show +adds/−dels (git diff --numstat merged into gitFlow). Middle-click closes tabs. recentRepos prunes non-existent paths.

- Perf batch: gitFlow memoized on status+numstat key (no 3s re-reads), file list stale-while-revalidate + warm on repo open, finder debounce/loading/reset-on-close, hover prefetch (diffs + files), sidebar resize via direct CSS-var writes. ErrorBoundary at root + renderer console piped to dev stdout. All `@base-ui` entries pre-bundled (`optimizeDeps.entries`) — lazy discovery duplicated React and blank-screened. Tab bar on ScrollArea + tab context menu (close others/left/right/all); global themed scrollbars. GOTCHA: Base UI `GroupLabel` must sit inside `Group` (Radix didn't care).

- Flow-layer settings UI shipped: gear in sidebar footer → dialog editing per-repo layers (label + regex, reorder, add/remove, reset, inline validation, helper with Stories example); `repoLayers`/`setRepoLayers` procedures. `layerFor` lost its Tests special case — deepest match covers filename layers generally.
- Markdown reader: react-markdown + remark-gfm + @tailwindcss/typography prose, Reader/Source toggle (persisted, reader default), links open externally. Markdown files only; reader view is not virtualized.

- Right "Quick Access" sidebar: nested second shadcn SidebarProvider (controlled by `rightSidebarOpen` preference, Cmd+. via new `shortcut` prop on the provider; left keeps Cmd+B). Sections follow the left tab (`sidebarTab` preference): Files → Pinned (per-repo `pinnedPaths`, tree context-menu Pin/Unpin, reuses TreeNode); Changes/History → git quick commands; Changes only → commit composer (type/scope chips learned from last 200 subjects via `parseConventions` + message). "Commit all" commits directly (`gitCommit` = `git add -A` + `git commit -m`, stderr surfaced inline); a secondary icon button types the command into the terminal instead. Terminal inserts NEVER auto-execute (no newline); text queued via `pendingInput` if the pane is still opening.
- Verification happens in `~/Code/porcelain-playground` (mock repo, recreate at will) — never drive tests against the user's work repos.

- **Embedded terminal removed entirely** (user decision: Porcelain must not compete with Ghostty/Warp — being a terminal *companion* requires not having one). node-pty/xterm/react-resizable-panels dropped, postinstall chmod gone, no bottom pane. Quick commands now RUN directly (`gitQuickCommand`, whitelisted `QUICK_COMMANDS` in git.ts) with stdout+stderr shown inline (errors red); everything invalidates after a run.

- Quick edits shipped (user decision — relaxes "read-only by design"): pencil on text-file tabs → plain textarea (NOT CodeMirror/Monaco; staying lightweight), Cmd+S saves via `writeTextFile`. Viewer right-click menu: Copy / Find references / Copy (relative) path / Reveal in Finder; edit mode gets Cut/Copy/Paste. Find references = `git grep --fixed-strings` → `search` tab kind, results jump to line (Tab.line + VirtualRows scrollToLine + row highlight). Quick commands got distinct per-command icons. GOTCHA: ui ContextMenuTrigger defaults to `select-none` — pass `select-text` where selection matters.

- Branding: porcelain squircle logo (sources from user) → `build/icon.{png,icns,ico}` (832px artwork padded to 1024, regenerate via iconutil) + `src/renderer/src/assets/logo.png` on welcome/empty viewer. Subtitle everywhere: "Review changes as a story".
- Packaging & auto-update: `electron-builder.yml` (dmg+zip arm64, Developer ID signing from keychain, hardened runtime, `notarize: false` until notarytool creds exist), `pnpm dist` = local installer, `pnpm release` = publish to GitHub releases (`fabiofiorita/porcelain`, needs `GH_TOKEN`). `electron-updater` in `src/main/updater.ts` (packaged only, 4h checks, auto-download, install on quit), `update-status` AppEvent → `updateStatus` query → `UpdateButton` pill in TopBar ("Update to vX" → quitAndInstall).

- Skills canonical in `.agents/skills/`; `.claude/skills/` symlinks all skills for Claude discovery. Root `AGENTS.md` symlinks to `CLAUDE.md` (canonical). Vercel composition skill compiled doc renamed `AGENTS.md` → `GUIDE.md` to avoid colliding with root.
- No `void` on promises — use async/await for tRPC invalidation, prefetch, clipboard, etc.
- Hardening batch (advisor plans 001–004, see `plans/`): `shell.openExternal` gated by `isSafeExternalUrl` allowlist (http/https/mailto, `src/main/external-url.ts`); `readFile` stats first and returns `too-large` FileView over 10MB (`src/main/read-limits.ts`); config persisted via generic `createJsonStore` (`src/main/json-store.ts` — atomic tmp+rename writes, corrupt-file backup to `.corrupt-*`, serialized `updateConfig` mutations replace load→save pairs); finder hidden-path filter extracted to `visibleFilePaths` in `repo-config.ts` with tests.
- Theme switched to shadcn preset `b2D0xPJT8` (luma style, emerald primary, Geist Mono via `--font-mono`, small radius). `apply` needs a stub `vite.config.ts` (framework detection fails on electron-vite; delete after). GOTCHA: `apply` overwrites `ui/` — re-apply local customizations after (sidebar `shortcut` prop, ScrollArea `orientation` prop, dark `--background`/`--sidebar` alpha for glass).
- UX batch: Cmd+F find-in-file bar (`FindBar` in viewer.tsx, line-based matches, Enter/Shift+Enter cycle); viewer context menu is selection-aware (selection → Copy/Find references, none → path/reveal actions); right sidebar drag-resizable (`rightSidebarWidth` pref + `RightSidebarResizeHandle`); Cmd+1/2/3 switch sidebar tabs; `.DS_Store` filtered in `readDir`; markdown source overlap fixed (CodeLine `whitespace-pre` + VirtualRows `w-max` rows → horizontal scroll, no wrap); finder results wrapped in `CommandGroup` (padding); single-click opens *preview* tabs (italic title, replaced by next preview; double-click/edit pins via `pinTab`).
- Settings dialog (`components/settings/settings-dialog.tsx`): gear in sidebar footer → dialog with nested `SidebarProvider` (shortcut={null}) — sections General (diff/markdown prefs) + Review flow (`flow-layers-section.tsx`, replaces the old standalone FlowLayersDialog).
- Project switcher dropdown in the sidebar header (`project-switcher.tsx`, recent repos + open dialog; switching clears tabs like worktrees). Colored per-filetype icons (`components/viewer/file-icon.tsx`) in tree/finder; folder icon follows expanded state; sidebar tabs got distinct colored icons.
- Git suggestions: `parseSuggestions` (`src/main/suggestions.ts`, pure + tested) over `status --porcelain=v2 --branch` + `stash list` → `gitSuggestions` procedure → "Suggested" sparkle rows atop Quick commands (pull when behind, push when ahead, stash pop when stashed, stash when dirty; 5s poll).
- Edit mode keeps syntax highlighting: transparent-text textarea over an aria-hidden Shiki backdrop (memoized per-line, scroll-synced) — still no CodeMirror/Monaco.
- No edit button (user decision): text files are always editable with 800ms-debounced autosave (+flush on unmount, Cmd+S) and a status chip; >5000-line files fall back to read-only virtualized view; markdown reader stays read-only (edit in source mode). shadcn `kbd` added for shortcut hints (TopBar tooltips, ⌘P empty state, ⌘S chip).
- Commit chips strictly history-derived (no static defaults appended; defaults only for repos with zero conventional commits). Sidebar tab bar = floating glass pill (sticky + backdrop-blur, rounded-full), labels collapse to icons under 17rem via container query.
- Dev/prod config split: `pnpm dev` sets `userData` to `porcelain-dev` (before anything reads config) and seeds first-run recents with `~/Code/porcelain-playground` (`src/main/dev-config.ts`) — dev never opens or hijacks the user's real repos; the installed app keeps its own state.

- **Client architecture codified** (replaces the vercel-composition-patterns pointer; that vendor skill removed — audit found near-zero actual usage). One public component per file (viewer.tsx 595→41; right-sidebar/diff-view/settings/file-tree split accordingly); ALL tRPC access in domain hooks `hooks/use-<domain>.ts` that own invalidation (components can't import `lib/trpc` — Biome `noRestrictedImports` override; vanilla client only in `stores/repo.ts` + `use-app-events.ts`); tabs store is the router (`tabId(kind, key)` helper, exhaustive `switch` in Viewer, repo switching = `repo.switchTo` store action); `@main/*` type-only alias (4 config files in sync); component tests mock hooks, never the tRPC proxy (`src/test-setup.ts`, exemplars `history-list.test.tsx`/`changes-list.test.tsx`). Full convention set in the `architecture` skill "Client architecture".

- **Glaze design system** (spec: `plans/005-glaze-design-system.md`): floating porcelain tiles over the vibrancy void — left/right sidebars `variant="floating"`, main panel is a `.glaze-tile` div (8px void everywhere), tab bar = capsule segments (`.glaze-segment`, active = `--surface-2` + glaze + emerald underglow). Tokens in `main.css` below the preset blocks (`--surface-0..3`, `--hairline`, `--glaze`, `--hover-fill`, `--shadow-tile/float`, `--ease-glaze` + durations, emerald `--ring`); signature = 1px specular top-edge highlight on every tile. `ui/surface.tsx` = CVA wrapper (tones tile/raised/glass/chip, motion hover) — attach to shadcn parts via Base UI `render`. GOTCHA: no `backdrop-filter` on ancestors of `position:fixed` sidebars (containing-block trap); blur is a no-op over the vibrancy void anyway. Phases 2–4 (dialog glass, radius reconciliation, row hover adoption, semantic diff tokens) tracked in the spec.

- **CI/release via GitHub Actions** (repo public at `FabioFiorita/porcelain`). `.github/workflows/ci.yml` runs install→lint→typecheck→test→build on Ubuntu for pushes to `main` and all PRs (no native modules, so no macOS runner needed for checks). `.github/workflows/release.yml` runs on `v*` tags on `macos-14`: same gate then `pnpm release` (= `electron-builder --mac --publish always`), publishing dmg+zip+`latest-mac.yml` to a GitHub Release for `electron-updater`. `GH_TOKEN` = the auto `GITHUB_TOKEN` (`permissions: contents: write`); mac signing/notarization are optional via `CSC_LINK`/`CSC_KEY_PASSWORD`/`APPLE_*` secrets — unsigned until set, which disables macOS auto-update. `packageManager` pinned to `pnpm@10.26.1` so `pnpm/action-setup` resolves the version. Cut a release with `pnpm version <patch|minor|major> && git push --follow-tags`.

- Decision log entries are **dateless bullets** — position is the chronology, git holds the real timestamps. Append at the end; match the existing terse style (bold lede for a major decision, GOTCHA/file pointers inline). Each entry still updates its home skill per hard rule 4; the log is the "why", the skill is the "what".

- **macOS signing + notarization wired** (release builds are now signed + notarized, not unsigned). Repo secrets set: `CSC_LINK` (base64 Developer ID `.p12`), `CSC_KEY_PASSWORD`, `APPLE_TEAM_ID` (=`9QH8M89WF9`); `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` complete the set. `electron-builder.yml`: `notarize: true` + `identity` pinned to the Developer ID Application name (the exported p12 also carries the Apple Development cert, so the identity must be explicit). `release.yml` passes all five via `env` (dropped the `CSC_IDENTITY_AUTO_DISCOVERY:false` unsigned fallback). GOTCHA: never map an *empty* `CSC_LINK` secret into env — a defined-but-empty value makes electron-builder attempt signing and die with `<projectDir> not a file`; either set it real or omit it. Release runbook in the `## Releasing` section above.

- **Release double-draft race fixed**: electron-builder publishes the dmg + zip concurrently and each uploader created its own draft when no release existed (assets split across two). `release.yml` now pre-creates a single draft (`gh release create "$GITHUB_REF_NAME" --draft --generate-notes`, idempotent via `gh release view ||`) before `pnpm release`, so both uploaders reuse it. Still draft-then-manually-publish by design (electron-updater ignores drafts; lets you verify assets before going live).

- **Changelog generated from conventional commits** (`CHANGELOG.md`): `conventional-changelog` (the maintained CLI; `conventional-changelog-cli` is deprecated) with the `conventionalcommits` preset. `pnpm changelog` = `conventional-changelog -p conventionalcommits -i CHANGELOG.md -r 0` (full deterministic regen from all `v*` tags; overwrites). A `version` lifecycle script (`pnpm changelog && git add CHANGELOG.md`) runs it on every `pnpm version` bump and folds the result into the `chore: release vX` commit — verified that `pnpm version` runs the hook and includes staged files. Only `feat`/`fix`/breaking surface (preset default); `ci`/`chore`/`docs`/`refactor`/`test` are intentionally hidden as non-user-facing. `repository` field added to `package.json` so commit/compare links resolve; `CHANGELOG.md` excluded from the packaged app in `electron-builder.yml`.

- Agent-session integration design (beyond a plain terminal)
