# Plan 027: An integration test tier for the daemon — boot it for real, prove the auth gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/backend/server.ts src/backend/session.ts src/shared/ws-protocol.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (refactors the security-critical entry file — behavior must be identical)
- **Depends on**: none
- **Category**: tests (security-adjacent)
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

The daemon's token gate is the single boundary that stops any webpage the user
has open from driving `terminal:create` — a shell — over loopback (WebSockets
carry no CORS; loopback fetch is reachable from anywhere). Today **nothing
tests it**: `tokenOk`, the Bearer check, the WS subprotocol parse, and the CORS
origin echo have zero coverage at any layer, the 76-procedure router is never
exercised through real HTTP, and the WS session dispatch is untested. A
one-line regression (a flipped comparison, an empty-token acceptance) ships
with a green per-commit gate and is only *possibly* caught by release e2e —
which doesn't probe auth at all. This plan adds the missing tier: boot the real
daemon HTTP/WS surface on an ephemeral port inside Vitest and assert the
boundary.

## Current state

[src/backend/server.ts](../src/backend/server.ts) is the daemon entry point —
and it is **not importable in a test today**: it has top-level side effects
(`server.ts:50-55` exits the process when `PORCELAIN_USER_DATA` is unset;
`main()` runs at module load, `server.ts:298`). The testable core is entangled
with the entry wiring. Key excerpts:

The gate primitives (`server.ts:81-112`):

```ts
let tokenHash: Buffer

function tokenOk(provided: string | undefined): boolean {
  if (provided === undefined || provided === '') return false
  return timingSafeEqual(tokenHash, createHash('sha256').update(provided).digest())
}

function bearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization
  return auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined
}

const allowedOrigin = process.env.PORCELAIN_ALLOWED_ORIGIN ?? ''

function corsHeaders(req: IncomingMessage): Record<string, string> {
  const origin = req.headers.origin
  if (origin === undefined) return {}
  if (origin !== 'null' && (allowedOrigin === '' || origin !== allowedOrigin)) return {}
  return { 'access-control-allow-origin': origin, ... }
}
```

The request handler (`server.ts:130-189`): non-`/trpc` GET/HEAD →
unauthenticated `serveStatic`; OPTIONS → 204 + CORS; `/trpc` without a valid
Bearer → 401; otherwise rebuild a fetch `Request` and hand to
`fetchRequestHandler({ endpoint: '/trpc', router, createContext: () => ({}) })`.

The upgrade handler (`server.ts:200-215`): rejects with a raw
`HTTP/1.1 401` + `socket.destroy()` unless `req.url === '/session'` AND a
`porcelain.<token>`-prefixed subprotocol validates via `tokenOk`; then
`wss.handleUpgrade(..., (ws) => createSession(ws))`.

[src/backend/session.ts](../src/backend/session.ts) (166 lines, untested) —
per-connection dispatch: zod-validates every inbound message
(`clientMessageSchema.safeParse`, drops invalid), routes `terminal:*` to
`terminal-manager` and `watch:*` to `file-watch`, replies `terminal:created` /
`terminal:attached` (with `found:false` fallback for unknown ids,
`session.ts:108-121`), and on socket close **detaches** (never kills)
(`session.ts:147-152`).

**The node-pty wall (this is the critical constraint):**
`session.ts:10-18` statically imports `./terminal-manager`, which imports
`node-pty` — a native module rebuilt for **Electron's ABI** by
`electron-builder install-app-deps`. Loading it under plain-Node Vitest fails
with a NODE_MODULE_VERSION mismatch. `src/backend/api.ts:114` also imports it
(`listTerminals`, `renameTerminal`). Therefore every test file that imports the
router or the session MUST `vi.mock('./terminal-manager', ...)` (hoisted, so
the mock intercepts before node-pty loads). This is also why these tests don't
already exist.

Environment facts: Vitest runs `environment: 'jsdom'` globally
(`vitest.config.ts:16`) — a server test needs a per-file
`// @vitest-environment node` pragma. `ws` is a runtime dependency (importable
as the test's WS client). Config reads require `initConfigDir(dir)`
(`src/backend/config-store.ts`) before any procedure touching config
(e.g. `recentRepos`).

Repo conventions: pure/impure split — extract testable logic into its own
module with a sibling test; the entry file stays thin. Strict TS, no `any`,
no `as unknown as`.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Targeted  | `pnpm test -- daemon-http`       | all pass            |
| Session   | `pnpm test -- session`           | all pass            |
| Full gate | `pnpm verify`                    | exit 0              |

## Scope

**In scope**:
- `src/backend/daemon-http.ts` (create — the extracted factory)
- `src/backend/server.ts` (becomes the thin entry that calls the factory)
- `src/backend/daemon-http.test.ts` (create)
- `src/backend/session.test.ts` (create)

**Out of scope**:
- `src/backend/api.ts`, `session.ts`, `static-server.ts`, `tailnet-listener.ts`
  — consumed as-is (mocked or real), not modified.
- The renderer WS client (`src/renderer/src/lib/daemon.ts`) — that's plan 028.
- Any behavior change whatsoever. This plan is extract + test; a behavior diff
  is a bug in the extraction.
- `terminal-manager.ts` — stays untested by explicit decision (documented).

## Git workflow

- Commit straight to `main` (branch creation hook-blocked; `pnpm verify`
  hook-enforced). Do NOT push. Two commits suggested:
  `refactor: extract createDaemonHttp from server.ts (no behavior change)` then
  `test: integration-boot the daemon http/ws surface — auth gate, CORS scope, session dispatch`.

## Steps

### Step 1: Extract `createDaemonHttp`

Create `src/backend/daemon-http.ts` exporting:

```ts
export interface DaemonHttpOptions {
  tokenHash: Buffer
  allowedOrigin: string
  router: AnyRouter                       // the tRPC router type from @trpc/server
  onSession: (ws: WebSocket) => void      // ws's WebSocket
  serveStatic: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}
export interface DaemonHttp {
  server: Server                          // node:http Server, NOT yet listening
  requestListener: (req: IncomingMessage, res: ServerResponse) => void
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void
}
export function createDaemonHttp(opts: DaemonHttpOptions): DaemonHttp
```

Move — verbatim, changing only the closure source of `tokenHash` /
`allowedOrigin` / `router` / `serveStatic` / `createSession` to `opts` — the
following from `server.ts`: `tokenOk`, `bearerToken`, `corsHeaders`,
`readBody`, `handleRequest`, the `WebSocketServer({ noServer: true })` + prefix
constant + `handleUpgrade`, the `requestListener` wrapper, and the
`createServer` + `server.on('upgrade', ...)` wiring. Do NOT move: the env
guard, `resolveToken`, `main()`, the migrations, the watch/broadcast wiring,
the tailnet init, the stdout port line, the stdin watchdog.

Rewrite `server.ts` to build the options (same env sources as today) and call
the factory; `initTailnetHandlers(daemon.requestListener, daemon.handleUpgrade)`
and `main()`'s `daemon.server.listen(...)` keep their current shape. The
`tokenHash` ordering constraint (set before any listener accepts —
`server.ts:234-240`) is now structural: the factory takes the hash as input, so
construct it inside `main()` after `resolveToken()`.

**Verify**: `pnpm typecheck` → exit 0; `pnpm build` → exit 0. Behavioral
identity spot-check: `git diff` shows the moved functions byte-identical except
for the closure→opts substitutions.

### Step 2: HTTP-surface integration tests

Create `src/backend/daemon-http.test.ts`, first lines:

```ts
// @vitest-environment node
import { vi } from 'vitest'
vi.mock('./terminal-manager', () => ({
  listTerminals: () => [],
  renameTerminal: vi.fn(),
  createTerminal: vi.fn(() => 'term-1'),
  attachTerminal: vi.fn(() => ({ scrollback: '', status: 'running' as const })),
  detachTerminal: vi.fn(),
  detachSender: vi.fn(),
  killTerminal: vi.fn(),
  writeTerminal: vi.fn(),
  resizeTerminal: vi.fn(),
}))
```

(Match the real export names — check `src/backend/terminal-manager.ts`'s
exports and mirror the full set `session.ts:10-18` and `api.ts:114` import;
a missing export fails loudly at import, which is fine.)

Harness (in `beforeAll`): `initConfigDir(await mkdtemp(...))`; build
`tokenHash` from a known token (`createHash('sha256').update('test-token').digest()`);
`createDaemonHttp({ tokenHash, allowedOrigin: 'http://localhost:5173', router,
onSession: createSession, serveStatic: async (_req, res) => { res.writeHead(404); res.end() } })`;
`server.listen(0, '127.0.0.1')`; capture the port. `afterAll`: close the server.

Cases (plain `fetch` against `http://127.0.0.1:<port>`):

1. `/trpc/recentRepos` with no auth header → **401**
2. with `authorization: Bearer wrong` → **401**
3. with `Bearer ` + empty string → **401**
4. with `Bearer test-token` → **200** and a tRPC-shaped JSON body (recentRepos
   returns `[]` against the fresh config dir)
5. `OPTIONS /trpc/whatever` with `origin: http://localhost:5173` → **204** with
   `access-control-allow-origin` echoed
6. any request with `origin: https://evil.example` → response carries **no**
   `access-control-allow-origin` header (and /trpc without token still 401s)
7. `origin: null` (the packaged file:// renderer) → CORS headers echoed `null`
8. `GET /` (non-/trpc) → served by the injected `serveStatic` (404 here)
   **without** any auth — asserting the unauthenticated-static contract
9. `POST /anything-not-trpc` → 404 (only GET/HEAD reach static)

**Verify**: `pnpm test -- daemon-http` → 9 cases pass.

### Step 3: WS-surface integration tests (same file or a sibling suite)

Using `import WebSocket from 'ws'` as the client against the same booted server:

10. connect to `/session` with **no** subprotocol → connection fails
    (the `error`/`unexpected-response` event fires with 401; assert it settles —
    wrap in a promise with a timeout)
11. subprotocol `porcelain.wrong-token` → fails likewise
12. wrong path (`/nope`) with the right subprotocol → fails
13. subprotocol `porcelain.test-token` → `open` fires; send
    `{"t":"terminal:create","reqId":"r1","name":"t","cwd":"/tmp"}` → receive
    `{"t":"terminal:created","reqId":"r1","id":"term-1"}` (the mocked manager's id)
14. send `terminal:attach` with an unknown id (make the mocked `attachTerminal`
    return `null`) → receive `terminal:attached` with `found: false` and
    `status: 'exited'` (the `session.ts:108-121` fallback)
15. send invalid JSON, then a valid message → the socket stays open and the
    valid message still gets its reply (malformed input is dropped, not fatal)

**Verify**: `pnpm test -- daemon-http` → all 15 pass.

### Step 4: Session unit tests

Create `src/backend/session.test.ts` (`@vitest-environment node`, same
terminal-manager mock, plus `vi.mock('./file-watch', ...)` with
`setWatchedFiles`/`setWatchedDirs`/`clearWatchedFiles`/`clearWatchedDirs`
spies). Drive `createSession` with a minimal fake `ws.WebSocket` (an
EventEmitter with `send`, `readyState`, emitting `message`/`close`) — no real
socket needed here; Step 3 already proved the real transport. Cases:

1. `watch:files` routes to `setWatchedFiles` with the session and paths
2. `broadcastAppEvent` sends an `app-event` message to every open session and
   skips a closed one (`readyState` ≠ OPEN → `push` no-ops)
3. socket `close` → `clearWatchedFiles` + `clearWatchedDirs` + `detachSender`
   all called with the session; `killTerminal` NOT called (detach-not-kill —
   the audit-skill invariant)
4. `send('terminal:data', id, data)` emits a schema-valid `terminal:data`
   message (parse the sent JSON with `serverMessageSchema` from
   `@shared/ws-protocol` to lock the protocol shape)

**Verify**: `pnpm test -- session` → 4 pass; `pnpm verify` → exit 0.

## Test plan

Steps 2–4 ARE the test plan (15 integration + 4 unit cases). Structural
pattern: backend node-env tests with tmpdir + env redirection
(`src/backend/board-store.test.ts` for harness shape). The `ws` client import
is the same package the daemon uses — no new dependency.

## Done criteria

- [ ] `pnpm verify` exits 0 (note: `pnpm test` now includes the new suites)
- [ ] `pnpm test -- daemon-http session` → ≥19 tests pass
- [ ] `src/backend/server.ts` contains no `function tokenOk` (moved to the factory);
      `grep -n "tokenOk\|handleUpgrade" src/backend/server.ts` shows only the factory usage
- [ ] A deliberate sabotage check (do it, then revert): flip `tokenOk`'s empty-string
      guard to `return true` in `daemon-http.ts` → `pnpm test -- daemon-http` FAILS
      (cases 1–3). This proves the tests bite.
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `vi.mock('./terminal-manager')` fails to prevent the node-pty load (e.g. an
  import path variant like `@backend/terminal-manager` somewhere) — report the
  actual import chain rather than fighting it.
- The extraction requires changing any header, status code, or ordering to make
  a test pass — that's a real (pre-existing or introduced) behavior issue; report it.
- Vitest's jsdom-default config fights the `@vitest-environment node` pragma
  (symptom: `fetch`/`ws` weirdness) — report before restructuring vitest.config.

## Maintenance notes

- Any future change to auth (`tokenOk`, subprotocol scheme, CORS) now has a
  failing test as its tripwire — reviewers should require a test delta alongside
  any `daemon-http.ts` change.
- The release e2e still owns "the packaged app's real spawn works" (fuse checks,
  utilityProcess); this tier deliberately doesn't cover process spawning —
  `src/main/daemon.ts`'s state machine is a separate finding (recorded in the
  index, not planned this round).
- Plan 028 (client-side WS characterization) pairs with this; together they pin
  both ends of `@shared/ws-protocol`.
