# Plan 028: Characterize the renderer's WS client (reconnect, outbox, pending rejection)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/renderer/src/lib/daemon.ts src/shared/ws-protocol.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW (tests only — no production code changes)
- **Depends on**: none (pairs well with plans/027, which covers the server end)
- **Category**: tests
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

`src/renderer/src/lib/daemon.ts` (408 lines) is the most intricate stateful
code in the renderer: it owns the ONE WebSocket session — capped-backoff
reconnect, an outbox for messages issued while connecting, reqId-correlated
create/attach promises that must be **rejected** (not leaked) when the socket
dies, re-attach + watch-set replay on reconnect (but crucially NOT on the first
connect, which would double-replay scrollback), and the recovery-refetch
signal. This is exactly the code path every user hits when the daemon crashes
or the machine sleeps — and it has zero tests. These are characterization
tests: pin the behavior as it is (it is believed correct) so the next change to
reconnect semantics has a tripwire.

## Current state

[src/renderer/src/lib/daemon.ts](../src/renderer/src/lib/daemon.ts) — a module
singleton. The load-bearing behaviors, as shipped:

Module init reads the (absent-under-test) bridge and localStorage
(`daemon.ts:42-51`):

```ts
let baseUrl = window.porcelain?.daemon?.url ?? ''
let token = initialToken()   // bridge → localStorage('porcelain-daemon-token') → ''
```

Outbox semantics (`daemon.ts:88-96`, `340-355`): `createTerminal`/`attachTerminal`
push their message to `outbox` when the socket isn't OPEN; fire-and-forget
messages (`write`/`resize`/`kill`/`watch:*`) are **not** queued (`push` drops
them silently when not OPEN, `daemon.ts:157-161`).

Close semantics (`daemon.ts:107-116`, `225-234`):

```ts
function failPendingCreates(reason: string): void {
  outbox.length = 0
  // rejects and clears ALL pendingCreates and pendingAttaches
}
ws.onclose = () => {
  failPendingCreates('The Porcelain daemon connection dropped before the terminal could be created. ...')
  if (socket !== ws) return
  socket = null
  scheduleReconnect()      // retryDelay doubles: 500 → ... → capped 10_000
}
```

Open semantics (`daemon.ts:188-211`): reset backoff; replay `lastWatchedFiles`/
`lastWatchedDirs` if ever set; **only when `everConnected`** re-send
`terminal:attach` for every id in `attachedIds`; flush the outbox; fire
`reconnectListeners` when `everConnected || recoveryPending`; then set
`everConnected = true`.

Attach bookkeeping (`daemon.ts:365-384`): `attachTerminal(id)` adds to
`attachedIds` immediately; its reject handler **removes** the id (so
`isTerminalAttached` reports false and the next hydrate retries). `createTerminal`'s
resolve adds the created id. `detachTerminal`/`killTerminal` remove it.

Inbound validation (`daemon.ts:212-224`): non-string data ignored; JSON.parse
failure ignored; `serverMessageSchema.safeParse` failure ignored — only valid
`ServerMessage`s reach `dispatch`.

`setBrowserDaemonToken` (`daemon.ts:269-273`): persists to localStorage, swaps
the module token, `reconnectNow()` (drops the socket, immediate reconnect,
sets `recoveryPending` so the next open fires the refetch listeners even if
it's the first-ever connect).

**Testability facts:**
- jsdom (the default Vitest environment, `vitest.config.ts:16`) provides
  `window`, `localStorage`, and `window.setTimeout` — but its `WebSocket` must
  be replaced with a controllable fake.
- The module keeps ALL state at module scope → tests need
  `vi.resetModules()` + a fresh `await import('@renderer/lib/daemon')` per test.
- `ensureSession` is lazy — nothing connects until an exported function is
  called (the file's own comment: "nothing connects in unit tests").
- `randomId()` (from `@renderer/lib/utils`) generates reqIds — no mocking
  needed; capture reqIds from the fake socket's sent frames instead.

Conventions: import test APIs from `'vitest'` (globals off); `src/test-setup.ts`
already runs for every test (jest-dom + cleanup — harmless here).

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|--------------------------------|---------------------|
| Targeted  | `pnpm test -- lib/daemon`      | all pass            |
| Full gate | `pnpm verify`                  | exit 0              |

## Scope

**In scope**:
- `src/renderer/src/lib/daemon.test.ts` (create — the only new file)

**Out of scope**:
- `src/renderer/src/lib/daemon.ts` itself — **zero production changes**. If a
  test reveals a genuine bug, STOP and report; don't fix-and-test in one PR.
- `use-terminal-channel.ts` / `use-app-events.ts` / the terminal registry —
  consumers, separate surfaces.
- `src/backend/session.ts` — plan 027's territory.

## Git workflow

- Commit straight to `main` (branch creation hook-blocked; `pnpm verify`
  hook-enforced). Do NOT push.
- Message: `test: characterize the WS client — outbox, close-rejection, reconnect replay, first-connect guard`

## Steps

### Step 1: The fake WebSocket harness

At the top of `src/renderer/src/lib/daemon.test.ts`, build a controllable fake
and install it before importing the module under test:

```ts
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3
  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  constructor(public url: string, public protocols: string[]) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string): void { this.sent.push(data) }
  close(): void { this.readyState = FakeWebSocket.CLOSED; this.onclose?.() }
  // test helpers
  open(): void { this.readyState = FakeWebSocket.OPEN; this.onopen?.() }
  receive(msg: unknown): void { this.onmessage?.({ data: JSON.stringify(msg) }) }
  drop(): void { this.readyState = FakeWebSocket.CLOSED; this.onclose?.() }
}
```

Per-test setup (`beforeEach`): `vi.useFakeTimers()`; `FakeWebSocket.instances = []`;
`vi.stubGlobal('WebSocket', FakeWebSocket)`; `vi.resetModules()`;
`const daemon = await import('@renderer/lib/daemon')`. Per-test teardown:
`vi.unstubAllGlobals()`; `vi.useRealTimers()`.

Helper: `sentMessages(ws) = ws.sent.map((s) => JSON.parse(s))`.

**Verify**: a trivial first test — calling `daemon.watchFiles(['/a'])` creates
one FakeWebSocket instance whose `protocols` is `[]` (no token under jsdom) —
passes: `pnpm test -- lib/daemon`.

### Step 2: Outbox + settlement cases

1. **create while CONNECTING queues, flushes on open, resolves on reply** —
   call `createTerminal({name:'t', cwd:'/x'})` (do not await yet); assert the
   socket's `sent` is empty; `ws.open()`; assert a `terminal:create` frame was
   sent, capture its `reqId`; `ws.receive({ t: 'terminal:created', reqId, id: 'abc' })`;
   await the promise → `'abc'`; `daemon.isTerminalAttached('abc')` → true.
2. **close rejects pending creates AND attaches, empties the outbox** — queue a
   create and an attach while CONNECTING; `ws.drop()`; both promises reject
   (assert the rejection message contains `daemon connection dropped`); the id
   passed to `attachTerminal` is no longer attached (`isTerminalAttached` false).
3. **fire-and-forget messages are NOT queued** — while CONNECTING call
   `writeTerminal('id', 'x')` and `killTerminal('id')`; `ws.open()`; assert no
   `terminal:write`/`terminal:kill` frame in `sent` (only queued kinds flush).
4. **invalid inbound is ignored** — after open, `ws.onmessage?.({data: 'not json'})`
   and `ws.receive({ t: 'nonsense' })`; then a valid `terminal:created` for a
   pending create still resolves it (the socket state machine survived).

### Step 3: Reconnect cases

5. **backoff reconnect creates a new socket** — open then `drop()`; assert no
   second instance yet; `vi.advanceTimersByTime(500)`; assert
   `FakeWebSocket.instances.length === 2`.
6. **reconnect replays watch sets and re-attaches; first connect does not** —
   `watchFiles(['/a'])`, `attachTerminal('t1')` (settle it:
   `ws.receive({t:'terminal:attached', reqId, id:'t1', scrollback:'', status:'running', found:true})`);
   on the FIRST open assert exactly one `terminal:attach` frame (the queued
   one — NOT a duplicate replay). Then `drop()`, advance timers, `ws2.open()`;
   assert ws2's `sent` contains `watch:files` with `['/a']` AND a fresh
   `terminal:attach` for `t1`.
7. **reconnect listeners fire only on REconnect** — register
   `onDaemonReconnect(spy)`; first open → spy not called; drop + reopen → called once.
8. **backoff caps** — repeated drop/advance cycles: assert the delay between
   attempts stops growing at 10_000 (probe by advancing 9_999 → no new
   instance, +1 → new instance, after enough doublings).
9. **setBrowserDaemonToken reconnects with the new subprotocol** —
   `setBrowserDaemonToken('tok')`; assert the newest instance's `protocols` is
   `['porcelain.tok']` and `localStorage.getItem('porcelain-daemon-token') === 'tok'`;
   its open fires the reconnect listeners even though it's the first successful
   connect (`recoveryPending` path).
10. **attach failure drops the id so hydrate can retry** — attach `t2` while
    CONNECTING, `drop()` → rejection; `isTerminalAttached('t2')` false; a later
    `attachTerminal('t2')` after reopen sends a fresh `terminal:attach`.

**Verify**: `pnpm test -- lib/daemon` → 10+ tests pass.

### Step 4: Protocol-shape lock

11. Every frame the client sent across all tests must parse against
    `clientMessageSchema` from `@shared/ws-protocol` — add an `afterEach` that
    runs `clientMessageSchema.parse` over every collected sent frame. This pins
    the client to the shared schema the daemon validates with (drift on either
    side now fails a test on THIS side too).

**Verify**: `pnpm verify` → exit 0.

## Test plan

Steps 2–4 are the test plan (11 named cases). No existing exemplar mocks a
global — use `vi.stubGlobal` as shown; everything else follows the standard
Vitest patterns already in `src/renderer/src/stores/*.test.ts` (fresh state per
test via explicit resets).

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `pnpm test -- lib/daemon` → ≥11 tests pass
- [ ] `git diff --stat` shows **only** `src/renderer/src/lib/daemon.test.ts` (and the plans index)
- [ ] Sabotage check (do, verify failure, revert): in `daemon.ts`, remove the
      `if (everConnected)` guard around the re-attach loop → case 6 fails
      (double attach on first connect). This proves the guard is pinned.
- [ ] `plans/README.md` status row updated

## STOP conditions

- A test exposes an actual behavioral bug (e.g. the outbox double-sends an
  attach queued before the first open — case 6 is where it would show):
  STOP, report the repro, do not patch `daemon.ts` in this plan.
- `vi.resetModules()` + dynamic import doesn't give fresh module state
  (symptom: state leaking across tests) — report the Vitest behavior rather
  than serializing tests into one mega-test.
- jsdom's timer/`window.setTimeout` interplay with fake timers breaks
  `scheduleReconnect` — try `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`
  first; if still broken, report.

## Maintenance notes

- These are characterization tests: when reconnect semantics change
  *deliberately* (e.g. outbox replay policy), update the pinned cases in the
  same commit — that's the point.
- Case 11 (schema lock) plus plan 027's server-side schema assertions pin
  `ws-protocol.ts` from both ends; a protocol change now needs both suites
  updated, which is the desired friction.
