# Plan: Multi-window support (one project per window)

> **Executor instructions**: Read this plan fully before starting. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. Per `CLAUDE.md` hard
> rule 8, commit straight to `main` — never branch — and run the gate
> (`pnpm lint && pnpm typecheck && pnpm test && pnpm build`) before committing.

## Status

- **Goal**: open a second (third, …) window, each holding a **different** repo,
  with fully independent tabs / terminals / changes / state.
- **Effort**: M (the architecture is already ~90% there — see "Why this is mostly free").
- **Risk**: LOW–MED (touches the main→renderer push channel and window lifecycle;
  no git/IPC-protocol or security-boundary changes).
- **Planned at**: commit `47b54ae`, 2026-06-18.
- **Non-goals**: the *same* repo in two windows (allowed but not optimized — no
  focus-existing, no dedup); cross-window preference sync; a tab-tearing/drag-between-windows UX.

## Why this is mostly free (read before estimating)

Porcelain is already structured for multiple windows; most of the hard parts are done:

- **`createWindow()` is a re-callable function with no singleton `mainWindow`**
  (`src/main/index.ts:26`). `app.on('activate')` already calls it again when no
  windows exist (`index.ts:139`). More windows = call it again.
- **The tRPC handler is process-wide and stateless** — `createContext: () => ({})`
  (`ipc.ts:20`), and **every** procedure takes `repoPath` (or an absolute path) as
  input (`api.ts`). The main process holds **no "current repo"**; the renderer's
  `useRepoStore` (`stores/repo.ts`) does, per window. Two windows on two repos just
  pass two different paths to the same handler.
- **All renderer state is per-renderer-process** — `repo`, `tabs`, `terminals`,
  `selection`, etc. are zustand stores that simply exist once per window. Nothing
  to change.
- **PTYs are already keyed per window** — `createTerminal(event.sender, …)` and
  `killTerminalsForSender` reap on window close (`terminal-manager.ts:96`,
  wired at `index.ts:60`). Correct as-is.
- **Config writes are concurrency-safe** — `updateConfig` serializes atomic
  read-modify-write (`json-store.ts`), so two windows writing `recentRepos` won't
  corrupt anything.

What's left is: (1) **one real bug** — Cmd+W broadcasts to every window; (2) make
the main→renderer push **window-targeted** where it must be; (3) a **New Window**
entry point; (4) **boot logic** so a new window doesn't clone the last repo.

## The problems to fix

1. **Cmd+W closes a tab in *every* window (real bug).** `before-input-event` fires
   only for the focused window (`index.ts:75`) but calls `emitAppEvent('close-tab')`
   → a **global** listener bus (`app-events.ts:12`) → `pipeAppEvents` forwards to
   **all** windows (`ipc.ts:39`). So one Cmd+W closes a tab everywhere.

2. **`working-tree` (file-watch) is one global watcher set, broadcast to all.**
   `file-watch.ts` documents this explicitly ("One global watcher set, not
   per-window… the app is effectively single-window"). With two windows it watches
   the *union* of both windows' open files and fires `working-tree` at *both* → each
   window re-reads files it doesn't care about. Harmless (re-reads, never wrong
   data) but the premise is now false; make it per-window.

3. **Agent-channel events broadcast to all windows.** `feature-view`/`comments`/
   `board`/`actions`/`update-status` come from the global `review-watch` file
   watchers and broadcast (`app-events.ts` → `pipeAppEvents`). This is **harmless
   over-invalidation**: each window's hook invalidates *its own* repo's query, and
   the `~/.porcelain/*.json` files are keyed by repo path, so a window for a
   different repo refetches and sees no change. **We deliberately keep these as a
   broadcast** (the alternative — a window→repo registry feeding `review-watch` — is
   machinery this doesn't need). Documented, not changed.

4. **A new window would clone the last repo.** `restoreLastRepo` opens the
   most-recent repo (`repo.ts:24`), called unconditionally on boot
   (`app-shell.tsx:166`). A second window must instead open a *chosen* repo or land
   on the welcome screen.

5. **No way to spawn a window.** No app menu (no `Menu.buildFromTemplate`
   anywhere), and the only window-creation triggers are first launch + dock
   activate. Need a user-facing "New window" action.

## Design

### The key enabler — thread `event.sender` into the tRPC context

`ipcMain.handle('trpc', (event, request) => …)` has `event.sender` (the calling
WebContents) — we just don't pass it on. Thread it into `createContext` so any
procedure can target *its caller's* window **without any global mutable state**.
This is additive and doesn't disturb the stateless repo-path contract.

- `api.ts:96`: `const t = initTRPC.create({ isServer: true })`
  → `const t = initTRPC.context<TrpcContext>().create({ isServer: true })`, with
  `export interface TrpcContext { sender: WebContents }` (import
  `type { WebContents }` from `electron` — `api.ts` already imports from electron).
- `ipc.ts`: `createContext: () => ({})` → `createContext: () => ({ sender: event.sender })`.

### Window-targeted delivery (close-tab + working-tree); broadcast stays for agent channels

The renderer keeps **one** inbound channel (`window.porcelain.onAppEvent`) and
`useAppEvents` is **unchanged** — the only difference is main-side *who* we send to.
**No preload change** (`preload/index.ts` / `index.d.ts` untouched): everything
still rides the existing `app-event` IPC channel and the existing `trpc` bridge.

- **`close-tab`**: stop routing through the global bus. In `before-input-event`
  (which already has `mainWindow`), send directly:
  `mainWindow.webContents.send('app-event', 'close-tab')`. Remove the
  `emitAppEvent('close-tab')` call. (`'close-tab'` stays in the `AppEvent` union.)
- **`working-tree`**: make `file-watch.ts` per-window (see below) and send to the
  owning sender only.
- **Agent-channel events** (`update-status`/`feature-view`/`comments`/`board`/`actions`):
  keep `emitAppEvent` + `subscribeAppEvents` + `pipeAppEvents` exactly as-is
  (broadcast). Add a one-line comment at the `app-events.ts` emitter noting the
  broadcast is intentional and harmless under multi-window (per-repo keying makes a
  cross-window invalidation a no-op refetch).

### Per-window file-watch (`file-watch.ts`)

Re-key the watcher map by WebContents:

- `const watchers = new Map<WebContents, Map<string, { watcher: FSWatcher; files: Set<string> }>>()`
- `setWatchedFiles(sender: WebContents, paths: string[])` — reconcile only *that*
  sender's dir watchers; the change callback does
  `sender.send('app-event', 'working-tree')` (guard `!sender.isDestroyed()`) instead
  of `emitAppEvent('working-tree')`.
- `clearWatchedFiles(sender: WebContents)` — close all of a sender's watchers; call
  it from `mainWindow.on('closed')` next to `killTerminalsForSender(webContents)`
  (`index.ts:60`).
- `watchFiles` procedure (`api.ts:469`) uses the context:
  `.mutation(({ input, ctx }) => setWatchedFiles(ctx.sender, input))`.
- Update the module's header comment — drop the "effectively single-window"
  rationale; state it's now per-sender, reaped on window close.

`file-watch.ts` no longer imports `emitAppEvent`.

### New `window.ts` module — `createWindow` + the init registry

To let `api.ts` spawn windows without a circular import (`index.ts` → `ipc.ts` →
`api.ts`), move window creation into its own main module:

- **`src/main/window.ts`**:
  - `export type WindowInit = { mode: 'restore' } | { mode: 'open'; repoPath: string } | { mode: 'welcome' }`
  - `const pendingInits = new Map<WebContents, WindowInit>()`
  - `export function createWindow(init: WindowInit = { mode: 'restore' }): BrowserWindow`
    — the body currently in `index.ts:26-102`, plus
    `pendingInits.set(mainWindow.webContents, init)` after construction and
    `pendingInits.delete(webContents)` in the `closed` handler (alongside the
    file-watch + terminal cleanup).
  - `export function takeWindowInit(sender: WebContents): WindowInit` — returns the
    stored init (default `{ mode: 'restore' }`) and **deletes** it (one-shot read).
- **`index.ts`** imports `createWindow` from `./window`; `app.whenReady` calls
  `createWindow({ mode: 'restore' })`; `app.on('activate')` calls
  `createWindow({ mode: 'restore' })`. The window-body code leaves `index.ts`.
  (`pipeAppEvents`, the `closed` cleanup, dev console piping, `before-input-event`,
  `ready-to-show`, `setWindowOpenHandler`, load URL/file all move into `window.ts`.)

> The security invariant holds: `setWindowOpenHandler` + `isSafeExternalUrl` move
> with the body unchanged. The `trafficLightPosition` / `vibrancy` / sizing all move
> verbatim — every new window gets the same chrome.

### New procedures (`api.ts`)

- `windowInit: t.procedure.query(({ ctx }): WindowInit => takeWindowInit(ctx.sender))`
- `newWindow: t.procedure.input(z.object({ repoPath: z.string().optional() }).optional()).mutation(({ input }) => { createWindow(input?.repoPath ? { mode: 'open', repoPath: input.repoPath } : { mode: 'welcome' }) })`

`repoPath` flows only into the renderer's existing `openRepoPath` (which already
validates it's a real git repo); it never reaches a shell. No new network/exec
surface — audit invariants intact (`rg -n "createServer|listen\(|http" src/main src/mcp`
still finds nothing new).

### Renderer boot logic (`stores/repo.ts` + `app-shell.tsx`)

Replace the unconditional `restoreLastRepo()` with a window-init-aware boot:

- Add `boot: () => Promise<void>` to `useRepoStore`:
  ```ts
  boot: async () => {
    try {
      const init = await trpcClient.windowInit.query()
      if (init.mode === 'open') {
        set({ repo: await trpcClient.openRepoPath.mutate(init.repoPath) })
      } else if (init.mode === 'restore') {
        await get().restoreLastRepo()   // keeps its own restoring:false
        return
      }
      // mode 'welcome' → fall through to restoring:false with repo:null
    } catch {
      // ignore — welcome screen
    } finally {
      set({ restoring: false })
    }
  },
  ```
  (`restoreLastRepo` already sets `restoring:false` in its own `finally`; the early
  `return` avoids setting it twice. The `open`/`welcome` paths set it here.)
- `app-shell.tsx:165-167`: call `boot()` instead of `restoreLastRepo()` (swap the
  selector + the effect body).

### New Window entry point — project switcher (primary, decisive)

The project switcher avatar (`project-switcher.tsx`) is the "which project" control
— the natural home for "another project alongside this one." Add a `useNewWindow`
hook (`hooks/use-repo.ts`, wrapping `trpc.newWindow.useMutation`; components can't
import `trpc` directly per the Biome rule) and:

- A **"New window"** item in the bottom `DropdownMenuGroup` (next to "Open project…"),
  `onClick={() => newWindow.mutate(undefined)}` → opens a window on the welcome screen.
- A **trailing "open in new window" icon-button** on each recent row (a
  `lucide-react` `SquareArrowOutUpRight` or similar), `onClick` stops propagation and
  calls `newWindow.mutate({ repoPath: recent.path })`. (Keep the row's main click =
  `switchTo` in the *current* window.)

**Deliberately NOT in this plan** (note for the user, easy follow-ups):
- A macOS app menu (`File → New Window`). There's no menu today; adding a correct
  one means replicating the standard role-based template (Copy/Paste/Quit) — a
  separate, larger surface. The switcher item covers the need.
- A global keyboard shortcut. ⌘N (context-aware new) and ⌘⇧N (new folder) are both
  taken; picking a free chord is a UX decision, not plumbing. Skip until asked.

## Scope

**In scope (edit):**
- `src/main/window.ts` (**new**) — `createWindow` + `WindowInit` + the init registry.
- `src/main/index.ts` — import `createWindow`; drop the window-body code; both
  launch + activate pass `{ mode: 'restore' }`.
- `src/main/ipc.ts` — `createContext` carries `event.sender`.
- `src/main/api.ts` — typed context (`TrpcContext`); `windowInit` + `newWindow`
  procedures; `watchFiles` uses `ctx.sender`.
- `src/main/file-watch.ts` — per-`WebContents` watchers; `setWatchedFiles(sender, …)`
  + `clearWatchedFiles(sender)`; sends `working-tree` to the owning sender.
- `src/main/app-events.ts` — comment only (broadcast-is-intentional note); the
  union keeps `'close-tab'`.
- `src/renderer/src/stores/repo.ts` — `boot()`.
- `src/renderer/src/components/shell/app-shell.tsx` — call `boot()`.
- `src/renderer/src/hooks/use-repo.ts` — `useNewWindow`.
- `src/renderer/src/components/shell/project-switcher.tsx` — "New window" + per-recent open-in-new-window.

**Out of scope (do NOT touch):**
- `preload/index.ts` / `preload/index.d.ts` — no new bridge surface (everything
  rides existing `trpc` + `onAppEvent`). If you find yourself editing preload, stop
  and reconsider — the design avoids it.
- `terminal-manager.ts` — already per-sender.
- The agent-channel broadcast path (`review-watch.ts`, `pipeAppEvents`,
  `subscribeAppEvents`) — left as broadcast on purpose.
- `useAppEvents` handler logic — unchanged (same channel, same events).
- Same-repo-in-two-windows dedup/focus-existing; cross-window preference sync.

## Steps

1. **Context plumbing.** Add `TrpcContext` + typed `t` in `api.ts`; pass
   `event.sender` in `ipc.ts`. **Verify**: `pnpm typecheck` → 0.
2. **`window.ts`.** Create the module; move the window body out of `index.ts`; wire
   `pendingInits` set/delete + `takeWindowInit`. Update `index.ts` to import and call
   `createWindow({ mode: 'restore' })` at launch + activate. **Verify**: `pnpm build` → 0.
3. **Per-window file-watch.** Re-key `file-watch.ts` by sender; add
   `clearWatchedFiles`; call it from the window `closed` handler; point
   `watchFiles` at `ctx.sender`. **Verify**: `pnpm typecheck` + the existing
   `file-watch` behavior compiles; add/extend unit coverage (below).
4. **close-tab fix.** Replace `emitAppEvent('close-tab')` with
   `mainWindow.webContents.send('app-event', 'close-tab')` in the
   `before-input-event` handler (now in `window.ts`). Add the broadcast-intent
   comment in `app-events.ts`. **Verify**: `pnpm test` → 0.
5. **New procedures + boot.** Add `windowInit` + `newWindow` to `api.ts`; add
   `boot()` to `repo.ts`; switch `app-shell.tsx` to `boot()`. **Verify**: `pnpm typecheck` → 0.
6. **UI.** Add `useNewWindow`; wire the project-switcher items. **Verify**: `pnpm lint` → 0.
7. **Full gate.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all 0.
8. **Live check** (`pnpm dev`, on the dev **"Electron"** app, not installed
   Porcelain): open project A; from the avatar menu spawn a new window via a recent
   → window B opens on project B. Confirm: (a) Cmd+W in B closes a tab only in B;
   (b) editing a file in B's terminal refreshes B's viewer, not A's; (c) closing B
   leaves A intact and kills only B's PTYs; (d) Changes/Board/Terminal in each
   window reflect their own repo.

## Test plan

- **Unit (primary, main-side):** `file-watch.ts` is currently untested. Add
  `file-watch.test.ts` covering the per-sender keying: two fake `WebContents`
  (`{ send: vi.fn(), isDestroyed: () => false }`) watching different temp dirs;
  assert a change under sender A's dir calls `A.send('app-event', 'working-tree')`
  and **not** `B.send`; assert `clearWatchedFiles(A)` closes A's watchers and leaves
  B's; assert `setWatchedFiles(A, [])` drops A's watchers. (Use a temp dir +
  `fs.writeFile`; `fs.watch` is async — poll/await the mock like other fs tests, or
  factor the dir→basenames reconcile into a pure helper and unit-test that directly
  to avoid timer flake.)
- **Store:** extend `repo`-store coverage for `boot()` — mock `trpcClient.windowInit`
  to return each mode; assert `open` sets `repo`, `restore` delegates to
  `restoreLastRepo`, `welcome` ends with `repo:null, restoring:false`.
- **Component:** `project-switcher` test — mock `useNewWindow`; assert the "New
  window" item fires `mutate(undefined)` and a recent's open-in-new-window button
  fires `mutate({ repoPath })` **without** triggering `switchTo`.
- **e2e (optional, release-gate tier):** a Playwright spec can
  `electronApp.windows()` to assert a second window appears and is drivable. Tricky
  (needs the `newWindow` path to fire from the renderer); acceptable to defer and
  rely on the Step 8 manual check.
- **Gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (hard rule 3).

## Done criteria

Machine-checkable unless noted. ALL must hold:

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all exit 0.
- [ ] `rg -n "emitAppEvent\('close-tab'\)" src/main` → no matches (close-tab is sent direct).
- [ ] `rg -n "createServer|listen\(|http" src/main src/mcp` → no NEW matches (no inbound surface added).
- [ ] `rg -n "porcelain" src/preload` is unchanged vs. `HEAD` (no preload surface added).
- [ ] `file-watch.ts` keys watchers by `WebContents` and `clearWatchedFiles` is
      called from the window `closed` handler.
- [ ] New `file-watch.test.ts` passes and proves a change reaches only the owning sender.
- [ ] Manual (Step 8) on the dev "Electron" app: two windows, two repos; Cmd+W,
      file-refresh, and PTY-reaping are each window-scoped.

## STOP conditions

Stop and report (don't improvise) if:

- Moving the window body to `window.ts` introduces an import cycle the build flags,
  or the traffic-light position / vibrancy regresses (the chrome must move verbatim).
- Typing the tRPC context forces changes to many existing procedures (it should be
  purely additive — every current procedure ignores `ctx`).
- `fs.watch` per-sender turns out flaky in tests in a way that tempts you to weaken
  the assertion — instead factor the reconcile into a pure helper and test that.
- You find yourself needing a preload (`index.d.ts`) change — the design says you
  shouldn't; reconsider before adding bridge surface.

## Maintenance notes

- **The rule:** the renderer keeps exactly one inbound push channel (`onAppEvent`).
  Window-specific events (`close-tab`, `working-tree`) are sent to a specific
  `webContents`; repo-keyed agent-channel events stay broadcast because per-repo
  query keying makes a cross-window delivery a harmless no-op. Don't "fix" the
  broadcast by adding a window→repo registry unless a real cost shows up.
- **`ctx.sender`** is the sanctioned way for a procedure to act on its caller's
  window. It's per-call (not global mutable state), so it doesn't violate the
  stateless-server property.
- **Known accepted behavior:** `porcelain-preferences` lives in `localStorage`,
  shared across same-origin windows; a pref changed in one window persists but won't
  live-update the other until reload. Fine for now; a `storage`-event sync is a
  future nicety, not a bug.
- **Follow-ups deliberately deferred:** macOS `File → New Window` app menu + a
  (non-colliding) keyboard shortcut; same-repo focus-existing; tab tear-off between
  windows.
