---
name: server-verify
description: Prepare a disposable, sandboxed Porcelain server, publish its connections and fixtures, drive HTTP/WebSocket with your own tools, retain evidence and stop owned processes. Use before calling a server change done, or to see what a route answers today.
---

# Server verification

Run `.agents/skills/server-verify/scripts/cli` from the checkout root. The CLI prepares and records deterministic fixtures; the agent drives the server. Run it alone for command help.

## Prepare

```sh
C=.agents/skills/server-verify/scripts/cli
$C doctor
$C start
```

`doctor` separates startup dependencies (Node, Git, ps, the OS sandbox and installed checkout dependencies) from optional drivers. It works before an instance exists. `doctor --instance <id>` also checks ownership, build freshness, and a JSON health response.

`start` prints a short connection card: instance id, server/web/WebSocket URLs, private `connection.json` path, exact pairing-link and MCP commands, evidence folder and stop command. The server's web URL serves the kit's minimal SPA shell, not the built web client; use web-verify for UI behavior.

Read `connection.json` for build commit/dirty state, the existing source fingerprint and start time; fixture environment/project/worktree IDs and repository/project-home paths; required Origins; owner socket and data directory; credential file paths; routes by owner/network scope; live RPC examples; status/log/stop commands. A checkout without Git metadata reports null commit and dirty state. The file is private (0600 inside a 0700 instance directory), contains credential paths rather than values, and is removed on successful stop. Keep secrets out of shared evidence.

## Find the contract

Schemas and endpoints in `packages/contracts/src/<area>/` are the map. For example, `renameProjectRequestSchema` in `projects/inventory.ts` defines `PATCH /api/projects/:projectId`. Read the affected contract before constructing requests. Encode IDs in path segments and use `URLSearchParams` for query values.

## Drive HTTP: Node, then curl

Use Node fetch first. Replace the path below with the card's connection path; save this script outside the repository if needed.

```js
import { readFile } from 'node:fs/promises';
const card = JSON.parse(await readFile('/path/from/card/connection.json', 'utf8'));
const { credential } = JSON.parse(await readFile(card.credentialFiles.fixture, 'utf8'));
const headers = { authorization: `Bearer ${credential}`, origin: card.requiredOrigin.http };
const renamed = await fetch(`${card.serverUrl}/api/projects/${encodeURIComponent(card.fixtures.projectId)}`, {
  method: 'PATCH',
  headers: { ...headers, 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Renamed project' }),
});
if (renamed.status !== 200 || !renamed.headers.get('content-type')?.includes('application/json'))
  throw new Error(`Rename answered ${renamed.status} ${renamed.headers.get('content-type')}`);
const response = await fetch(`${card.serverUrl}/api/inventory`, { headers });
if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json'))
  throw new Error(`Inventory answered ${response.status} ${response.headers.get('content-type')}`);
const inventory = await response.json();
if (inventory.projects.find((project) => project.id === card.fixtures.projectId)?.name !== 'Renamed project')
  throw new Error('The renamed project did not persist');
```

Fallback: curl with `--include`, the card's Origin and a bearer read privately from the credential file. Never print the bearer or save a verbose request trace containing it. Check status **and content type**: a 200 with HTML can be the SPA fallback rather than an API response. The contracts in `packages/contracts` say which network routes need a paired caller. Public routes need no bearer. Paired routes accept the fixture bearer; browser sessions use their paired cookie. Browser pairing uses the exact printed `pairing-link` command, which mints a fresh one-time link. Treat its code as a secret.

Owner routes (`/pairings`, `/access`, `/mcp`) use `ownerSocketPath`, never the TCP server URL. Node's `http.request({ socketPath, path, method, headers })` or `curl --unix-socket "$OWNER_SOCKET" --include http://localhost/access` reaches them; they need no paired bearer. Do not assume a TCP 200 proves owner access.

## Drive live RPC

Use Node's built-in WebSocket with the card's `webSocketUrl`, headers `authorization: Bearer <fixture credential>` and `origin: card.requiredOrigin.webSocket`. Browser WebSockets cannot set bearer headers: first `POST /api/live/tickets` using the paired cookie, then connect to `/api/live?ticket=<ticket>` with the same Origin. Tickets are one-time and short-lived; mint immediately before connecting.

After open, send the two objects in `live.protocolExample.notices` and `live.protocolExample.follow`. The protocol is Effect RPC JSON, not a bare subscription:

- Notices: `{ "_tag": "Request", "id": "1", "tag": "notices", "payload": null, "headers": [] }`. The null payload is required.
- Follow: `{ "_tag": "Request", "id": "2", "tag": "follow", "payload": { "projects": ["<projectId>"], "worktrees": [{ "projectId": "<projectId>", "worktreeId": "<worktreeId>", "paths": ["README.md"] }] }, "headers": [] }`.
- Notices arrive in `{ "_tag": "Chunk", "requestId": "1", "values": [...] }`. Read each value and send `{ "_tag": "Ack", "requestId": "1" }` after **every** chunk, including ready/subscribed/heartbeat, or the stream stalls.
- Follow completes with `Exit`; check its success. Wait for `subscribed` before changing the fixture, then observe the relevant notice. Bound the wait and close the socket in `finally`.

Use Git and the filesystem directly in `fixtures.repositoryPath`. The retired `request`, `live`, `git` and `file` commands have no replacement wrapper.

## Deterministic fixtures and MCP

`ids` prints fixture IDs/paths. `agent publish-review`, `agent publish-proof`, `agent comment` and `agent reply` prepare repeatable changes through the disposable owner's MCP route. `server project`, `server published-review`, `server reviewed-layers`, `server reviewed-files`, `server comment-threads`, `server devices`, `server pending-links` and `server receipt <id>` read typed state back. All accept `--instance <id>`; run the CLI alone for arguments.

The card's MCP command runs the checkout's stdio bridge against the disposable data directory, with its working directory set to the sample repository so MCP resolves that worktree. Use that command with your harness's MCP client for arbitrary agent operations. The deterministic `agent` commands are also suitable for fixture publication; their evidence includes the MCP exchange.

## Evidence and cleanup

The CLI records numbered, redacted fixture operations plus server and supervisor logs. Save your own sanitized HTTP status/content-type/body readbacks and WebSocket frames in `evidenceDirectory`. Direct driver calls do not automatically produce CLI records. Report the evidence path and observable result, not only a driver's success.

`status` passively reports captured supervisor ownership, stale build metadata and connection path; it does not prove HTTP health. `logs` reads redacted server logs even after source edits. Fixture actions refuse a stale build; stop and start again after edits.

Run the affected test files, then execute the exact stop command printed on the card. Confirm owned processes are gone and retained evidence is readable. Stop has no idle expiry and keeps evidence; a repeated `stop --instance <id>` confirms an already completed stop without signaling processes. Failed cleanup exits nonzero and retains private runtime metadata for recovery. Inspect its report before retrying. Never kill by pattern.

With several instances, name one using `--instance <id>`. After stop, evidence also requires the explicit id. The skill's disposable loopback setup does not prove LAN or remote behavior; run those journeys when the changed feature needs them. CI owns whole suites and the registered-route coverage check.
