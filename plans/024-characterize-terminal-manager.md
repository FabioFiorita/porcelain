# Plan 024: Make the terminal PTY manager unit-testable, then characterize it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bb4a55..HEAD -- src/main/terminal-manager.ts src/main/file-watch.ts`
> If `terminal-manager.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `7bb4a55`, 2026-06-26

## Why this matters

`src/main/terminal-manager.ts` is the embedded terminal's PTY layer — it spawns real
OS processes (`node-pty`) and tracks them in a module-level `Map`. It has **zero tests**,
yet it owns two safety-critical behaviors that fail in production, not in the type checker:

1. **Crash-guard** — `onData`/`onExit` only `sender.send(...)` when `!sender.isDestroyed()`.
   If that guard regresses, output from a still-running PTY is sent to a closed window's
   `WebContents`, which **throws in the main process**.
2. **Leak-guard** — `killTerminalsForSender` kills exactly the PTYs a closing window owns.
   If that regresses, a closed window leaves **orphaned shells / background dev servers**
   running, and `killTerminal` double-kill / wrong-id kill can tear down the wrong session.

There's a reason it has no tests: it types its sender as electron's **full `WebContents`**,
so a plain `{ send, isDestroyed }` fake can't be passed without a cast — and `as`/`as
unknown as` casts are **banned repo-wide**. The sibling module `file-watch.ts` already
solved exactly this (its comment at lines 30–39): it accepts a **narrow structural
interface** (`FileWatchSender` = `send` + `isDestroyed`) "so the module stays honest about
what it touches and is unit-testable with a plain fake." Adopting the same pattern in
`terminal-manager.ts` is a tiny, type-only, caller-compatible change (a real `WebContents`
still satisfies the narrower interface) — and it's the type-safety-driven shape CLAUDE.md
hard rule 6 asks for. With that in place, the characterization tests (the analog of plan
009's git-mutation tests) become trivial and flake-free.

## Current state

`src/main/terminal-manager.ts` (the parts you'll touch + the contract you're pinning):

```ts
import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'           // ← to be removed
import { type IPty, spawn } from 'node-pty'

interface Session {
  pty: IPty
  sender: WebContents                                  // ← becomes TerminalSender
}

const sessions = new Map<string, Session>()

export interface CreateTerminalOptions {
  cwd: string
  initialInput?: string
  cols?: number
  rows?: number
}

export function createTerminal(sender: WebContents, opts: CreateTerminalOptions): string {
  const id = randomUUID()
  const pty = spawn(defaultShell(), ['-l'], {
    name: 'xterm-256color', cols: opts.cols ?? 80, rows: opts.rows ?? 24,
    cwd: opts.cwd, env: cleanEnv(),
  })
  sessions.set(id, { pty, sender })
  pty.onData((data) => { if (!sender.isDestroyed()) sender.send('terminal:data', id, data) })
  pty.onExit(({ exitCode }) => {
    sessions.delete(id)
    if (!sender.isDestroyed()) sender.send('terminal:exit', id, exitCode)
  })
  if (opts.initialInput !== undefined && opts.initialInput !== '') {
    pty.write(`${opts.initialInput}\r`)
  }
  return id
}

export function writeTerminal(id: string, data: string): void { sessions.get(id)?.pty.write(data) }

export function resizeTerminal(id: string, cols: number, rows: number): void {
  if (cols <= 0 || rows <= 0) return            // node-pty throws on non-positive dims
  sessions.get(id)?.pty.resize(cols, rows)
}

export function killTerminal(id: string): void {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  session.pty.kill()
}

export function killTerminalsForSender(sender: WebContents): void {   // ← param becomes TerminalSender
  for (const [id, session] of sessions) {
    if (session.sender === sender) { sessions.delete(id); session.pty.kill() }
  }
}
```

The exact pattern to copy — `file-watch.ts:30-39`:

```ts
/**
 * The minimal slice of `WebContents` we need: send an app-event and check the
 * window is still alive. Kept structural (not the electron type) so the module
 * stays honest about what it touches and is unit-testable with a plain fake —
 * `as unknown as` casts are banned repo-wide.
 */
interface FileWatchSender {
  send(channel: string, ...args: unknown[]): void
  isDestroyed(): boolean
}
```

Callers (must keep compiling — both pass a real `WebContents`, which satisfies the
narrower interface, so no caller changes):
- `src/main/ipc.ts:55` — `createTerminal(event.sender, opts)` (`event.sender` is `WebContents`).
- `src/main/window.ts:71` — `killTerminalsForSender(webContents)` (a real `WebContents`).

Key testing facts:
- `sessions` is **module-level** with **no reset export**. Tests must reap what they create
  (call `killTerminal`/`killTerminalsForSender`, or fire `onExit`), exactly like
  `file-watch.test.ts` reaps in `afterEach`.
- `node-pty`'s `IPty` is only used via `onData`, `onExit`, `write`, `resize`, `kill` — a
  fake covers all five; `onData`/`onExit` capture the production callback so the test can
  fire a data/exit event.

Conventions to match:
- Structural exemplar: `src/main/file-watch.test.ts` (read it) — `vi.mock` the external
  module, structural fakes, synchronous assertions, reap state in `afterEach`.
- Vitest, `*.test.ts` next to source. No `any`, no `as unknown as`, no `as`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `pnpm install`                       | exit 0              |
| Test (one)| `pnpm test -- terminal-manager`      | all pass            |
| Typecheck | `pnpm typecheck`                     | exit 0 (callers still compile) |
| Full gate | `pnpm verify`                        | all pass            |

## Scope

**In scope**:
- `src/main/terminal-manager.ts` — **type-only** change: introduce a structural
  `TerminalSender` interface and use it for `Session.sender`, `createTerminal`, and
  `killTerminalsForSender`. **No behavior change.**
- `src/main/terminal-manager.test.ts` — **create**.

**Out of scope** (do NOT touch):
- Any runtime/behavior change to `terminal-manager.ts` — the only edit is the sender type.
  If you believe a real bug exists, STOP and report it (don't change behavior, don't encode
  a bug in a test).
- `src/main/ipc.ts`, `src/main/window.ts` — they must keep compiling unchanged; if either
  needs editing, the type narrowing was done wrong — STOP and report.
- `src/main/file-watch.ts` — only read it as the pattern source.

## Git workflow

- Commit straight to `main` (no branches — the git-guard hook hard-blocks branch creation).
- Conventional Commits. Suggested: `test(terminal): narrow the sender type and characterize the PTY manager`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Narrow the sender type (mirror `file-watch.ts`)

In `src/main/terminal-manager.ts`:

1. Remove `import type { WebContents } from 'electron'`.
2. Add the structural interface (copy the doc-comment shape from `file-watch.ts`, adapted):

```ts
/**
 * The minimal slice of `WebContents` we use: stream PTY output to the window and
 * check it's still alive. Kept structural (not the electron type) so the module
 * stays honest about what it touches and is unit-testable with a plain fake —
 * casts are banned repo-wide (same pattern as file-watch.ts).
 */
interface TerminalSender {
  send(channel: string, ...args: unknown[]): void
  isDestroyed(): boolean
}
```

3. Change `Session.sender: WebContents` → `sender: TerminalSender`.
4. Change `createTerminal(sender: WebContents, ...)` → `createTerminal(sender: TerminalSender, ...)`.
5. Change `killTerminalsForSender(sender: WebContents)` → `killTerminalsForSender(sender: TerminalSender)`.

Nothing else changes — the bodies are identical.

**Verify**: `pnpm typecheck` → exit 0. This proves `ipc.ts` and `window.ts` still compile
(a real `WebContents` is assignable to `TerminalSender`). If typecheck fails in those
callers, STOP and report.

### Step 2: Scaffold the test with a fake `node-pty` and fake senders

Create `src/main/terminal-manager.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

interface FakePty {
  write: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
  onData: (cb: (data: string) => void) => void
  onExit: (cb: (e: { exitCode: number }) => void) => void
  emitData: (data: string) => void
  emitExit: (exitCode: number) => void
}

function makeFakePty(): FakePty {
  let dataCb: ((d: string) => void) | undefined
  let exitCb: ((e: { exitCode: number }) => void) | undefined
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: (cb) => { dataCb = cb },
    onExit: (cb) => { exitCb = cb },
    emitData: (d) => dataCb?.(d),
    emitExit: (exitCode) => exitCb?.({ exitCode }),
  }
}

const spawned: FakePty[] = []
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => {
    const p = makeFakePty()
    spawned.push(p)
    return p
  }),
}))

import {
  createTerminal, killTerminal, killTerminalsForSender, resizeTerminal, writeTerminal,
} from './terminal-manager'

// Plain structural fakes — they satisfy TerminalSender with NO cast (that's the
// point of Step 1). Same shape file-watch.test.ts passes to setWatchedFiles.
const makeSender = (destroyed = false) => ({ send: vi.fn(), isDestroyed: () => destroyed })
```

`vi.mock` is hoisted, so importing the module under test below it is fine. `spawned[i]` is
the i-th created terminal's PTY, in call order.

### Step 3: Write the characterization cases

```ts
beforeEach(() => { spawned.length = 0 })

describe('terminal-manager', () => {
  it('spawns a shell, registers the session, returns an id, types initialInput', () => {
    const id = createTerminal(makeSender(), { cwd: '/repo', initialInput: 'pnpm dev', cols: 100, rows: 30 })
    expect(typeof id).toBe('string')
    expect(spawned).toHaveLength(1)
    expect(spawned[0].write).toHaveBeenCalledWith('pnpm dev\r')
    killTerminal(id)
  })

  it('does not type when initialInput is absent or empty', () => {
    const id1 = createTerminal(makeSender(), { cwd: '/repo' })
    const id2 = createTerminal(makeSender(), { cwd: '/repo', initialInput: '' })
    expect(spawned[0].write).not.toHaveBeenCalled()
    expect(spawned[1].write).not.toHaveBeenCalled()
    killTerminal(id1); killTerminal(id2)
  })

  it('forwards pty data to the owning sender', () => {
    const sender = makeSender()
    const id = createTerminal(sender, { cwd: '/repo' })
    spawned[0].emitData('hello')
    expect(sender.send).toHaveBeenCalledWith('terminal:data', id, 'hello')
    killTerminal(id)
  })

  it('does NOT send to a destroyed sender (crash-guard), but exit still reaps', () => {
    const sender = makeSender(true)
    const id = createTerminal(sender, { cwd: '/repo' })
    spawned[0].emitData('hello')
    spawned[0].emitExit(0)
    expect(sender.send).not.toHaveBeenCalled()
    writeTerminal(id, 'x')                       // session was reaped on exit
    expect(spawned[0].write).not.toHaveBeenCalled()
  })

  it('on exit, removes the session and notifies the sender', () => {
    const sender = makeSender()
    const id = createTerminal(sender, { cwd: '/repo' })
    spawned[0].emitExit(7)
    expect(sender.send).toHaveBeenCalledWith('terminal:exit', id, 7)
    writeTerminal(id, 'data')
    expect(spawned[0].write).not.toHaveBeenCalled()
  })

  it('routes write/resize to the right pty and ignores non-positive dims', () => {
    const id = createTerminal(makeSender(), { cwd: '/repo' })
    writeTerminal(id, 'ls\r')
    expect(spawned[0].write).toHaveBeenCalledWith('ls\r')
    resizeTerminal(id, 120, 40)
    expect(spawned[0].resize).toHaveBeenCalledWith(120, 40)
    resizeTerminal(id, 0, 40); resizeTerminal(id, 120, -1)   // node-pty throws on ≤0
    expect(spawned[0].resize).toHaveBeenCalledTimes(1)
    killTerminal(id)
  })

  it('killTerminal kills the pty, drops the session, and is idempotent', () => {
    const id = createTerminal(makeSender(), { cwd: '/repo' })
    killTerminal(id)
    expect(spawned[0].kill).toHaveBeenCalledTimes(1)
    killTerminal(id)
    expect(spawned[0].kill).toHaveBeenCalledTimes(1)
  })

  it('killTerminalsForSender kills only that window\'s PTYs (leak-guard)', () => {
    const win1 = makeSender(); const win2 = makeSender()
    const a = createTerminal(win1, { cwd: '/repo' })   // spawned[0]
    const b = createTerminal(win1, { cwd: '/repo' })   // spawned[1]
    const c = createTerminal(win2, { cwd: '/repo' })   // spawned[2]
    killTerminalsForSender(win1)
    expect(spawned[0].kill).toHaveBeenCalledTimes(1)
    expect(spawned[1].kill).toHaveBeenCalledTimes(1)
    expect(spawned[2].kill).not.toHaveBeenCalled()
    writeTerminal(a, 'x'); writeTerminal(b, 'x')
    expect(spawned[0].write).not.toHaveBeenCalled()
    expect(spawned[1].write).not.toHaveBeenCalled()
    writeTerminal(c, 'y')
    expect(spawned[2].write).toHaveBeenCalledWith('y')
    killTerminal(c)
  })
})
```

Add `beforeEach` to the imports from `'vitest'`.

**Verify**: `pnpm test -- terminal-manager` → all 8 tests pass.

### Step 4: Run the full gate

**Verify**: `pnpm verify` → lint, typecheck, test, build all pass.

## Test plan

- New file `src/main/terminal-manager.test.ts`, modeled on `src/main/file-watch.test.ts`.
- Cases (8): spawn+register+initialInput; no-type-when-empty; data forwarding;
  **destroyed-sender crash-guard** (no send; exit still reaps); exit reaps + notifies;
  write/resize routing + non-positive-dim guard; killTerminal idempotency;
  **killTerminalsForSender leak-guard**.
- Verification: `pnpm test -- terminal-manager` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `terminal-manager.ts` defines a structural `TerminalSender` interface and no longer imports `WebContents` (`grep -n "WebContents" src/main/terminal-manager.ts` returns nothing).
- [ ] `git diff 7bb4a55..HEAD -- src/main/terminal-manager.ts` shows **only** the sender-type change (no behavior/body change).
- [ ] `pnpm typecheck` exits 0 (callers `ipc.ts` / `window.ts` unchanged and still compile).
- [ ] `src/main/terminal-manager.test.ts` exists; `pnpm test -- terminal-manager` passes; it includes the destroyed-sender and `killTerminalsForSender` cases.
- [ ] `grep -c " as " src/main/terminal-manager.test.ts` returns 0 (no casts).
- [ ] `git status` shows only `terminal-manager.ts` (modified) and `terminal-manager.test.ts` (added).
- [ ] `pnpm verify` passes.
- [ ] `plans/README.md` status row for 024 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- After narrowing the type, `ipc.ts` or `window.ts` fails to typecheck — the narrowing is
  wrong (don't edit the callers to compensate); report it.
- The only way to pass the fake sender is a cast (`as`) — that means Step 1 didn't take;
  re-check the interface. Casts are banned; do not use one.
- A test reveals behavior differing from the "Current state" contract — that's a real bug;
  report it, don't edit the module to make a test pass and don't encode the bug.
- `terminal-manager.ts` no longer matches the "Current state" excerpt.
- `pnpm verify` fails twice after a reasonable fix attempt.

## Maintenance notes

- The `TerminalSender` narrowing now matches `FileWatchSender` — if a future main module
  takes a `WebContents` only to `send`/`isDestroyed`, use the same structural shape so it
  stays unit-testable without a cast.
- These tests pin the crash-guard and leak-guard; a red destroyed-sender / leak-guard test
  is a real production regression (a main-process crash or orphaned shells), not flake.
- The module has no reset seam by design; tests reap their own sessions. Prefer reaping over
  adding a `__resetForTests` export.
- Not covered (fine): `defaultShell`/`cleanEnv` env plumbing and the real `node-pty` spawn —
  the e2e terminal specs exercise those.
