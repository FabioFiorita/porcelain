# Plan 025: Characterize the updater, the agent-channel watcher, and window-init

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bb4a55..HEAD -- src/main/updater.ts src/main/review-watch.ts src/main/window.ts`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `7bb4a55`, 2026-06-26

## Why this matters

Three new-ish main-process lifecycle modules have **no tests**, and each owns logic that
only fails at runtime:

- `updater.ts` — the auto-update **state machine** (`idle → checking → available →
  downloaded | up-to-date | error`). An out-of-order event or a missed transition leaves
  the Settings → Updates UI showing a wrong/stale status. Cleanly testable by mocking
  `electron-updater`'s event emitter.
- `review-watch.ts` — watches the `~/.porcelain` agent channels and emits the matching
  app-event so an MCP write (a pushed review set, a resolved comment, a moved card) live-
  refreshes the open view. A mis-routed or dropped event means the app silently stops
  reflecting agent activity until the next poll. Same shape as the already-tested
  `file-watch.ts` (one watcher per directory, filename → event routing, fail-open on
  unsupported `fs.watch`).
- `window.ts` — `windowInitFor` is the **StrictMode-idempotent** read that decides what a
  booting window opens (restore / open repo / welcome). Its default-fallback floor is
  worth a test; the rest of `createWindow` is BrowserWindow wiring better left to e2e
  (see scope).

This is the same "pin the stateful main module" move as plans 009 and 024. The two high-
value, cleanly-mockable wins are `updater.ts` and `review-watch.ts`; `windowInitFor` is a
small bonus. **Do the easy two first** — if the `window.ts` portion balloons, ship the
first two and stop (see STOP conditions).

## Current state

### `src/main/updater.ts`

```ts
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { emitAppEvent } from './app-events'

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloaded' | 'up-to-date' | 'error'
  version: string | null
  error: string | null
  currentVersion: string
}

let status: UpdateStatus = { state: 'idle', version: null, error: null, currentVersion: app.getVersion() }

function setStatus(next: Partial<UpdateStatus>): void {
  status = { ...status, ...next }
  emitAppEvent('update-status')
}

export const updateStatus = (): UpdateStatus => status

const CHECK_INTERVAL = 4 * 60 * 60 * 1000

export function initUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking', error: null }))
  autoUpdater.on('update-available', (info) => setStatus({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => setStatus({ state: 'up-to-date', version: null }))
  autoUpdater.on('update-downloaded', (info) => setStatus({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (error) => setStatus({ state: 'error', error: error.message }))
  const check = (): void => { autoUpdater.checkForUpdates().catch(() => {}) }
  check()
  setInterval(check, CHECK_INTERVAL)
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (app.isPackaged) { await autoUpdater.checkForUpdates().catch(() => {}) }
  return status
}

export function installUpdate(): void { autoUpdater.quitAndInstall() }
```

Testing notes:
- `status` is **module-level**; `app.getVersion()` runs at import time. The `electron`
  mock must define `app.getVersion` before the module is imported (vi.mock is hoisted, so
  this is automatic).
- `app.isPackaged` gates `initUpdater`. Make it a **mutable** field on the mock so a test
  can flip it to `true` (wire listeners) or `false` (no-op).
- `autoUpdater` is used as an event emitter via `.on(event, cb)` plus `.autoDownload`,
  `.autoInstallOnAppQuit`, `.checkForUpdates()` (returns a promise), `.quitAndInstall()`.
- `setInterval` is called by `initUpdater` — use `vi.useFakeTimers()` so it doesn't run,
  and `vi.useRealTimers()` in `afterEach`.

### `src/main/review-watch.ts`

```ts
import { watch } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { actionsPath } from './actions-store'
import { type AppEvent, emitAppEvent } from './app-events'
import { boardPath } from './board-store'
import { commentsPath } from './comment-store'
import { layersPath } from './layers-store'
import { reviewSetsPath } from './review-store'

export async function watchAgentChannels(): Promise<void> {
  const targets: { path: string; event: AppEvent }[] = [
    { path: reviewSetsPath(), event: 'feature-view' },
    { path: commentsPath(), event: 'comments' },
    { path: boardPath(), event: 'board' },
    { path: actionsPath(), event: 'actions' },
    { path: layersPath(), event: 'layers' },
  ]
  const byDir = new Map<string, Map<string, AppEvent>>()
  for (const target of targets) {
    const dir = dirname(target.path)
    const files = byDir.get(dir) ?? new Map<string, AppEvent>()
    files.set(basename(target.path), target.event)
    byDir.set(dir, files)
  }
  for (const [dir, files] of byDir) {
    await mkdir(dir, { recursive: true }).catch(() => {})
    try {
      watch(dir, (_event, filename) => {
        if (!filename) {
          for (const event of new Set(files.values())) emitAppEvent(event)
          return
        }
        const event = files.get(filename)
        if (event) emitAppEvent(event)
      })
    } catch {
      // fs.watch unsupported on some platforms; pushes still surface on the views' polls.
    }
  }
}
```

Testing notes:
- Mock `node:fs` `watch` exactly like `file-watch.test.ts` (return `{ close: vi.fn() }`,
  capture the registered listener per directory).
- Mock `node:fs/promises` `mkdir` to resolve.
- Mock the five `*Path` modules so all paths share **one** directory (so a single watcher
  is registered and the filename→event map has all five): e.g. every path is `/p/<file>.json`.
- Mock `./app-events` so `emitAppEvent` is a spy. Note `AppEvent` is a **type** import in
  the source; the mock only needs to export `emitAppEvent`.

### `src/main/window.ts` (the testable seam only)

```ts
const pendingInits = new Map<WebContents, WindowInit>()

export function windowInitFor(sender: WebContents): WindowInit {
  return pendingInits.get(sender) ?? { mode: 'restore' }
}

export function createWindow(init: WindowInit = { mode: 'restore' }): BrowserWindow { /* … BrowserWindow wiring … */ }
```

`windowInitFor` is pure given the module Map. `createWindow` constructs a real
`BrowserWindow` and wires many electron handlers + a `?asset` icon import — unit-testing it
means mocking electron's `BrowserWindow`, `shell`, the `?asset` import, `./ipc`,
`./terminal-manager`, `./file-watch`, `./external-url`. That is high-effort and low-value
(it is window wiring, exercised by the e2e suite). **Scope `window.ts` to `windowInitFor`'s
default-fallback floor only** (see Step 4); do not mock BrowserWindow.

Conventions to match:
- Exemplar: `src/main/file-watch.test.ts` (fs.watch mock + structural fakes + synchronous
  assertions). Read it. Store tests like `src/main/board-store.test.ts` are secondary refs.
- Vitest, `*.test.ts` next to source. No `any`, no `as unknown as`.

## Commands you will need

| Purpose    | Command                          | Expected on success |
|------------|----------------------------------|---------------------|
| Install    | `pnpm install`                   | exit 0              |
| Test (one) | `pnpm test -- updater`           | all pass            |
| Test (one) | `pnpm test -- review-watch`      | all pass            |
| Test (one) | `pnpm test -- 'window'`          | all pass            |
| Full gate  | `pnpm verify`                    | all pass            |

## Scope

**In scope** (create these test files only):
- `src/main/updater.test.ts` — **create**.
- `src/main/review-watch.test.ts` — **create**.
- `src/main/window.test.ts` — **create** (windowInitFor default only).

**Out of scope** (do NOT touch):
- `src/main/updater.ts`, `src/main/review-watch.ts`, `src/main/window.ts` — characterization
  only; pin behavior as-is. Found a real bug? STOP and report; do not edit the module.
- Mocking electron's `BrowserWindow` / testing `createWindow` — explicitly excluded
  (e2e covers window wiring).

## Git workflow

- Commit straight to `main` (no branches — the git-guard hook hard-blocks branch creation).
- Conventional Commits. Suggested: `test(main): characterize updater, agent-channel watcher, window-init`
- One commit for the batch is fine. Do NOT push or open a PR unless instructed.

## Steps

### Step 1: `review-watch.test.ts` (easiest — do this first)

Create `src/main/review-watch.test.ts`. Mock `node:fs`, `node:fs/promises`, the five
`*Path` modules (all sharing dir `/p`), and `./app-events`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', () => {
  const watch = vi.fn(() => ({ close: vi.fn() }))
  return { watch, default: { watch } }
})
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(async () => undefined) }))
vi.mock('./review-store', () => ({ reviewSetsPath: () => '/p/review-sets.json' }))
vi.mock('./comment-store', () => ({ commentsPath: () => '/p/comments.json' }))
vi.mock('./board-store', () => ({ boardPath: () => '/p/board.json' }))
vi.mock('./actions-store', () => ({ actionsPath: () => '/p/actions.json' }))
vi.mock('./layers-store', () => ({ layersPath: () => '/p/layers.json' }))
vi.mock('./app-events', () => ({ emitAppEvent: vi.fn() }))

import { watch } from 'node:fs'
import { emitAppEvent } from './app-events'
import { watchAgentChannels } from './review-watch'

// The listener production code registered for `dir`.
const listenerFor = (dir: string) =>
  vi.mocked(watch).mock.calls.find(([d]) => d === dir)?.[1] as
    | ((event: string, filename: string | null) => void)
    | undefined

beforeEach(() => {
  vi.mocked(watch).mockClear()
  vi.mocked(emitAppEvent).mockClear()
})
afterEach(() => vi.clearAllMocks())

describe('watchAgentChannels', () => {
  it('watches the shared dir once and routes a filename to its event', async () => {
    await watchAgentChannels()
    expect(vi.mocked(watch)).toHaveBeenCalledTimes(1) // all five paths share /p
    listenerFor('/p')?.('change', 'comments.json')
    expect(emitAppEvent).toHaveBeenCalledWith('comments')
  })

  it('routes each channel filename to its matching event', async () => {
    await watchAgentChannels()
    const fire = listenerFor('/p')
    fire?.('change', 'review-sets.json')
    fire?.('change', 'board.json')
    fire?.('change', 'actions.json')
    fire?.('change', 'layers.json')
    expect(emitAppEvent).toHaveBeenCalledWith('feature-view')
    expect(emitAppEvent).toHaveBeenCalledWith('board')
    expect(emitAppEvent).toHaveBeenCalledWith('actions')
    expect(emitAppEvent).toHaveBeenCalledWith('layers')
  })

  it('ignores a change to an unknown filename', async () => {
    await watchAgentChannels()
    listenerFor('/p')?.('change', 'unrelated.json')
    expect(emitAppEvent).not.toHaveBeenCalled()
  })

  it('emits every distinct channel event when the platform omits the filename', async () => {
    await watchAgentChannels()
    listenerFor('/p')?.('rename', null)
    // feature-view, comments, board, actions, layers — five distinct events
    expect(new Set(vi.mocked(emitAppEvent).mock.calls.map((c) => c[0])).size).toBe(5)
  })

  it('fails open when fs.watch throws (unsupported platform)', async () => {
    vi.mocked(watch).mockImplementationOnce(() => {
      throw new Error('ENOSYS')
    })
    await expect(watchAgentChannels()).resolves.toBeUndefined() // no throw
  })
})
```

**Verify**: `pnpm test -- review-watch` → all pass.

### Step 2: `updater.test.ts`

Create `src/main/updater.test.ts`. Mock `electron` (mutable `app`) and `electron-updater`
(a fake emitter), plus `./app-events`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const app = { getVersion: () => '1.0.0', isPackaged: true }
vi.mock('electron', () => ({ app }))

type Handler = (arg?: unknown) => void
const handlers = new Map<string, Handler>()
const autoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn((event: string, cb: Handler) => {
    handlers.set(event, cb)
    return autoUpdater
  }),
  checkForUpdates: vi.fn(async () => undefined),
  quitAndInstall: vi.fn(),
}
vi.mock('electron-updater', () => ({ autoUpdater }))
vi.mock('./app-events', () => ({ emitAppEvent: vi.fn() }))

import { emitAppEvent } from './app-events'
import { checkForUpdates, initUpdater, updateStatus } from './updater'

const fire = (event: string, arg?: unknown) => handlers.get(event)?.(arg)

beforeEach(() => {
  vi.useFakeTimers()
  app.isPackaged = true
  handlers.clear()
  vi.mocked(emitAppEvent).mockClear()
  autoUpdater.on.mockClear()
  autoUpdater.checkForUpdates.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('updater', () => {
  it('is a no-op when the app is not packaged', () => {
    app.isPackaged = false
    initUpdater()
    expect(autoUpdater.on).not.toHaveBeenCalled()
  })

  it('wires listeners and kicks off an initial check when packaged', () => {
    initUpdater()
    expect(autoUpdater.autoDownload).toBe(true)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1) // the initial check()
  })

  it('transitions through the state machine and emits update-status each time', () => {
    initUpdater()
    fire('checking-for-update')
    expect(updateStatus().state).toBe('checking')
    fire('update-available', { version: '2.0.0' })
    expect(updateStatus()).toMatchObject({ state: 'available', version: '2.0.0' })
    fire('update-downloaded', { version: '2.0.0' })
    expect(updateStatus().state).toBe('downloaded')
    fire('error', { message: 'boom' })
    expect(updateStatus()).toMatchObject({ state: 'error', error: 'boom' })
    // every setStatus emits the renderer event:
    expect(emitAppEvent).toHaveBeenCalledWith('update-status')
  })

  it('update-not-available resolves to up-to-date', () => {
    initUpdater()
    fire('update-not-available')
    expect(updateStatus()).toMatchObject({ state: 'up-to-date', version: null })
  })

  it('checkForUpdates returns the current status object', async () => {
    const result = await checkForUpdates()
    expect(result).toBe(updateStatus())
  })
})
```

Notes:
- `updateStatus()` reads module-level state that **persists across tests** (there is no
  reset). Order the assertions so each test sets the state it asserts (the transition test
  drives every state it checks). Do not assert a pristine `idle` after another test ran.
- `currentVersion` comes from `app.getVersion()` at import → `'1.0.0'`; you don't need to
  assert it, but it must not throw (the `electron` mock provides `getVersion`).

**Verify**: `pnpm test -- updater` → all pass.

### Step 3: `window.test.ts` (windowInitFor default only)

`windowInitFor` reads a module-private Map that only `createWindow` populates, and
`createWindow` needs a real BrowserWindow — out of scope. So test the one branch reachable
without `createWindow`: an **unknown sender** falls back to `{ mode: 'restore' }`. `window.ts`
imports a `?asset` icon and electron, so importing it under vitest needs light mocks:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: vi.fn(), shell: { openExternal: vi.fn() } }))
vi.mock('../../resources/icon.png?asset', () => ({ default: 'icon' }))
vi.mock('./ipc', () => ({ pipeAppEvents: vi.fn() }))
vi.mock('./terminal-manager', () => ({ killTerminalsForSender: vi.fn() }))
vi.mock('./file-watch', () => ({ clearWatchedFiles: vi.fn() }))
vi.mock('./external-url', () => ({ isSafeExternalUrl: () => false }))

import { windowInitFor } from './window'

describe('windowInitFor', () => {
  it('falls back to restore for an unknown sender (StrictMode-idempotent default)', () => {
    const unknownSender = { id: 1 } // never registered via createWindow
    // The structural fake is enough — windowInitFor only uses the value as a Map key.
    expect(windowInitFor(unknownSender as never)).toEqual({ mode: 'restore' })
  })
})
```

The single `as never` here is **only** to supply a Map-key placeholder for a `WebContents`
the function never dereferences; it is not an `as unknown as` data cast. If you prefer to
avoid it: create the fake as `const unknownSender = {} as unknown` is banned — instead pass
a value typed via a tiny local helper. If you cannot satisfy the type without a banned
cast, **skip Step 3 entirely** and note it (the two real wins are Steps 1–2). If the
`?asset` mock path does not resolve (electron-vite resolves it differently), STOP and
report rather than fighting it — Step 3 is optional.

**Verify**: `pnpm test -- 'window'` → the windowInitFor test passes (or Step 3 is skipped
with a note).

### Step 4: Run the full gate

**Verify**: `pnpm verify` → all pass.

## Test plan

- `src/main/review-watch.test.ts` — single-watcher dedupe, per-filename routing, unknown
  filename ignored, null-filename emits all distinct events, fail-open on `watch` throw.
- `src/main/updater.test.ts` — not-packaged no-op, listener wiring + initial check, full
  state-machine transitions emitting `update-status`, up-to-date branch, `checkForUpdates`
  returns current status.
- `src/main/window.test.ts` — `windowInitFor` default fallback (optional).
- Verification: each `pnpm test -- <name>` passes; then `pnpm verify`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `src/main/review-watch.test.ts` and `src/main/updater.test.ts` exist and pass.
- [ ] `pnpm test -- review-watch` and `pnpm test -- updater` are green.
- [ ] `window.test.ts` exists and passes, **or** is intentionally skipped with a one-line note in the commit message / your report explaining why (banned cast / `?asset` resolution).
- [ ] `grep -rc "as unknown as\| as any" src/main/updater.test.ts src/main/review-watch.test.ts` returns 0 for both.
- [ ] `git status` shows only the new test files (the three source modules unchanged).
- [ ] `pnpm verify` passes.
- [ ] `plans/README.md` status row for 025 updated (note if window.test.ts was skipped).

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the three source modules no longer matches its "Current state" excerpt.
- A test surfaces real differing behavior (e.g. an updater transition the code doesn't make) — report it as a bug; do not edit the module.
- The `window.ts` portion (Step 3) requires mocking `BrowserWindow` or a banned cast to compile — ship Steps 1–2 and report Step 3 as deferred (this is an expected, acceptable outcome, not a failure).
- `pnpm verify` fails twice after a reasonable fix attempt.

## Maintenance notes

- `updater.ts` and `review-watch.ts` now have a behavior contract; a refactor that changes
  the state machine or the channel→event map must update these tests deliberately.
- `createWindow`'s BrowserWindow wiring stays e2e-covered on purpose — if a future change
  moves real logic *out* of `createWindow` into a pure helper, characterize that helper
  here rather than mocking BrowserWindow.
- The updater's module-level `status` has no reset seam; tests are ordered to set what they
  assert. If this becomes painful, prefer a `__resetForTests` export over per-test reimport
  gymnastics.
