---
name: server-verify
description: Start a disposable, sandboxed Porcelain server built from the checkout, drive its contracts with HTTP tools, record redacted evidence, and stop it. Use before calling a server change done, or to inspect a running route.
---

# Server verification

Run from the repository root. The adapter owns the disposable server, connection files and evidence; your HTTP tool drives requests. It records without asserting: read results against the contract.

## 1. Start and obtain a connection

```sh
C=.agents/skills/server-verify/scripts/cli
$C start
$C connection
```

Run `$C` alone for commands and flags. `connection` prints public JSON: `instance`, `address`, `projectId`, `worktreeId`, `repository`, `home`, `ownerSocket`, `curl.network`, `curl.owner`, `startedAt`, `fingerprint` and `evidence`. The curl fields name mode-600 configuration files in the owned runtime. Use them directly; never print their contents or authentication headers.

Check curl and jq availability, then prepare the examples:

```sh
command -v curl
command -v jq
SESSION=$($C connection)
INSTANCE=$(printf '%s' "$SESSION" | jq -r '.instance')
ADDRESS=$(printf '%s' "$SESSION" | jq -r '.address')
PROJECT_ID=$(printf '%s' "$SESSION" | jq -r '.projectId')
NETWORK_CONFIG=$(printf '%s' "$SESSION" | jq -r '.curl.network')
OWNER_CONFIG=$(printf '%s' "$SESSION" | jq -r '.curl.owner')
umask 077
CAPTURE=$(mktemp -d)
$C doctor --instance "$INSTANCE"
```

With multiple instances, every adapter command needs `--instance <id>`. jq only reads metadata. Other HTTP tools can use the same address and owner socket; HTTPie with compatible Unix-socket and WebSocket plugins is optional, not a required dependency.

The launcher supports Linux Bubblewrap and macOS `sandbox-exec`. Sessions persist until explicitly stopped. The server runs the built snapshot from `start`: source edits allow continued inspection, but certifying changed code requires `stop`, `start`, fresh connection metadata and a matching `doctor` result.

## 2. Find the contract

`packages/contracts` owns the canonical API Schemas and native HttpApi endpoints. Read `packages/contracts/src/<area>/` and the corresponding route. For example, `renameProjectRequestSchema` in `packages/contracts/src/projects/inventory.ts` defines the body for `PATCH /api/projects/:projectId`; `packages/contracts/src/projects/api.ts` defines the endpoint. Optional feature guidance can help plan a journey; it does not define another API or schema and needs no synchronization checker.

Choose the promise and observations that would disprove it before driving. Cover the way in, resulting state and relevant rejection or recovery. Percent-encode query values, for example with curl's `--get --data-urlencode`. Use ordinary Git and file tools against the disposable `repository` or `home` when needed.

## 3. Drive separate requests and record results

Rename, then independently read inventory while the same server stays running:

```sh
STATUS=$(curl --config "$NETWORK_CONFIG" --request PATCH \
  --header 'Content-Type: application/json' --data '{"name":"Renamed project"}' \
  --dump-header "$CAPTURE/rename.headers" --output "$CAPTURE/rename.body" \
  --write-out '%{http_code}' "$ADDRESS/api/projects/$PROJECT_ID")
$C record rename --instance "$INSTANCE" --body "$CAPTURE/rename.body" \
  --headers "$CAPTURE/rename.headers" --status "$STATUS" \
  --request "PATCH /api/projects/$PROJECT_ID" --transport network
STATUS=$(curl --config "$NETWORK_CONFIG" \
  --dump-header "$CAPTURE/inventory.headers" --output "$CAPTURE/inventory.body" \
  --write-out '%{http_code}' "$ADDRESS/api/inventory")
$C record inventory --instance "$INSTANCE" --body "$CAPTURE/inventory.body" \
  --headers "$CAPTURE/inventory.headers" --status "$STATUS" \
  --request 'GET /api/inventory' --transport network
```

Read recorded responses to confirm the literal name and project id. Next send the PATCH with `{"name":" "}`, record its status and error body, then independently GET inventory again. Confirm both rejection and the unchanged saved name.

`record <label> --body <file>` records a response, with optional `--headers <file>`, literal `--request <description>`, observed `--status N` and `--transport network|owner`. Alternatively use `--transcript <file>` for raw UTF-8 or JSON-lines output. It writes numbered redacted evidence and never asserts. Keep raw captures private; inspect and report redacted files. Avoid verbose traces or raw token dumps.

Compare owner and network routing using the protected configurations:

```sh
STATUS=$(curl --config "$OWNER_CONFIG" \
  --dump-header "$CAPTURE/owner.headers" --output "$CAPTURE/owner.body" \
  --write-out '%{http_code}' http://owner/access)
$C record owner-access --instance "$INSTANCE" --body "$CAPTURE/owner.body" \
  --headers "$CAPTURE/owner.headers" --status "$STATUS" \
  --request 'GET /access' --transport owner
STATUS=$(curl --config "$NETWORK_CONFIG" \
  --dump-header "$CAPTURE/network.headers" --output "$CAPTURE/network.body" \
  --write-out '%{http_code}' "$ADDRESS/access")
$C record network-access --instance "$INSTANCE" --body "$CAPTURE/network.body" \
  --headers "$CAPTURE/network.headers" --status "$STATUS" \
  --request 'GET /access' --transport network
```

Owner `/access` returns access JSON; network `/access` returns SPA HTML with status 200. Compare content type and body, because status alone does not establish owner-route reachability. `/pairings` and `/mcp` also use the owner socket and `http://owner` placeholder URL.

## 4. Observe live updates during a separate mutation

Read `packages/contracts/src/access/live-updates.ts` and the installed Effect RPC protocol (`effect/rpc/RpcMessage`) for current messages. A typed live helper is optional convenience; do not introduce another packet or schema model in this adapter.

Check that your curl supports native WebSockets and nonblocking stdin (`--upload-file .`). Keep this running in a persistent terminal:

```sh
curl --version
LIVE_ADDRESS="ws://${ADDRESS#http://}/api/live"
curl --config "$NETWORK_CONFIG" --no-buffer --header "Origin: $ADDRESS" \
  --upload-file . "$LIVE_ADDRESS" | tee "$CAPTURE/live.transcript"
```

This example uses the disposable HTTP listener; use `wss` for HTTPS. Type the `notices` request into that terminal:

```json
{"_tag":"Request","id":"1","tag":"notices","payload":null,"headers":[]}
```

After each received `Chunk`, acknowledge it to keep the stream flowing:

```json
{"_tag":"Ack","requestId":"1"}
```

From another terminal, use `connection --instance <id>` to prepare its variables, then issue and record another project PATCH on that same instance. Observe its `inventory` notice on the open stream, then end curl and record:

```sh
$C record live-inventory --instance "$INSTANCE" --transcript "$CAPTURE/live.transcript" \
  --request 'WebSocket /api/live: notices during a separate project PATCH' --transport network
```

A `ready` notice proves connection, not delivery after mutation. Check the HTTP response, subsequent inventory state and live notice together. Check curl support on the machine used; local-listener evidence does not certify physical LAN or remote connectivity.

## 5. Read evidence, run affected regression checks and stop

```sh
$C evidence --instance "$INSTANCE"
pnpm check:local
pnpm --filter @porcelain/server test:integration projects-rename
$C stop --instance "$INSTANCE"
```

Choose affected tests by name; the integration argument filters files in `apps/server/spec/integration/`. Automated regression checks are separate from interactive start, drive, capture and stop and prove product behavior against its contracts. Whole suites, broad builds, full probes and broad performance runs belong to CI; this skill does not trigger them automatically.

Report the evidence folder, demonstrated behavior, checks and unverified surfaces or connections. `stop` retains evidence. Afterwards, `evidence --instance <id>` reads it and repeated `stop --instance <id>` confirms the stopped state without signaling processes. A failed stop exits nonzero and retains private runtime state; inspect its report before retrying. Stop only your owned instance, never processes selected by name or path pattern.
