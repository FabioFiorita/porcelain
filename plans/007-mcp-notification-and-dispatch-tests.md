# Plan 007: MCP — don't reply to/execute a notification-shaped call; cover board/action dispatch

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/mcp/protocol.ts src/mcp/protocol.test.ts src/mcp/tools.ts src/mcp/tools.test.ts`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug + tests
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

Two MCP-server gaps:

1. **A JSON-RPC notification is dispatched and replied to.** In `handleRpc`, the
   `isNotification` guard (`return null` for messages with no `id`) sits at the
   **bottom**, after the method dispatch. So a `tools/call` (or `initialize`/`ping`/
   `tools/list`) sent **without an `id`** — i.e. as a notification — still runs its
   side effect (`callTool`) and builds a reply object with `id: undefined`. Per
   JSON-RPC 2.0 a notification must receive **no** response, and a stray reply (plus
   double-executing the tool if the client retries) is a real protocol violation.
   The fix moves the notification check above the dispatch.

2. **The board/action write surface is dispatched-untested.** `tools.test.ts`
   covers the review-set and notes tools, but the **board and action** tools
   (`create_card`/`update_card`/`move_card`/`delete_card`/`create_action`/
   `update_action`/`delete_action`) — the agent's write path the human doesn't drive
   by hand — have no test going **through `callTool`**, where the arg validation
   lives (`title is required`, `status must be one of todo|doing|done`,
   `command is required`). A regression dropping a guard would let invalid data
   reach the board/action JSON the app reads.

## Current state

`src/mcp/protocol.ts` — `handleRpc` (the relevant flow, lines ~277–311):
```ts
if (method === undefined) return null
const id = message.id
const isNotification = !('id' in message) || id === null || id === undefined

if (method === 'initialize') { … return ok(id, …) }
if (method === 'tools/list') return ok(id, { tools: TOOLS })
if (method === 'ping') return ok(id, {})
if (method === 'tools/call') {
  …
  const text = await callTool(name, args)   // side effect runs even for a notification
  return ok(id, { content: [{ type: 'text', text }] })
}
if (isNotification) return null             // <-- only reached for UNKNOWN methods
return fail(id, -32601, `method not found: ${method}`)
```
(Note the existing test "returns null for notifications (no id) like
`notifications/initialized`" passes only because that method is unknown and falls to
the bottom guard. A `tools/call` notification does **not** hit it.)

`src/mcp/tools.ts` — `callTool` dispatch (the board/action arms, lines ~67–126):
`create_card` throws `'title is required'`; `move_card` throws
`'status must be one of todo|doing|done'` on a bad status; `create_action` throws
`'title is required'` / `'command is required'`. The board/action file paths are
overridable for tests via env vars: `PORCELAIN_BOARD` and `PORCELAIN_ACTIONS`
(see `src/mcp/board-file.ts` and `src/mcp/action-file.ts`).

`src/mcp/tools.test.ts` already shows the harness: it sets `PORCELAIN_REVIEW_SETS`
/ `PORCELAIN_NOTES` to temp files in `beforeEach`, clears them in `afterEach`, and
reads back the JSON.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `pnpm typecheck`                 | exit 0 |
| Tests     | `pnpm test -- protocol tools`    | all pass, new tests included |
| Lint      | `pnpm lint`                      | exit 0 |
| Full gate | `pnpm verify`                    | all four pass |

## Scope

**In scope**:
- `src/mcp/protocol.ts` (move the notification guard up)
- `src/mcp/protocol.test.ts` (add the notification-call test)
- `src/mcp/tools.test.ts` (add board/action dispatch tests)

**Out of scope** (do NOT touch):
- `src/mcp/tools.ts` — the dispatch is correct; only its tests are missing. Do not
  change tool behavior.
- The other channel files / the server entrypoint (`server.ts`).
- Do NOT add a `run_action` or any execute verb (an `audit` invariant — the agent
  channel must have no execute tool).

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `fix(mcp): don't reply to a notification-shaped tools/call; test board/action dispatch`.
- Do NOT push unless instructed.

## Steps

### Step 1: Move the notification guard above the method dispatch

In `handleRpc`, relocate `if (isNotification) return null` to immediately after
`const isNotification = …`, before the `if (method === 'initialize')` line. Remove
the now-redundant copy at the bottom. Result: a message with no `id` returns `null`
without dispatching any method or running `callTool`; known methods with an `id`
behave exactly as before; an unknown method **with** an `id` still returns
`fail(id, -32601, …)`.

Rationale to note in a brief comment: a notification gets no reply (JSON-RPC), and
not executing it avoids double-running a tool if the client retries. (MCP always
sends `tools/call` as a request with an `id`, so no legitimate traffic is lost.)

### Step 2: Test the notification behavior

In `protocol.test.ts`, add:
```ts
it('ignores a tools/call sent as a notification (no id): no reply, no execution', async () => {
  const callTool = vi.fn(async () => 'ran')
  const res = await handleRpc(
    { jsonrpc: '2.0', method: 'tools/call', params: { name: 'x', arguments: {} } },
    callTool,
  )
  expect(res).toBeNull()
  expect(callTool).not.toHaveBeenCalled()
})
```
(Before Step 1 this fails: `res` is an object and `callTool` ran.)

### Step 3: Test board + action dispatch through `callTool`

In `tools.test.ts`, extend the `beforeEach`/`afterEach` to also set/clear
`process.env.PORCELAIN_BOARD` and `process.env.PORCELAIN_ACTIONS` to temp files in
`dir` (mirror the existing `PORCELAIN_REVIEW_SETS`/`PORCELAIN_NOTES` wiring). Then
add a `describe('board + actions')` with cases:
- `create_card` with a `title` writes a card in `todo` (default) — read the board
  JSON and assert; `create_card` **without** `title` rejects `'title is required'`.
- `move_card` to a valid status moves it; `move_card` with a bad `status` rejects
  `'status must be one of todo|doing|done'`; `move_card` for a missing id returns
  the `No card … ` string (no throw).
- `create_action` with `title`+`command` writes an action; missing `command`
  rejects `'command is required'`.
Model each on the existing `set_feature_review` cases (call `callTool`, then read
the file or assert the returned string / `rejects.toThrow`).

**Verify**: `pnpm test -- protocol tools` → all pass, including the new cases.

### Step 4: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- `protocol.test.ts`: the notification-call case (Step 2).
- `tools.test.ts`: board create/move(+invalid status)/missing-card and action
  create(+missing command) cases (Step 3).
- Verification: `pnpm test -- protocol tools` → all pass.

## Done criteria

ALL must hold:

- [ ] In `protocol.ts`, `if (isNotification) return null` is above the method
      dispatch and there is exactly one such guard
- [ ] `protocol.test.ts` asserts a notification `tools/call` returns null and does
      not invoke `callTool`
- [ ] `tools.test.ts` dispatches `create_card`/`move_card`/`create_action` (valid +
      invalid) through `callTool` with `PORCELAIN_BOARD`/`PORCELAIN_ACTIONS` temp files
- [ ] `pnpm verify` passes
- [ ] `src/mcp/tools.ts` behavior is unchanged (only its tests were added)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Moving the guard breaks an existing `protocol.test.ts` case (e.g. one that relied
  on the old ordering) — report which; the move should only *add* the notification
  short-circuit.
- The board/action env-override var names differ from `PORCELAIN_BOARD` /
  `PORCELAIN_ACTIONS` in the live `board-file.ts`/`action-file.ts` — use the actual
  names and note the discrepancy.

## Maintenance notes

- Any new method added to `handleRpc` is now automatically notification-safe (the
  guard is before dispatch) — keep new side-effecting methods below it.
- When a new agent-write tool is added to `tools.ts`, add its dispatch test to
  `tools.test.ts` in the same commit — the board/action gap this plan closes
  recurred precisely because the test was added later.
