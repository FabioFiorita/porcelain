---
name: server-verify
description: Prepare a disposable, sandboxed Porcelain server, publish its connections and fixtures, drive HTTP/WebSocket with your own tools, retain evidence and stop owned processes. Use before calling a server change done, or to see what a route answers today.
---

# Server verification

From the checkout root, run `.agents/skills/server-verify/scripts/cli` for command help. It prepares deterministic fixtures; drive the server through HTTP and WebSocket.

## Prepare

```sh
C=.agents/skills/server-verify/scripts/cli
$C doctor
$C start
```

`doctor` separates startup dependencies (Node, Git, ps, the OS sandbox and installed checkout dependencies) from optional drivers. It works before an instance exists. `doctor --instance <id>` also checks ownership, build freshness, and a JSON health response.

`start` prints a short connection card: instance id, server/web/WebSocket URLs, private `connection.json` path, exact pairing-link and MCP commands, evidence folder and stop command. The server's web URL serves the kit's minimal SPA shell, not the built web client; use web-verify for UI behavior.

Read private `connection.json` for build identity/freshness, fixture IDs and paths, required Origins, owner socket, data directory, credential-file paths, scoped routes, RPC examples and lifecycle commands. Commit/dirty fields are null without Git metadata. Connection metadata is removed after successful stop; keep credentials out of shared evidence.

## Find the contract

Schemas and endpoints in `packages/contracts/src/<area>/` are the map. For example, `renameProjectRequestSchema` in `projects/inventory.ts` defines `PATCH /api/projects/:projectId`. Read the affected contract before constructing requests. Encode IDs in path segments and use `URLSearchParams` for query values.

## Drive HTTP: Node, then curl

Use Node fetch with the fixture bearer read privately from `credentialFiles.fixture` and Origin from `requiredOrigin.http`. Construct the request from its contract, then independently read back the resulting state.

Fallback: curl with `--include`, the card's Origin and fixture bearer. Keep bearer values out of output/traces. Check status **and content type**: a 200 with HTML can be the SPA fallback rather than an API response. The contracts in `packages/contracts` say which network routes need a paired caller. Public routes need no bearer. Paired routes accept the fixture bearer; browser sessions use their paired cookie. Browser pairing uses the exact printed `pairing-link` command, which mints a fresh one-time link. Treat its code as a secret.

Owner routes (`/pairings`, `/access`, `/mcp`) use `ownerSocketPath`, never the TCP server URL. Node's `http.request({ socketPath, path, method, headers })` or `curl --unix-socket "$OWNER_SOCKET" --include http://localhost/access` reaches them; they need no paired bearer. Do not assume a TCP 200 proves owner access.

## Drive live RPC

Use Node's built-in WebSocket with the card's `webSocketUrl`, headers `authorization: Bearer <fixture credential>` and `origin: card.requiredOrigin.webSocket`. Browser WebSockets cannot set bearer headers: first `POST /api/live/tickets` using the paired cookie, then connect to `/api/live?ticket=<ticket>` with the same Origin. Tickets are one-time and short-lived; mint immediately before connecting.

After open, send the two objects in `live.protocolExample.notices` and `live.protocolExample.follow`. The protocol is Effect RPC JSON, not a bare subscription:

- Notices: `{ "_tag": "Request", "id": "1", "tag": "notices", "payload": null, "headers": [] }`. The null payload is required.
- Follow: `{ "_tag": "Request", "id": "2", "tag": "follow", "payload": { "projects": ["<projectId>"], "worktrees": [{ "projectId": "<projectId>", "worktreeId": "<worktreeId>", "paths": ["README.md"] }] }, "headers": [] }`.
- Notices arrive in `{ "_tag": "Chunk", "requestId": "1", "values": [...] }`. Read each value and send `{ "_tag": "Ack", "requestId": "1" }` after **every** chunk, including ready/subscribed/heartbeat, or the stream stalls.
- Follow completes with `Exit`; check its success. Wait for `subscribed` before changing the fixture, then observe the relevant notice. Bound the wait and close the socket in `finally`.

Use Git and the filesystem directly in `fixtures.repositoryPath`.

## Deterministic fixtures and MCP

`ids` prints fixture IDs/paths. `agent publish-review`, `agent publish-proof`, `agent comment` and `agent reply` prepare repeatable changes through the disposable owner's MCP route. `server project`, `server published-review`, `server reviewed-layers`, `server reviewed-files`, `server comment-threads`, `server devices`, `server pending-links` and `server receipt <id>` read typed state back. All accept `--instance <id>`; run the CLI alone for arguments.

Review fixture commands commit changes before publishing, include the required verdict and accept only pass/fail proof checks. Unrun checks belong in verdict.notProven. Republishing appends a revision to the branch review.

The card's MCP command runs the checkout's stdio bridge against the disposable data directory, with its working directory set to the sample repository so MCP resolves that worktree. Use that command with your harness's MCP client for arbitrary agent operations. The deterministic `agent` commands are also suitable for fixture publication; their evidence includes the MCP exchange.

## Evidence and cleanup

The CLI records numbered, redacted fixture operations plus server and supervisor logs. Save your own sanitized HTTP status/content-type/body readbacks and WebSocket frames in `evidenceDirectory`. Direct driver calls do not automatically produce CLI records. Report the evidence path and observable result, not only a driver's success.

`status` passively reports captured supervisor ownership, stale build metadata and connection path; it does not prove HTTP health. `logs` reads redacted server logs even after source edits. Keep one instance per surface while iterating. Fixture actions refuse a stale build; stop/start after server, contract or CLI edits. A map-only edit needs no restart.

Run changed tests by name plus the map's named test for the changed feature, then execute the exact stop command printed on the card. Confirm retained evidence is readable. Stop has no idle expiry and keeps evidence; a repeated `stop --instance <id>` confirms an already completed stop without signaling processes. Failed cleanup exits nonzero and retains private runtime metadata for recovery. Inspect its report before retrying.

With several instances, name one using `--instance <id>`. After stop, evidence also requires the explicit id. The skill's disposable loopback setup does not prove LAN or remote behavior; run those journeys when the changed feature needs them.

## Live GitHub reads

On a fresh instance, run `$C github-read <owner/repository> <pr-number> <account>... --instance <id>` with authenticated host accounts that can read that repository. It publishes a fixture review linked to that PR and records account, PR and project-list readbacks. A temporary Unix-socket bridge permits only these reads through the host's `gh`, since the sandbox has no network or machine credentials. Tokens remain in memory/per-call environments; cleanup removes the shim and socket. This proves live reads with that transport adaptation, not sandbox network access.
