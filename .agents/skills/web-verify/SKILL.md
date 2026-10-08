---
name: web-verify
description: Prepare a disposable Porcelain server and Vite, drive the web app with an independent browser tool following tool-neutral feature maps, and retain evidence. Use before calling a web change done, when checking a feature or web performance, or when correcting a map.
---

# Web verification

`C=.agents/skills/web-verify/scripts/cli`, from the repository root. The CLI owns disposable server/Vite processes and fixture operations. It does not open, pair, inspect or control a browser, intercept requests, assert outcomes or run tests. Run `$C` for command help.

## Prepare and connect

```sh
$C doctor
$C start
```

Startup prints a short card: instance ID, server/web/WebSocket URLs, private `connection.json`, the exact pairing-link and MCP commands, evidence folder and stop command. Read `connection.json` for build identity, fixture IDs and paths, required origins, owner socket, credential-file paths, initial route, web mode, status/log commands and the remote-start command. Do not print credential files.

Open the card's web URL in your own fresh browser context. For a paired journey, run the exact pairing-link command and navigate to its fresh link in that same context. Each link works once; the fragment is consumed and removed. For an unpaired journey, navigate to `/` without minting/redeeming a link. `start --desktop` exposes desktop-mode web views; it does not launch Electron or supply its native bridge. `start --coding-tool` installs the fixture's fake coding tool on the disposable server's PATH.

## Choose a driver

1. Prefer the harness's built-in browser when it supports the journey, including its snapshots, interaction and evidence tools. In T3, check `preview_status`, then `preview_open` if needed.
2. Otherwise use Playwright MCP from the project's `.mcp.json`, or the project's Playwright CLI. **Codex prefers the CLI** for this fallback. Use Playwright for request/WebSocket routing if the built-in browser cannot intercept them.

Do not add a Porcelain browser wrapper. The installed project version provides `pnpm exec playwright cli`; inspect its help before use. Give your session a unique name and close that session yourself: CLI `stop` owns only server/Vite and fixture processes.

```sh
pnpm exec playwright cli -s=web-<instance> open about:blank
pnpm exec playwright cli -s=web-<instance> run-code 'async page => { await page.setViewportSize({ width: 414, height: 896 }); }'
# Navigate to the fresh link locally; keep its code out of reports.
pnpm exec playwright cli -s=web-<instance> goto '<fresh pairing link>'
pnpm exec playwright cli -s=web-<instance> snapshot
pnpm exec playwright cli -s=web-<instance> run-code 'async page => { await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click(); }'
```

The CLI's `run-code` accepts `async page => { ... }`; Playwright MCP's code runner also supplies `page`. Accessible names in maps are exact unless written as a regex (`/^All branch changes/` means a name pattern, not literal slashes). Scope repeated controls by the map's region, dialog or tablist; use the stated document-order match only where necessary. Replace a contenteditable editor with select-all plus `page.keyboard.insertText`, rather than assuming `fill` handles it. Follow the role/name steps with any chosen driver; inspect the current accessibility tree when a target differs.

## Drive and record

Read [the index](features/README.md), then the selected map. Use a 414 × 896 viewport for its phone-width steps. Setup uses real shell/Git operations in `connection.json`'s `fixtures.repositoryPath`. Keep agent publications, typed readbacks and link minting in the fixture CLI:

```sh
$C agent publish-review 'Sample review' --instance <id>
$C server project --instance <id>
$C remote start --instance <id>
$C remote pairing-link --instance <id>
```

Browser observations come from your driver: URL/title, accessibility tree, screenshots, console, HTTP method/path/status and response content type. For performance use the driver's trace/CDP tools. Store useful artifacts in the card's evidence directory. The CLI redacts its own fixture evidence; independent browser artifacts are your responsibility. Pairing fragments and screenshots may contain secrets; keep raw artifacts local and report sanitized observations. Distinguish fixture setup, browser actions, server readbacks and their observable outcome.

## Inject browser failures

The seven maps below need routing in the **browser context**, not a fake server response. Use a dedicated context; install HTTP/WebSocket routes before navigation (WebSocket routes affect only new sockets). Keep the HTTP interceptor installed until the context closes and switch it back to pass-through: removing it while module workers load can strand dependency requests. These recipes use native [context routing](https://playwright.dev/docs/api/class-browsercontext#browser-context-route) and [WebSocket routing](https://playwright.dev/docs/api/class-websocketroute).

### HTTP refusal and hold

The CLI code runner does not expose Node globals such as `URL`; this recipe extracts the pathname from the request string. Inside one `async page => { ... }` run-code operation, install this gate, drive the map in the `try` and restore in `finally`. `path` is a regexp for the pathname, so IDs match one segment, not a literal `:worktreeId`.

```js
const context = page.context();
const method = 'GET';
const path = /^\/api\/inventory$/;
let fail = false;
let hold = false;
let release = () => {};
let requested = () => {};
const arrived = new Promise(resolve => { requested = resolve; });
const gate = new Promise(resolve => { release = resolve; });
await context.route('**/api/**', async route => {
  const request = route.request();
  if (request.method() !== method || !path.test(request.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0]))
    return route.continue();
  if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Verification outage"}' });
  if (hold) { requested(); await gate; }
  return route.continue();
});
try {
  // Pair/navigate first for a held refresh; arm before navigation for an initial refusal.
  // Set fail = true or hold = true at the map's specified point.
  // After triggering a hold, await arrived before inspecting pending state or writing the file.
  // Restore with fail = false or hold = false; release().
} finally {
  fail = false;
  hold = false;
  release();
  await context.close(); // Removes routes and drains this dedicated browser session.
}
```

For a second hold create a new gate and arrival promise, or use a fresh context. Release each held request within the web request's 15-second timeout. Record the route arrival and actual response; an aborted request is not a recovered 409/200 sequence.

### Live outage or held notices

Install this before pairing/navigation in a dedicated context. It forwards the real protocol and lets you either close sockets/reject reconnects or hold incoming frames while preserving the underlying connection. A WebSocket route has no `unrouteWebSocket`; restore its mode and close the dedicated context in `finally`.

```js
const context = page.context();
let offline = false;
let holdNotices = false;
const sockets = new Set();
const queued = [];
await context.routeWebSocket(/\/api\/live(?:\?|$)/, socket => {
  if (offline) { void socket.close(); return; }
  sockets.add(socket);
  const upstream = socket.connectToServer();
  upstream.onMessage(message => {
    if (holdNotices) queued.push(() => socket.send(message));
    else socket.send(message);
  });
  socket.onClose(() => sockets.delete(socket));
  upstream.onClose(() => sockets.delete(socket));
  // Page -> server traffic still forwards automatically, including RPC acknowledgements.
});
const drop = async () => {
  offline = true;
  await Promise.all([...sockets].map(socket => socket.close()));
  sockets.clear();
};
const restore = () => {
  offline = false;
  holdNotices = false;
  for (const send of queued.splice(0)) send();
};
try {
  // Pair/navigate, then await drop() for an outage or set holdNotices = true for reload-running.
  // Drive the map, restore(), then wait for its receipt/readback and visible outcome.
} finally {
  restore();
  await context.close();
}
```

| Map | Injection and restoration |
| --- | --- |
| [access.restore-outage](features/access.restore-outage.md) | Refuse `GET /api/inventory` with 503 before reloading the paired workspace (and again before `/pair`). Restore pass-through and dispatch `window.dispatchEvent(new Event('online'))` in the page. Observe self-recovery without navigating again. |
| [reviews.read-retry](features/reviews.read-retry.md) | Refuse `GET /api/worktrees/[^/]+/changes` with 503 before loading the workspace. Restore pass-through, click button `Try again`, and check the address and refreshed document. |
| [reviews.mark-layer-refresh](features/reviews.mark-layer-refresh.md) | Hold `GET /api/worktrees/[^/]+/review` only after the initial layer is loaded and marked, before rewriting README.md. Await arrival, observe the disabled mark and stale server mark, release, then mark the refreshed layer. |
| [changes.diff-recovery](features/changes.diff-recovery.md) | Hold `POST /api/worktrees/[^/]+/changes/diffs` after All changes loads, before opening README.md. Drop live traffic before rewriting the file, release the diff, verify 409 followed by one refreshed list/200 diff and new text while offline, then restore live. |
| [changes.branch-read-more](features/changes.branch-read-more.md) | Hold `POST /api/worktrees/[^/]+/branch-changes/diffs` after the first window loads, before `Read 2 more of 2`. Await arrival, inspect preserved first-window text while the request is held (the final-window button can already be absent), release and inspect only the next two files in the request body. |
| [git-actions.follow-receipt](features/git-actions.follow-receipt.md) | Drop live before Commit/Pop stash submission, verify the action settled on the server while its UI waits, allow at least one refused reconnect, restore and observe the receipt GET and success/refusal. Reconnect backoff reaches ten seconds. |
| [git-actions.reload-running](features/git-actions.reload-running.md) | Hold incoming live frames before submitting the blocked commit; leave the real socket open. Reload in the same context while the UI follows the action, inspect `Outcome not yet confirmed`, await the blocked action’s terminal receipt while frames stay held, then release queued frames and observe `interrupted`. Restore the FIFO/lock files or stop the disposable instance. |

Match the path column with anchored regexps, for example `/^\/api\/worktrees\/[^/]+\/review$/`. Run failure journeys in one bounded code operation so a held request does not time out between tool calls. For reload-running, use the accepted POST’s request ID to poll its receipt (or `$C server receipt <id>`) until `interrupted` before releasing. A fast reload can read a still-running receipt; releasing before the terminal notice is queued does not establish that the held outcome was delivered. Restore gates and sockets in `finally`, including on assertion failure; then close your browser session.

## Check and stop

Run the test files the map names, sequentially when they start their own runner. CI owns full suites. After source changes, stop/start before driving again; stale instances refuse fixture operations. With multiple instances, every command needs `--instance <id>`.

```sh
pnpm --filter @porcelain/web exec vitest run --config vitest.config.ts spec/integration/projects-rename.test.tsx
pnpm exec playwright cli -s=web-<instance> close
# Run the exact stop command printed on the card.
$C stop --instance <id>
$C evidence --instance <id>
```

Evidence is retained; private connection/runtime files are removed after a confirmed stop. A failed stop exits nonzero and keeps its ownership state: inspect the report before retrying. Stop only the instances/session you started. Report live-driven maps separately from source-reviewed maps and automated specs.

## Correct a map

Keep frontmatter and one file per feature, link it in the index, and run `pnpm features:check`. The checker validates routes, literal selectors, named tests, contract endpoint declarations and index links; it does not establish behavior, client call reachability or prose order. Read every edited step against its source and named tests, drive changed behavior on a fresh instance, and name any steps you could only review.
