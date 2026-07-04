---
name: audit
description: Porcelain's hard-won invariants — the security, correctness, performance, and type-safety rules the codebase must never silently regress. Read before changing the main process, IPC, config persistence, git plumbing, file reads, external-URL handling, packaging, or data-fetching wiring; and when reviewing a change for regressions. Each invariant says what to preserve, why it exists, and how to verify you didn't break it.
---

# Porcelain — invariants to preserve

A "don't regress these" checklist. These are constraints the codebase **earned**
— most were a bug, a crash, or a security gap before the fix landed. Breaking one
rarely fails a test; it fails in production. Before touching the listed area, read
the invariant; after, verify it still holds. The hard rules in `CLAUDE.md` are
assumed — this skill is the codebase-specific layer beneath them.

## Security & process boundary

- **External URLs go through `isSafeExternalUrl`** (`src/main/external-url.ts`,
  http/https/mailto allowlist). Every `shell.openExternal` / `setWindowOpenHandler`
  path is gated. Extend `ALLOWED_PROTOCOLS` deliberately; never drop the guard.
  *Why:* an unfiltered `openExternal` runs `file://`/custom-scheme URLs from
  rendered content. *Verify:* new external-link code calls the guard.
- **`readFile` stats before it reads** and returns `{type:'too-large'}` above
  `MAX_READ_BYTES` (10 MB, `src/main/read-limits.ts`). Never read the bytes of an
  oversized file. *Why:* a multi-GB file in a 50 GB monorepo OOMs the main process.
- **Main process = the only OS/git/fs surface.** Renderer is pure UI, no Node APIs.
  `@main/*` imports in the renderer are **type-only** (`import type`) — never
  runtime-import main code. *Why:* runtime coupling leaks Node into the bundle.
- **Never write into the user's work repos.** Per-repo state lives in the app config
  under `userData` (`~/Library/Application Support/porcelain`), keyed by repo path.
- **Dev never opens or mutates real repos.** `pnpm dev` sets `userData` to
  `porcelain-dev` before any config read and seeds recents with
  `~/Code/porcelain-playground` (`src/main/dev-config.ts`). Verification/testing
  happens in the playground, never against the user's work repos.
- **The MCP agent channel adds NO inbound network surface.** The feature-view MCP
  server (`src/mcp/`) is a standalone **stdio** process the user's agent spawns — it
  never opens a port or socket the app listens on. The app *reads* and *watches* one
  file, `~/.porcelain/review-sets.json` (`review-store.ts` / `review-watch.ts`), which
  it re-validates with zod (`reviewSetsSchema`) on every read because an external
  process owns it. The MCP server **authors** the sets; the app makes exactly ONE
  write — `clearReviewSet` (user-initiated from the Feature tab's Clear button), an
  atomic tmp+rename that deletes a repo's entry (reverting to the baseline). That's a
  local home-dir file write, NOT a network surface, and the app still never authors a
  set. Don't add other app-side writes to this file, and don't "upgrade" the channel
  to an in-app HTTP/MCP listener — that's the inbound surface this design deliberately
  avoids. The server
  stays **dependency-free** (Node builtins only) so it runs under a plain `node`; don't
  add npm imports to `src/mcp/`, and keep tool inputs validated in `toReviewFiles`.
  *Verify:* `rg -n "createServer|listen\(|http" src/main src/mcp` finds nothing new.
- **Agent-channel review-set paths are repo-contained on read.**
  `readReviewSet` (`src/main/review-store.ts`) drops any review-set entry whose
  path is absolute or escapes `repoPath` (`isRepoContained`), because the file
  is authored by an external process and its paths flow into
  `readFile(join(repoPath, path))`. *Why:* without it, a malicious/injected
  review set could read arbitrary local files into the feature view. *Verify:*
  new code that reads agent-supplied paths routes through the filtered set.
- **The review-comment channel is a SECOND, two-way agent channel**
  (`~/.porcelain/comments.json`, `comment-store.ts` ↔ `src/mcp/comment-file.ts`),
  kept SEPARATE from review-sets so the "app makes one write to the review-set
  channel" rule above stays intact. Here the **app** authors comments — so their
  `path`s are app-supplied, never externally injected (no repo-containment guard
  needed, unlike review-sets) — and the MCP server only reads them and flips
  `resolved` (`resolve_review_comment`). Both sides write atomically (tmp + rename);
  the app serializes its own read-modify-write. A cross-process race with an MCP
  resolve is rare and low-stakes (a lost resolve just reappears; the watcher
  re-syncs). Still stdio only, no network surface. Don't add an app-side write here
  that accepts an agent-supplied path, and keep both writers atomic. The **project
  board** (`~/.porcelain/board.json`, `board-store.ts` ↔ `src/mcp/board-file.ts`) is a
  THIRD channel of the same shape and the same rules apply: app-and-agent-authored
  *content* (not filesystem paths), atomic writes on both sides, stdio only.
- **Saved actions are agent-writable but HUMAN-executed.** The 4th channel
  (`~/.porcelain/actions.json`, `actions-store.ts` ↔ `src/mcp/action-file.ts`) is the
  same shape as the board, but its content is a *shell command* — higher stakes than
  inert card text, because an agent that writes the file could plant a command. The
  safeguards that make this acceptable, all of which must hold: (1) **nothing in the
  agent channel executes an action** — the MCP server exposes only `list/create/update/
  delete_action`, NO run tool; running is solely a human click in the app. Don't add a
  `run_action` MCP tool. (2) The **full command text is always visible** in the Actions
  Quick Access row (and its run tooltip) before the human clicks — never hide or
  truncate-without-recourse the command. (3) It runs in a **visible PTY** (the user sees
  output), via the user's login shell with the command typed in — there's no silent
  background execution. *Verify:* the MCP tool list has no execute verb; the Action row
  still shows `command`.
- **Repo notes are a READ-ONLY, app→agent channel.** The 5th channel
  (`~/.porcelain/notes.json`, `notes-store.ts` ↔ `src/mcp/notes-file.ts`) is the
  human's freeform per-repo markdown scratchpad. The **app is the SOLE writer** (the
  Notes card) and the MCP server only reads it (`get_repo_notes` — there is NO
  notes-write tool, and don't add one; notes are the human's, captured tasks belong on
  the board). Because nothing else writes it, it has **no `review-watch` entry** —
  don't add a watcher expecting agent pushes. The content is inert markdown (not a
  path, not a command), so no repo-containment or command-injection guard applies, but
  keep the app's writes atomic (tmp + rename) like the others. Notes moved here out of
  `userData/config.json` only because the dependency-free MCP can't resolve userData;
  `migrateNotesFromConfig` (startup, idempotent) carries legacy notes over and never
  clobbers a newer in-app edit. *Verify:* the MCP tool list still has only
  `get_repo_notes` for notes; the app never reads `config.repos[*].notes` except in the
  migration.
- **Flow layers are a TWO-WAY channel whose content is auto-executed regex.** The 6th
  channel (`~/.porcelain/layers.json`, `layers-store.ts` ↔ `src/mcp/layers-file.ts`,
  `get/set/reset_flow_layers`) holds the per-repo review-flow layers. Same two-way shape
  and rules as the board (app-and-agent-authored content, atomic writes both sides,
  stdio only, a `review-watch` entry → the `layers` app-event). What's DIFFERENT and must
  hold: the content is a `pattern` the main process **compiles and runs** on every flow
  build (`compileLayers` in `flow.ts`, `new RegExp(pattern, 'g')`), not inert text — so
  **the app's read MUST drop any layer whose pattern doesn't compile** (`readLayers` in
  `layers-store.ts` filters with `compilable`), or one bad agent-written pattern throws
  and breaks every grouping view (gitFlow/featureView/exploreFeature). The MCP's
  `toLayers` likewise rejects an uncompilable pattern up front. Patterns run against
  short repo-relative paths and the human can already type any valid regex in Settings →
  Review flow, so the ReDoS surface is unchanged — don't add a bespoke complexity guard
  here that the human path lacks; just keep the compile-on-read filter. Layers moved out
  of `userData/config.json` (like notes) so the dependency-free MCP can read+write them;
  `migrateLayersFromConfig` (startup, idempotent) carries a legacy override over and
  never clobbers a newer in-app edit. *Verify:* an MCP-written invalid pattern is dropped,
  not thrown, on the next flow poll; the app reads layers only from the channel (no
  `config.repos[*].layers` read outside the migration).
- **Reviewed marks are a READ-ONLY, app→agent channel.** The 7th channel
  (`~/.porcelain/reviewed.json`, `reviewed-store.ts` ↔ `src/mcp/reviewed-file.ts`,
  `Record<repoPath, string[]>`) holds the repo-relative paths the human has ticked as
  reviewed in the Changes/Feature lists. Same shape and rules as the notes channel: the
  **app is the SOLE writer** (`markReviewed`/`unmarkReviewed`, and `clearReviewedPaths`
  which `gitCommit` calls to drop the just-committed files' marks) and the MCP server only
  reads it (`get_reviewed_files` — there is NO mark-write tool, and don't add one;
  "reviewed" is the human's act, not the agent's). Because nothing else writes it, it has
  **no `review-watch` entry** — don't add a watcher expecting agent pushes. Paths are
  inert here (the agent reads them as review-progress context; the app already validates
  any path it acts on), so no repo-containment guard applies, but keep the app's writes
  atomic (tmp + rename) and in-process-serialized like the others. Marks moved here out of
  `userData/config.json` (`config.repos[*].reviewedPaths`, now a deprecated optional field
  kept only for the migration) so the dependency-free MCP can read them;
  `migrateReviewedFromConfig` (startup, idempotent) carries legacy marks over and never
  clobbers a newer in-app mark. *Verify:* the MCP tool list has only `get_reviewed_files`
  for reviewed state; the app reads marks only from the channel (no
  `config.repos[*].reviewedPaths` read outside the migration).
- **The feature-view snapshot is a READ-ONLY, app→agent channel.** The 8th channel
  (`~/.porcelain/feature-view.json`, `feature-snapshot-store.ts` ↔
  `src/mcp/feature-view-file.ts`, `Record<repoPath, { name, files: { path, source, layer }[] }>`,
  exposed as `get_feature_view`) holds Porcelain's COMPUTED feature view — every file it
  renders with its **git-truth** source (`changed`/`context`/`shipped`) and flow layer. It
  exists because that git truth lives only in the main process (the dependency-free MCP has
  no git), yet the agent needs it to tell a diffed file from a context/cross-seam one — and
  `get_review_comments` now tags each comment with this source. Same shape and rules as the
  notes/reviewed channels: the **app is the SOLE writer** (`writeFeatureSnapshot`, called from
  `getFeatureBuild` on every view rebuild), the MCP server only reads it (NO write tool — and
  don't add one; the snapshot is derived, not authored), there is **no `review-watch` entry**
  (nothing pushes back), and writes stay atomic + in-process-serialized. The content is inert
  (app-supplied repo-relative paths + source/layer labels, not externally injected and not a
  filesystem path the app resolves), so no repo-containment guard applies — but it's a derived
  snapshot, refreshed only while the Feature surfaces poll, so treat it as "the view as last
  rendered," never as source of truth (the agent's own pushed set is still `get_feature_review`).
  *Verify:* the MCP tool list has only `get_feature_view` for it; the only writer is
  `writeFeatureSnapshot`; `rg -n "createServer|listen\(|http" src/mcp` still finds nothing.
- **The plugin installer is the ONLY non-git shell-out, and it takes no user input.**
  `installPlugin` (`src/main/plugin.ts`) spawns a login shell to run a FIXED command
  (`claude plugin marketplace add <app-derived dir> && claude plugin install …`) —
  the only interpolated value is `~/.porcelain/plugin`, derived from `homedir()`, never
  from the renderer. It's user-initiated from Settings. Don't let any renderer-supplied
  string reach that command string (injection). It writes the plugin under `~/.porcelain`
  (home, not a work repo) and copies the built `out/main/mcp/server.js` in. *Verify:* the
  spawn args stay a constant template; `git`'s `execFile` (no shell) remains the pattern
  everywhere else.

## Config persistence

- **All config writes go through `createJsonStore`** (`src/main/json-store.ts`):
  atomic tmp+rename writes, corrupt files backed up to `.corrupt-*`, and
  `updateConfig(mutate)` serializes read-modify-write. Never reintroduce a bare
  load→mutate→save pair. *Why:* concurrent mutations dropped writes; a crash
  mid-write corrupted `config.json`. Read-only callers may use `loadConfig`.
- **Hidden-path filtering happens in the MAIN process** (`visibleFilePaths` in
  `repo-config.ts`, tested), not the renderer — the renderer must never receive
  paths the user hid.

## Git plumbing

- **Every git invocation sets `GIT_OPTIONAL_LOCKS=0`** (`runGit` in `src/main/git.ts`).
  *Why:* the 3s `gitStatus`/`gitFlow` background polls otherwise rewrite `.git/index`
  under a lock, racing the user's own `pull`/`commit` and failing it with
  `fatal: Unable to write index.`. The flag disables only optional refreshes;
  required locks for real mutations are untouched. Don't remove it.
- **Commit never auto-stages.** `gitCommit` = `git commit -m` on **staged** changes
  only; staging is explicit (`gitStageAll` / `gitStageFile` / `gitUnstageFile`).
  Porcelain is a review tool — silently `git add -A` on commit is surprising.
- **Quick commands run a whitelist** (`QUICK_COMMANDS` in `git.ts`), never arbitrary
  shell. New quick actions are added to the whitelist, not passed through.
- **Status listings use `-uall`** (`--untracked-files=all`) in `gitStatus` and
  `gitDiffFile`'s status probe (`git.ts`). *Why:* the default `-unormal` collapses
  an untracked directory into one `dir/` row; that row reaches the Changes list and
  `gitDiffFile` then `readFile`s the directory → `EISDIR` (blank tab + error). With
  `-uall` every new file is its own diffable row. *Verify:* new `git status` calls
  that feed the changes list keep the flag; clicking a newly-added folder's files
  diffs cleanly.

## Data fetching & IPC

- **IPC is tRPC over a custom Electron link we own** (tRPC **v11** + `@tanstack/react-query` **v5**). `electron-trpc` is gone (abandoned at 0.7.1, never supported v11). The transport: renderer uses tRPC's official `httpBatchLink` with a custom `fetch` (`lib/trpc.ts`) → `window.porcelain.trpc` → `ipcRenderer.invoke('trpc')`; main (`src/main/ipc.ts`) replays it through tRPC's official `fetchRequestHandler`. Keep all protocol logic inside tRPC — only shuttle bytes; don't reintroduce a transport that reads tRPC internals (that's what rotted electron-trpc). The lone main→renderer push is the dedicated `app-event` IPC channel (`window.porcelain.onAppEvent`), NOT a tRPC subscription. Never raw `ipcMain`/`ipcRenderer` for data; never cast (`as unknown as` is banned repo-wide).
- **Components never import `@renderer/lib/trpc`** (Biome `noRestrictedImports`
  override on `components/**`). All server access goes through domain hooks
  (`hooks/use-<domain>.ts`) that own their post-mutation invalidation. The vanilla
  client is sanctioned only in `stores/repo.ts` and `use-app-events.ts`.
- **Never `void` a promise** to silence a floating-promise lint — use `async`/`await`
  or `await Promise.all([...])` for invalidation/prefetch/clipboard.

## Performance (must stay fast on a 50 GB monorepo)

- **Never render all lines of a file.** File viewer and diffs render through
  `VirtualRows` (`@tanstack/react-virtual`); Shiki tokenizes only mounted rows.
- **Never index what isn't visible.** File tree = lazy per-directory `readDir` on
  expand; nothing indexed up front. `git ls-files` is cached/stale-while-revalidate.
- **`optimizeDeps.entries` must cover `src/**/*.{ts,tsx}`** so every `@base-ui/react/*`
  entry is pre-bundled. *Why:* a dep discovered lazily mid-session re-optimizes,
  loads a second React copy, and crashes with "Invalid hook call".
- **Git queries are live, fs queries are cached.** `gitFlow` (staleTime 0 + 3s poll)
  and `gitDiffFile` (staleTime 0) must reflect the working tree; fs-backed queries
  keep the 30s default. The 3s poll is cheap only because main memoizes flow on a
  status+numstat+layers key (`flowCache`) — don't break that key.
- **Open file documents stay fresh by a watcher, NOT by polling `readFile`.** The
  agent editing a file in the terminal must show up in the viewer, but giving
  `readFile` a `refetchInterval` would re-read every open file on a timer and throw
  away the 30s cache. Instead the renderer pushes its open file-tab paths (`watchFiles`,
  `useWatchOpenFiles`) and main watches just **those files' directories** (`file-watch.ts`),
  emitting `working-tree` → invalidate `readFile` + `gitDiffFile`. *Why dirs, not the
  tree:* a recursive watch on a 50 GB repo is the thing this rule exists to avoid, and
  it would drown in `.git`/`node_modules` churn — watching the handful of open files'
  dirs (filtered by basename, surviving tmp+rename) is O(open tabs). Don't "upgrade" it
  to a recursive working-tree watch, and don't make `readFile` poll.
- **The Files tree stays fresh by a watcher, NOT by polling `readDir`.** Same shape as
  the open-files watcher: the renderer pushes the set of currently-**expanded** dir paths
  (`watchDirs`, `useWatchTreeDirs`, tracked in the `tree-dirs` store) and main
  (`setWatchedDirs` in `file-watch.ts`) puts ONE non-recursive `fs.watch` on each,
  emitting the window-targeted `file-tree` event → invalidate `readDir` + `pinnedEntries`
  + `gitFlow`. This stays O(expanded dirs): `.git` events are dropped (git's index churn
  must not spam refetches), watchers are capped per sender (extras fall back to the
  3s-stale tab switch), and a burst of events is debounced into one send. It must NEVER
  become a recursive tree watch (the 50 GB / `node_modules` churn trap) and `readDir`
  must keep its 30s cache. Watchers are reaped on window close via `clearWatchedDirs`
  (next to `clearWatchedFiles`).

## Packaging

- **Main/preload deps stay in `dependencies`; renderer-only libs in `devDependencies`.**
  electron-vite externalizes main/preload imports and electron-builder copies them
  *whole* into `app.asar`; Vite bundles renderer libs regardless of section.
  Misplacing a dep either bloats the bundle (~100 MB regression) or breaks the
  packaged app at runtime. *Verify:* a dep imported by `src/main`/`src/preload`
  must be in `dependencies`.
- **Never map an empty `CSC_LINK` into the release env.** A defined-but-empty value
  makes electron-builder attempt signing and die with `<projectDir> not a file` —
  set it real or omit it entirely. (See the `releasing` skill.)
- **`node-pty` is the lone native module — keep it unpacked, rebuilt, and signed.**
  It loads in the main process, so it stays in `dependencies` (externalized, copied
  whole into the app), is rebuilt for Electron's ABI by `electron-builder install-app-deps`
  (and listed in `onlyBuiltDependencies` so pnpm allows its build), and `electron-builder.yml`
  `asarUnpack`s `node_modules/node-pty/**` — both `pty.node` AND the `spawn-helper`
  binary it `exec`s must live on disk outside `app.asar` and be code-signed/notarized,
  or the packaged app's terminal can't spawn (a PTY fails, or notarization rejects an
  unsigned Mach-O). *Why:* this is the app's first native dependency; nothing else
  needs unpacking. *Verify:* a packaged build's `Resources/app.asar.unpacked/node_modules/node-pty`
  exists and the terminal opens. The renderer half (`@xterm/*`) is Vite-bundled
  `devDependencies` — no packaging concern.

## How to verify

- The gate before any commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  must all pass (hard rule 3).
- Invariants above that the gate does **not** catch (security guards, git env flags,
  dep placement) need a human/agent read of the diff — that's what this
  skill is for. When reviewing, walk this list against the changed files.
