---
name: architecture
description: Porcelain's stack, the one client architecture every feature follows, repo facts, and the app-shell decisions/traps the code can't show you. Read before writing or reviewing any code in this repo.
---

# Porcelain architecture

This skill is the **durable layer**: the stack, the single architecture every feature follows, and the decisions, "why"s, and traps you can't recover by reading one file. It deliberately does **not** paraphrase how a feature is wired today — for that, open the entry file named in the `## Nomenclature` table in `CLAUDE.md` (or the module map below) and read it. The code is always current; this skill tells you what a fresh read won't.

## Stack

| Area | Decision |
|---|---|
| Shell | Electron via **electron-vite**, React 19, TypeScript (strict) |
| UI | **shadcn/ui on Base UI** (`@base-ui/react`, not Radix) + Tailwind CSS v4, `base-nova` preset, Geist font, dark mode default |
| Client architecture | **Porcelain's own conventions** (see "The one architecture" below): tab-store routing, domain data hooks, one public component per file |
| Client state | **zustand** — small stores per concern; no other state libraries |
| Git backend | Shell out to `git` CLI from the main process; parse porcelain-format output; no git libraries |
| Per-repo config | App-side JSON store under `~/Library/Application Support/porcelain`, keyed by repo path; never write into work repos |
| Package manager | **pnpm** |
| Lint/format | **Biome** (no ESLint/Prettier) |
| Tests | **Vitest** (unit/component, `src/**/*.test.{ts,tsx}`) + **Playwright** (Electron e2e in `e2e/`, `*.spec.ts`) |

## The one architecture

The renderer has exactly one architecture; every feature follows it. Hard rule 1 points here. Layering, top to bottom:

```
main process (src/main/api.ts procedures, pure logic in own modules)
  → lib/trpc.ts (ONE client; import restricted to hooks/ and stores/)
    → hooks/use-<domain>.ts (domain data hooks: queries, mutations, invalidation)
      → components/<area>/*.tsx (UI only; consume hooks + stores)
stores/ (zustand: client-only state — tabs, repo, preferences, selection)
```

### Routing — the tabs store IS the router

No URL routing, no router library; the active tab's `(kind, path, line)` in `stores/tabs.ts` is the entire navigation state. A screen = a `TabKind` (`file | diff | commit | search | feature | explore`). `Tab.path` is overloaded per kind (documented on the type; `explore` also carries an optional `symbol`). Tab ids are ALWAYS built with `tabId(kind, key)` — never hand-build `"diff:..."` strings. `Viewer` (`components/shell/viewer.tsx`) dispatches kind → view with an **exhaustive `switch`** (no default; the annotated return type turns a missing case into a compile error). Preview semantics: single-click opens a preview tab (italic) the next preview replaces; double-click, editing, or a non-preview re-open pins (`pinTab`).

**Split view = panes, not extra tab state.** The store holds `panes: Pane[]` (`{ tabs, activeTabId }`) plus `activePaneIndex`. The key invariant: **`openTab`/`pinTab`/`cycleTab`/`closeAllTabs` keep their signatures and always act on the active pane**, so every opener (tree, finder, changes/history/search/feature) is pane-agnostic and needed zero changes. `openTabToSide(tab)` opens in the other pane; pane-scoped ops (`closeTab`/`closeOtherTabs`/`…ToLeft`/`…ToRight`/`activateTab`) take `(paneIndex, id)`. Closing a pane's last tab collapses the split (`normalize` drops empty panes, keeps ≥1). Triggers: "Open to the Side" context items + Cmd+Shift+S.

**Recipe — adding a new screen/tab kind** (e.g. `blame`), in order:
1. Pure logic in its own `src/main/<thing>.ts` module with a `<thing>.test.ts` next to it.
2. Procedure on the router in `src/main/api.ts` (zod input; `AppRouter` updates automatically).
3. Hook in `src/renderer/src/hooks/use-<domain>.ts` wrapping the procedure (new file only for a genuinely new domain).
4. `'blame'` added to `TabKind` in `stores/tabs.ts`.
5. View component `components/git/blame-view.tsx` — one public component, takes its key as a single prop, reads data via the hook.
6. Opener calls `openTab({ id: tabId('blame', key), ... })`.
7. New `case` in `Viewer`'s switch (the compiler forces this).
8. Keyboard binding in `use-app-shortcuts.ts` if needed.

Repo switching is one store action: `useRepoStore.switchTo(path)` (closes all tabs, opens the repo) — used by `ProjectSwitcher` and `WorktreeSwitcher`; never clear tabs ad hoc. The right sidebar follows `preferences.sidebarTab` (the LEFT sidebar's tab), not the active main tab — two parallel nav axes by design.

### Data hooks (`src/renderer/src/hooks/`)

- One module per domain, `use-<domain>.ts` — **read the directory for the current set; don't expect a list here to stay complete** (an enumerated list here went stale before). Thin declarative wrappers — no business logic.
- Query options (enabled guards `repo !== null`, `staleTime`, `refetchInterval`, `placeholderData: keepPreviousData`) live in the hook, not the component.
- **Hooks own invalidation**: each mutation hook lists its targeted invalidations in `onSuccess` (`Promise.all`). The ONLY blanket `utils.invalidate()` is `useQuickCommand` (pull/stash change everything — documented escape hatch). Hover prefetch is a hook too.
- `use-app-events.ts` consumes the one main→renderer push channel (`window.porcelain.onAppEvent`), mounted once in `AppShell`. There are NO tRPC subscriptions — push rides the dedicated `app-event` IPC channel. (The terminal adds a SECOND dedicated channel — `window.porcelain.terminal`, bidirectional — consumed by `use-terminal-channel.ts`, also mounted once in `AppShell`; see the Terminal subsystem.)
- Enforced: a Biome `overrides` block makes importing `@renderer/lib/trpc` from `components/**` a lint error — components reach the server only through hooks.

### State placement — one rule per kind of state

- Server/git/fs state → TanStack Query via domain hooks, nowhere else.
- Cross-component UI state → a zustand store in `stores/`, one file per concern; components subscribe with fine-grained selectors (`useXStore((s) => s.field)`) at the leaf — no prop-drilling stores (sole exception: `LeftSidebarHandle` drilled `RepoShell`→`TopBar`, forced by nested SidebarProviders).
- Prefs that survive reload → the single persisted `preferences` store (localStorage `porcelain-preferences`). Nothing else persists.
- Everything else → component-local `useState`. Never `useState` for state another component reads.
- Store actions may call other stores via `useXStore.getState()`; components use hooks.

### Component authoring

- **One public component per file**; filename = kebab-case of the export. Private module-scoped subcomponents only when tightly bound to the export; an independent feature (own queries/state) gets its own file. Co-location exceptions: inseparable variant pairs (`file-icon.tsx`), a component + its companion hook (`code-line.tsx` + `useHighlighter`), mutually recursive components (`tree-node.tsx`).
- Named exports only (`export function PascalCase()`); the sole default export is `App`. Class components only where React requires it (`ErrorBoundary`).
- Explicit return types: `React.JSX.Element` (`| null` when conditionally empty); handlers `void`/`Promise<void>`.
- Props typed INLINE in the destructuring parameter. A named `XProps` interface only for generic components (`VirtualRowsProps<T>`); domain/data types may be named interfaces.
- Handlers named by intent (`run`, `save`, `switchTo`, `select`) — never `handleX`; callback props use `onX`.
- Composition: plain prop-driven components + zustand; `children`-wrapper components for menu/boundary shells; render-prop only for generic virtualized lists; Base UI's `render={<.../>}` to merge shadcn triggers. NO app-authored React context, no boolean-prop variant proliferation.
- Pure single-file helpers stay module-scoped at the top; pure shared helpers go in `@renderer/lib/` with a test; reused stateful logic is a `useX` hook returning named callbacks. Derive, don't store, computed values. Always `cn()` for conditional classNames.

### Keyboard shortcuts — tiered ownership (deliberate, don't "centralize")

1. Main-process `before-input-event` ONLY to override an Electron/OS default (Cmd+W).
2. App-global bindings acting on stores → `use-app-shortcuts.ts` (Ctrl+Tab, Cmd+1–6, Cmd+Shift+S, plus the context-aware "new" keys: **Cmd+T** always spawns a terminal; **Cmd+N** follows `preferences.sidebarTab` — Board → new card, Terminal → new terminal).
3. A shortcut toggling one component's local state registers its own window listener in that component (Cmd+P in `file-finder`, Cmd+F in `text-file-view`).
4. Focused-element shortcuts as element `onKeyDown` (Cmd+S on the editor textarea; Cmd+Enter/Cmd+S in the card composer).
5. Sidebar toggles via the `SidebarProvider` `shortcut` prop (Cmd+B / Cmd+.).

Earned rules a fresh read won't show:
- **A shortcut that fires a tRPC mutation can't live in `use-app-shortcuts.ts`** — that hook is under `components/**`, where importing `lib/trpc` is a lint error (mutations go through hooks, which only components may call). So the Files fs-shortcuts (Cmd+N new file, Cmd+Shift+N new folder, Cmd+D duplicate, Cmd+⌫ trash) live in a dedicated always-mounted component, `file-commands.tsx` (next to `FileFinder` in `AppShell`), guarded to `sidebarTab === 'files'`. The global hook keeps only store/bridge actions (spawn terminal, open a draft).
- **`isTextEntry` (`lib/keyboard.ts`) is the "don't hijack typing" guard, but it deliberately excludes `.xterm`** — xterm's hidden textarea reports as editable, yet Cmd+T/Cmd+N must still spawn a terminal while the PTY is focused.
- **Terminal editing chords are translated in the xterm registry**, not via window listeners — `attachCustomKeyEventHandler` returns `false` to swallow the key and `window.porcelain.terminal.write`s the right bytes. Cmd+K clears (meta only, **never Ctrl-K** = readline kill-to-end-of-line, which must reach the shell); the rest is the pure, unit-tested `terminalEditBytes` (`lib/terminal-keys.ts`): ⌘⌫→Ctrl-U, ⌘←/→→Ctrl-A/E, ⌥⌫→word-delete, ⌥←/→→word-move, ⇧↵→`\n` (newline for multiline TUIs). ⌥+letter is left alone so Option-compose still types accents. **The destructive Files shortcuts (⌘D/⌘⌫) must NOT fire over a focused terminal** — `FileCommands` guards with `isTerminalTarget`, the inverse of `isTextEntry`'s `.xterm` carve-out (which exists so ⌘T/⌘N still spawn while a PTY is focused).
- **"Compose intent" two surfaces share rides a tiny zustand store, with ONE dialog mounted in `AppShell`** — `file-prompt` (new file/folder/rename) → `FilePromptDialog`; `card-draft` (holds `CardDraft` + `draftFromCard`) → `CardComposer`. Board surfaces and the keyboard both call the store's `open`; mounting the dialog once avoids two stacked modals when the sidebar list and the viewer board are both mounted. The selection store also tracks the last-clicked `active` row so keyboard file ops know where to land.

### Testing

- Pure logic (main-process parsers, lib helpers, zustand stores) → unit tests next to source (`foo.test.ts`). This is where most coverage lives — keep logic pure and main-side.
- Component tests (`foo.test.tsx`) mock the **domain hooks**, never the tRPC proxy: `vi.mock('@renderer/hooks/use-history', ...)` returning plain objects. Shape mock data with `@main` types so drift breaks the build. Exemplars: `history-list.test.tsx`, `changes-list.test.tsx`.
- Setup `src/test-setup.ts` wires jest-dom, an explicit `afterEach(cleanup)` (globals off — import from `'vitest'`), a `window.matchMedia` stub (any `SidebarProvider` mount needs it), and a `document.elementFromPoint` stub (ProseMirror/TipTap needs it). Reset zustand between tests with `useXStore.setState(...)` in `beforeEach`. No snapshot tests.
- **Playwright Electron e2e** (`e2e/`, `pnpm test:e2e` — builds first, then `playwright test`): the SECONDARY tier and a **release gate** (see `releasing`), NOT part of the per-commit gate (hard rule 3 stays the four fast commands). Each test `_electron.launch`es the BUILT app (`out/main/index.js`) so the real preload + tRPC/git layer exist — driving the dev URL in bare Chromium does NOT work. The fixture (`e2e/helpers/`) builds a deterministic git repo, seeds a temp `userData` (the build runs as `is.dev` so main appends `-dev` to `--user-data-dir` — write `config.json` THERE), points `PORCELAIN_REVIEW_SETS` at a temp file, and sets `PORCELAIN_E2E=1` (effectively headless — main skips `mainWindow.show()`, keeps `backgroundThrottling:false` so the never-shown window still paints for screenshots; Playwright drives over CDP). Selectors are role/label based. Earned gotchas: (1) **`PLAYWRIGHT_FORCE_ASYNC_LOADER=1` is REQUIRED** (baked into the scripts) — on Node ≥22.15 Playwright's sync loader hook throws `context.conditions?.includes is not a function` on the first relative TS import. (2) Playwright uses a self-contained `e2e/tsconfig.json` (no `paths`). (3) Screenshots are DOM-only, per-platform (`-darwin`), committed under `e2e/*.spec.ts-snapshots/`; regenerate intentional UI changes with `pnpm test:e2e:update`. (4) **Full-page baselines have a 2% diff tolerance, so a change in a narrow column hides under it** — give tight regions an **element-scoped baseline** (e.g. `quick-access-changes.png` snapshots just the right panel) so a restyle there actually fails.

## Repo facts (cross-file truths)

- Aliases `@renderer/*` → `src/renderer/src/*` and `@main/*` → `src/main/*` are defined in **FOUR places that must stay in sync**: `electron.vite.config.ts`, `tsconfig.web.json`, root `tsconfig.json` (the shadcn CLI needs it), `vitest.config.ts`.
- `@main` imports in the renderer are **type-only** (`import type`) — never runtime-import main code (esbuild erases the types; a runtime import leaks Node into the bundle). Main = OS/git/fs access; renderer = pure UI, no Node APIs.
- **Data fetching = TanStack Query via domain hooks** (`@trpc/react-query@11` + `@tanstack/react-query@5`). v5 idioms: mutations expose `isPending`; "keep last data" is `placeholderData: keepPreviousData`; query-level `onSuccess`/`onError` are gone (invalidation lives in mutation `onSuccess`). Never ad-hoc `useEffect`+`useState` fetching. **IPC details and the never-`void`-a-promise rule are `audit` invariants — read them.**
- **IPC = tRPC over a custom Electron link we own** (the only IPC pattern; `electron-trpc` is gone). The full transport + "only shuttle bytes, never read tRPC internals" rationale lives in the `audit` skill.
- **Syntax highlighting = Shiki**, theme `dark-plus`, singleton in `lib/highlight.ts`. Tokenization is **whole-file, not per-line** (`tokenizeLines` runs `codeToTokensBase` over the entire content) so grammar state carries across line breaks — per-line lost it and mis-colored multiline comments/template literals. The diff reconstructs each hunk's old/new image and tokenizes those (cross-hunk context is inherently unavailable). Geist Mono ligatures are disabled globally so `===`/`=>`/`??` stay legible.
- shadcn components live in `src/renderer/src/components/ui/` (excluded from Biome); add via `pnpm dlx shadcn@latest add <name>`. Base UI uses the `render` prop, not Radix's `asChild` — see the `shadcn` skill's `rules/base-vs-radix.md`.
- **Theme: neutral graphite, ONE dark theme.** There is NO theme picker (a blue option + Theme tab were built then cut), and `<html class="dark">` is hardwired in `index.html`. Semantic/status/diff/ink colors are tokenized for both `:root` (light) and `.dark`, but **no light theme ships yet** (the `.dark` values reproduce the old literal shades exactly; `:root` values are pre-authored but untested). **TRAP — re-applying a shadcn preset overwrites `ui/` AND the color block;** afterwards restore: the sidebar `shortcut` prop, the ScrollArea `orientation` prop, `kbd.tsx`'s tooltip-content colors (`bg-foreground/10 text-popover-foreground`, not `text-background`), the dark alpha tokens (`--background`/`--sidebar`), the transparent `body`, and re-apply the neutral accent in `main.css` (`apply` needs a temporary stub `vite.config.ts` to pass framework detection).
- **Main-process pure logic** lives in `src/main/*.ts`, each with a sibling `.test.ts` — that's where most coverage lives. Map (read the file for current behavior): `flow.ts` (flow layers/grouping — `groupByLayer` is the ONE grouping impl, shared by feature + explore), `feature-view.ts` / `feature-slice.ts` / `feature-explore.ts` (feature/explore reading), `diff.ts` (porcelain-z + unified-diff parsers), `git.ts` (shell-out), `suggestions.ts`, `fuzzy.ts`, `conventions.ts`, `repo-config.ts`, `json-store.ts` / `config-store.ts` (persistence), `external-url.ts`, `read-limits.ts`, `plugin-assets.ts` / `plugin.ts`, `review-set.ts` / `review-store.ts` / `review-watch.ts`, `file-watch.ts` (the open-file working-tree watcher — live-refreshes the viewer when the agent edits a file on disk), `comment-store.ts`, `board-store.ts`, `actions-store.ts` (the 4th agent channel), `terminal-manager.ts` (the PTY map — the one impure, non-unit-tested main module: it spawns shells). Router + procedures in `api.ts`; IPC wiring in `ipc.ts` (tRPC + the terminal channel).

## App shell — traps & decisions (not an inventory)

The map (which file is which region) is the `## Nomenclature` table in `CLAUDE.md`; read the entry file for mechanics. What a fresh read won't tell you:

- **Embedded terminal (added 2026-06-16, reversing the old "never a terminal" rule).** Porcelain now hosts real PTYs — see the **Terminal subsystem** section below for the architecture (native module, dedicated bridge, xterm registry). **One repo per window** still holds; a window's PTYs die with it.
- **Dev isolation:** `pnpm dev` runs on `~/Code/porcelain-playground` with `userData` `porcelain-dev` (`src/main/dev-config.ts`) — never the user's real repos. Verify/screenshot there. (An `audit` invariant.)
- **Chrome heights are coupled:** the full-width window titlebar (`title-bar.tsx`), the rail/panel headers, the viewer header (`TopBar`), and the right-sidebar header are all `h-12`, and `trafficLightPosition { x:19, y:16 }` in main is tuned to that 48px titlebar flush with the window top (`AppShell` is a flex-col — titlebar over the columns row). Change the titlebar height and the macOS traffic lights drift.
- **Unified titlebar owns the traffic lights** (`title-bar.tsx`, full-width above the tiles — lights + a centered search button that raises the finder via `stores/file-finder.ts`; `file-finder.tsx` adds a ⌘K alias, skipped over a focused terminal so its clear-screen survives). Because the lights left the sidebar, the project switcher became an **avatar at the rail top** (`project-switcher.tsx`) and the panel header is a contextual title + Files-only controls (collapse-all + hide-files); the old `pl-7` lights-clearance hack is gone. Footer = branch chip + worktrees picker, both opening `WorktreeSwitcher` (variant prop) — a worktree IS a branch here (no bare checkout).
- **Collapse-all is a nonce, not a store of expanded paths.** Folder expansion is per-`DirNode` local state (the tree reads lazily — there's no central map to clear), so the Explorer collapse-all bumps `stores/file-tree.ts`'s `collapseNonce` and every node collapses in an effect keyed on it (skipping its mount so a reveal-expanded node isn't snapped shut). Don't add a central expansion store to "fix" this.
- **The sidebar divider lives on the rail's `SidebarContent`, not the rail `Sidebar`** — on the `Sidebar` it would cut through the chrome. Inner rail + panel are `bg-transparent` so only the outer floating tile carries the glass alpha (two `--sidebar` alphas double-darken). `--sidebar-width-icon` is overridden to `3.5rem` for the compact rail; Cmd+B collapses to the rail (`collapsible="icon"`, not offcanvas) and clicking a rail icon `setOpen(true)` re-reveals the panel.
- **Resize handles write the CSS variable directly during the drag and commit to the store only on mouseup** — sidebar width, notes height, and split ratio all share this trick. A store write per `mousemove` re-renders the whole app.
- **Two nested SidebarProviders:** the inner (right/Quick Access) takes `shortcut="."` so both don't grab Cmd+B (the provider gained a `shortcut?: string | null` prop); `TopBar` lives inside the inner provider, so left-sidebar state is drilled to it via `RepoShell`. The two `TopBar` toggle icons are **deliberately different** — left `PanelLeft`, right `Zap` — never mirror-image panel icons.
- **Glaze is classes, not a component:** `.glaze-tile` / `.glaze-chip` are the one way to apply the porcelain-glass material (a `Surface` wrapper component existed and was **deleted on purpose** because glaze is applied onto diverse elements a wrapper can't express — don't reintroduce it). `.glaze-chip` routes its focus ring through `outline`, not the Tailwind ring box-shadow (which its own box-shadow would clobber → invisible focus).
- **`ink-amber` is the single "action to take" accent** — the Commit button is an `ink-amber` ember (not the filled `primary` slab), reused by the suggestion rows. Don't introduce a second CTA color or revert Commit to `primary`.
- **TipTap is a scoped exception:** allowed ONLY in the Notes card (a companion surface). The file viewer stays a plain textarea over a Shiki backdrop — no CodeMirror/Monaco, no LSP, no autocomplete. (A product principle; see `product`.)
- **The editor adopts external file changes ONLY when clean.** `EditorSource` keeps the file in local `useState` (so it must opt in to a `readFile` refetch — the read-only/reader views re-render from the prop for free). When the prop's content changes (the agent edited the file on disk; see the `file-watch` watcher in `audit`), it reloads **only if there are no unsaved edits** (`content === savedContent`); mid-edit, the user's text wins and we never clobber it. Don't make it always adopt (clobbers in-progress edits) or never adopt (the editable view goes stale again — the bug this fixed).
- **Markdown reader is NOT virtualized** (`MarkdownView`, react-markdown) — never route code files through it. Reader links get `target="_blank"` → main's `setWindowOpenHandler`, gated by `isSafeExternalUrl` (an `audit` invariant).
- `kbd.tsx` patch: inside `tooltip-content` the kbd uses `bg-foreground/10 text-popover-foreground` (shadcn's default `text-background` is dark-on-dark on our non-inverted tooltip → invisible). Re-apply if a preset overwrites `ui/`.
- **File-tree reveal** (Changes → Open file) drives expansion through a **controlled** `Collapsible` (`open={expanded}`) + a target path in `stores/reveal.ts`; because reads are lazy, each ancestor opening mounts the next level until the leaf scrolls into view and highlights.
- Base UI requires `DropdownMenuLabel` inside `DropdownMenuGroup` — outside one it throws `MenuGroupContext missing`.
- **Tree Delete = `shell.trashItem`** (moves to the macOS Trash, recoverable), never a permanent unlink; it's the one destructive tree action, so it confirms via an `AlertDialog`.
- **Crash/self-verify:** `ErrorBoundary` wraps the app (`App.tsx`); in dev, main pipes the renderer `console-message` + `render-process-gone` to stdout — read them from the `pnpm dev` log to self-verify a change.
- **Vite `optimizeDeps.entries` must cover `src/**/*.{ts,tsx}`** or a lazily-discovered `@base-ui/react/*` entry re-optimizes mid-session, loads a second React copy, and crashes with "Invalid hook call". (An `audit` invariant.)
- **Four agent channels over the stdio MCP server** (`src/mcp/`): review sets (agent→app), review comments (app→agent), the project board (two-way), and saved actions (two-way). Each is one `~/.porcelain/*.json` file. The reading surfaces share one grouping (`groupByLayer`) and one renderer (`reading-surface.tsx`); the inline feature reading is **MCP-only** (null without a review set); explore is heuristic (relative imports only — won't cross the client→server seam). The channel files, write-safety, and the "app makes exactly ONE write to the review-set channel" rule live in the `audit` skill — **read it before touching any of them.**

## Terminal subsystem (the one place the "one architecture" deliberately bends)

The embedded terminal doesn't fit the tab-store→hook→component data flow, because a terminal is a live bidirectional byte stream, not request/response data. What a fresh read won't tell you:

- **`node-pty` is the one native module** (main `dependencies`). It's required — a real PTY (to run `claude`/TUIs) has no pure-JS equivalent on macOS. It reverses the old native-module-free property: `electron-builder install-app-deps` rebuilds it for Electron's ABI (also `onlyBuiltDependencies` lists it for pnpm), and it ships a `pty.node` + a `spawn-helper` binary that **must be `asarUnpack`ed and signed** (see `audit`/`releasing`). `@xterm/xterm` + `@xterm/addon-fit` are renderer `devDependencies` (Vite-bundled, pre-discovered by `optimizeDeps.entries`).
- **A second dedicated IPC bridge, NOT tRPC and NOT app-event.** `window.porcelain.terminal` (preload) carries `create`/`write`/`resize`/`kill` out and `data`/`exit` back; PTYs live in `terminal-manager.ts` (`Map<id,{pty,sender}>`), keyed per window so they die on window close. Lifecycle control is here, not in a hook — a terminal isn't TanStack-Query data. tRPC stays for the Actions *definitions* (CRUD), which ARE data.
- **A terminal is a `TabKind`, so split view + tabs come for free** — no bespoke panel. Terminal tabs open **pinned** (a click must not replace a running shell like a preview tab). The `path` field holds the session id. **One xterm instance = one DOM node = one pane:** unlike a file (cloneable into both panes), a terminal can live in only ONE pane, so `openTab` activates an already-open terminal in place and `openTabToSide` MOVES it (the `tab.kind === 'terminal'` branches in `stores/tabs.ts`); `detachTerminal` is container-scoped so a moved terminal's old pane can't yank the wrapper back and blank the new one. Don't "simplify" these back to the generic clone path — that reintroduces the blank-pane bug.
- **xterm instances live in a module registry (`lib/terminal-registry.ts`), NOT in React.** The viewer only mounts the active tab, so a `Terminal` kept in component state would be destroyed (losing scrollback + detaching a background dev server) on every tab switch. Instead each session's `Terminal` is opened into a detached wrapper `<div>` the view merely re-parents on mount and detaches (never disposes) on unmount. Early PTY output is buffered in the registry until the instance exists, so nothing is lost between spawn and first mount. `use-terminal-channel.ts` (mounted once in `AppShell`) routes the inbound bridge into the registry — the inbound twin of `useAppEvents`.
- **Session lifetime is independent of the tab.** `stores/terminals.ts` is the roster (client-only, not persisted — PTYs are ephemeral). Closing a terminal *tab* keeps the PTY running (so a background server survives); `close`/`reset` are what actually kill it. Repo switch calls `reset` (cwd changed → old PTYs are wrong), on top of `closeAllTabs`.
- **Nerd Font fallback, not a font swap.** The terminal's xterm `fontFamily` is Geist Mono *then* `"Symbols Nerd Font Mono"` (vendored MIT, `assets/fonts/`, `@font-face` in `main.css`) — Geist Mono renders text, the symbols font fills powerline/devicon glyphs per-glyph so prompts don't show tofu. It's terminal-only (app chrome never references it) and works only because xterm uses the DOM renderer (CSS per-glyph fallback). The **Mono** variant is required (single-cell, aligns to the grid).
- **Actions are the 4th agent channel** (`~/.porcelain/actions.json`, `actions-store.ts` ↔ `src/mcp/action-file.ts`) — same shape/rules as the board, but the *content is an executable command* the human runs. Running = spawn a terminal with the command typed into a fresh login shell (so it stays live after — Ctrl-C, re-run). The agent CRUDs definitions only; it never executes one (see `audit`).

## Packaging, signing, updates

Durable config facts (the step-by-step runbook is the `releasing` skill): `electron-builder.yml` — appId `com.fabiofiorita.porcelain`, mac targets dmg + zip (arm64; the **zip** is what electron-updater downloads), hardened runtime, signs with the "Developer ID Application" identity. Auto-update is wired in `src/main/updater.ts` (no-op unless `app.isPackaged`; checks on launch + every 4h, installs on quit) and surfaced by the TopBar `UpdateButton` + the Settings Updates section (same backend). The MCP server is a **second main build input** (`electron.vite.config.ts`) emitting `out/main/mcp/server.js`, importing only Node builtins so a plain `node` can run it. Icons regenerate from `build/icon.png` (1024 master) via iconutil + ImageMagick. **Dep placement** (main/preload deps in `dependencies`, renderer-only in `devDependencies`) and the **empty-`CSC_LINK`** trap are `audit` invariants.

## Conventions

- **shadcn primitives only**: never hand-roll a primitive (sidebar, tabs, dialog, tree, …); search shadcn/registries first; a new primitive requires user approval.
- Strict TS, no `any`, no `as unknown as`, no dead code, no commented-out code.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Verification gate before any commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must all pass.
- **Related skills**: `audit` = the security/correctness/perf/type invariants to preserve (read before main-process/IPC/config/git/packaging changes); `releasing` = the release runbook; `product` = what/why for features. This skill is the *what* for code structure.
