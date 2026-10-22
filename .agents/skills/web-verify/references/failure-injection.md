# Inject browser failures

Use a dedicated browser context; install HTTP/WebSocket routes before navigation. WebSocket routes affect new sockets only. Keep HTTP interception until context close, restoring pass-through to avoid stranding module-worker requests. Use native [context routing](https://playwright.dev/docs/api/class-browsercontext#browser-context-route) and [WebSocket routing](https://playwright.dev/docs/api/class-websocketroute).

### HTTP refusal and hold

In one `async page => { ... }` operation, install the gate, drive inside `try` and restore in `finally`. The pathname regexp matches IDs as segments. String extraction works without Node globals in the CLI runner.

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
```

Set `fail` or `hold` at the mapped point; await `arrived` before inspecting pending state. Restore pass-through and `release()` within the 15-second request timeout. A second hold needs new promises. Record arrival and actual response; an abort does not prove recovery. In `finally`, reset flags, release and close the context.

### Live outage or held notices

Install before pairing/navigation. Close/reject sockets or hold incoming frames while forwarding the real protocol. WebSocket routes have no unroute operation; restore the mode and close the context in `finally`.

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
```

| Map | Injection and restoration |
| --- | --- |
| [access.restore-outage](../features/access.restore-outage.md) | Refuse `GET /api/inventory` with 503 before reloading the paired workspace (and again before `/pair`). Restore pass-through and dispatch `window.dispatchEvent(new Event('online'))` in the page. Observe self-recovery without navigating again. |
| [reviews.read-retry](../features/reviews.read-retry.md) | Refuse `GET /api/worktrees/[^/]+/changes` with 503 before loading the workspace. Restore pass-through, click button `Try again`, and check the address and refreshed document. |
| [reviews.mark-decision](../features/reviews.mark-decision.md) | Hold `GET /api/worktrees/[^/]+/review` only after the decision stop is loaded and its decision marked, before rewriting README.md. Await arrival, observe the disabled mark and stale server mark, release, then mark the refreshed decision. |
| [changes.diff-recovery](../features/changes.diff-recovery.md) | Hold `POST /api/worktrees/[^/]+/changes/diffs` after All changes loads, before opening README.md. Drop live traffic before rewriting the file, release the diff, verify 409 followed by one refreshed list/200 diff and new text while offline, then restore live. |
| [changes.branch-read-more](../features/changes.branch-read-more.md) | Hold `POST /api/worktrees/[^/]+/branch-changes/diffs` after the first window loads, before `Read 2 more of 2`. Await arrival, inspect preserved first-window text while the request is held (the final-window button can already be absent), release and inspect only the next two files in the request body. |
| [git-actions.follow-receipt](../features/git-actions.follow-receipt.md) | Drop live before Commit/Pop stash submission, verify the action settled on the server while its UI waits, allow at least one refused reconnect, restore and observe the receipt GET and success/refusal. Reconnect backoff reaches ten seconds. |
| [git-actions.reload-running](../features/git-actions.reload-running.md) | Hold incoming live frames before submitting the blocked commit; leave the real socket open. Reload in the same context while the UI follows the action, inspect `Outcome not yet confirmed`, await the blocked action’s terminal receipt while frames stay held, then release queued frames and observe `interrupted`. Restore the FIFO/lock files or stop the disposable instance. |

Use anchored pathname regexps and one bounded operation per failure journey. For reload-running, poll the accepted POST’s receipt (`$C server receipt <id>`) until `interrupted` before releasing; an early reload can still read running state. In `finally`, restore gates/sockets and close the context.
