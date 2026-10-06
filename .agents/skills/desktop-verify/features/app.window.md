---
selectors:
  - window.json
  - porcelain:fullscreen
  - desktop-sidebar-header
  - desktop-fullscreen
tests:
  - apps/desktop/spec/e2e/window.e2e.ts
api:
  - GET /api/live
---

# app.window

## What it is

The Mac app's window and the private server behind it. The window has a hidden-inset title bar: the sidebar header leaves room for the traffic lights, drags the window and keeps its buttons clickable, and drops the inset in full screen. The window's bounds and maximized state are saved in `window.json` and restored at the next launch, with the appearance the owner chose. Closing the last window keeps the app and its server running; the Dock reopens the window; Quit stops the server, removes its owner socket and keeps its log. The server listens on loopback only, refuses callers without the app's credential, and never gives that credential to the renderer.

## How a user reaches it

- resize, move, maximize or enter full screen with the traffic lights or View › Toggle Full Screen
- close the window with ⌘W, reopen it from the Dock
- quit with ⌘Q

## Driving it

Start with `.agents/skills/desktop-verify/scripts/cli start`. Record the running bundle, executable and app PID, then bind CUA to that exact development app. Select this launcher instance explicitly for passive observations.

### The window, its inset and full screen

1. Read the native window in CUA and run `.agents/skills/desktop-verify/scripts/cli status --instance <id>`. Look for one window at `porcelain://app/` or its project route, with `fullscreen: false`.
2. Resize/move the actual window through CUA. Capture its normal appearance and passive status bounds. The sidebar header clears the traffic lights, drags the window and keeps its buttons clickable.
3. Through the native View menu, choose Toggle Full Screen. Wait for the actual transition, capture the native window and run passive status. Require `fullscreen: true` and the sidebar without its normal traffic-light inset.
4. Exit through the native menu or traffic-light control. Wait for the transition, capture the normal window and require `fullscreen: false` in status. An accepted renderer shortcut alone cannot prove either transition.

### Closing keeps the server, the Dock reopens

First register the sample repository with the real folder-picker journey, open its `main` worktree and load History's seed commit. Record that project/worktree identity and the app/server process identities from passive status.

Close the actual native window through CUA using its close control or ⌘W. During the closed interval, run only:

```sh
.agents/skills/desktop-verify/scripts/cli status --instance <id>
```

Require zero native windows while the app PID and the process named or service-named Porcelain Server retain their recorded PID and creation time. This establishes process continuity; it does not independently prove HTTP responsiveness. Do not read the app through CUA yet: such reads can activate it and reopen the window, erasing the closed interval.

Then explicitly activate the exact development app through its Dock item or CUA's documented activation operation. Read the reopened window and run passive status: require one native window in the same app process. Require `desktop-smoke` and the exact sample repository/`main` worktree in the sidebar. Open that worktree and History if needed, and require “Create smoke project” with its actual seed hash. Report whether the previous History surface was restored; fresh History loading establishes server responsiveness after reopen, not during closure.

### Quit stops the server

Use CUA to select Quit in the actual development app's native menu or press ⌘Q with that native target focused. Read `.agents/skills/desktop-verify/scripts/cli evidence --instance <id>` and the retained `server.log`, `app-stop.txt` and `stop-result.json`. Require the recorded app exit and owned-process teardown; the server log ends with its shutdown. A forced exit or incomplete cleanup is not a graceful Quit success.

Finish with `.agents/skills/desktop-verify/scripts/cli stop --instance <id>` to confirm cleanup, even after native Quit. Do not stop other process identities by name or path.

## What proves it works

- `apps/desktop/spec/e2e/window.e2e.ts` (Playwright Electron): the loopback server refuses unauthenticated and wrong credentials, the policy allows remote connections with scripts from the app only, the renderer gets the bridge but no credential, cookies or Node; the sidebar inset, its drag regions and full screen; closing keeps the same server, the Dock reopens, Quit stops the server, removes its socket and keeps its log; delayed bounds, visibility, full screen, ready-to-show and load events after destroying a restored maximized window do not throw or block Quit; Quit during HTTP request setup cancels forwarding without an uncaught exception and exits cleanly with its server stopped; cancelling the initial load while reopening a window during Quit does not show a startup failure dialog; Quit keeps the window while its pending atomic state save is held, then persists the latest normal bounds and maximized state before exiting; a restart restores bounds, the maximized window, the dark appearance and the project, with no browser paired.

The CUA journey separately proves native controls and visible state. Passive status proves the closed interval without activation. Direct Electron tests use explicit native APIs/events to guard lifecycle and security; renderer teardown alone cannot prove native closure.

Run the focused regression when this feature changes:

```sh
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/window.e2e.ts
```

## Gotchas

- macOS finishes a full screen transition only on an awake, unlocked screen. The launcher holds `caffeinate -d -u`, but a locked session still blocks the native journey.
- Read the exact Quit label from the native menu. The running OS bundle may be Electron even though the app's main-process name is Porcelain Dev.
- Restoring bounds and appearance across a restart needs the same profile, which a new `start` never reuses; the e2e test proves it.
- macOS can deliver visibility events after a window is destroyed. Electron 44's internal visibility listener still calls native window methods, so the app removes window listeners on `closed` and guards its bounds, load and show callbacks. The window regression restores a maximized window, destroys it, then delivers eleven window events (five visibility events, `unmaximize`, `move`, `resize`, two full screen events and `ready-to-show`) plus the web contents' `did-finish-load`, and requires Quit to stop the server, without retries. It also delivers appearance/actions-ready IPC and native theme updates during native closure, before the app clears its window reference; none may access the destroyed window or change appearance. The pending-save regression delivers the same messages while Quit is waiting and requires appearance to remain unchanged.
- Electron 44's fetch installs an abort listener before initializing its native request; Quit during that setup can make the listener throw a ReferenceError and open an exception dialog. HTTP forwarding gives Electron an initially live cancellation signal and forwards any request or Quit cancellation after synchronous request construction returns. An already cancelled request is rejected before construction. The regression triggers Quit at the HTTP transport boundary before request construction completes and requires a normal app exit, server exit and socket removal. Cancelling a reopening window's initial load must also exit normally; startup failures during Quit must not open a dialog.

- Quit snapshots the live window and awaits its pending atomic save before closing the window normally. It waits for the window to close before cancelling HTTP forwarding and stopping the server, so a live renderer is never left with a stopped server. Destroying the window before starting the awaited flush could leave `window.json` absent after a native crash. Closing callbacks must not enqueue another save after the Quit persistence barrier.
- The pending-save regression also installs a renderer unload guard. Electron owns the Quit decision through `will-prevent-unload`; the test records Playwright's `beforeunload` dialog without dismissing it, and requires the native unload event and normal exit. Without that observer, Playwright automatically answers a dialog already closed by the app, racing Quit with `Page.handleJavaScriptDialog`.
- Reopening tests await the native window's `closed` event and require no native windows before emitting Dock activation. Playwright's page `close` only establishes renderer teardown. Its inspector can interrupt that teardown before the native window is closed; activating at that point calls `Show()` on the retiring window and can crash Chromium's visibility update. Renderer closure alone is not the app's reopening boundary.

- After server shutdown, the utility server writes a private, per-launch completion marker to each output pipe and waits for the host’s exit acknowledgement. The host removes the markers from output, consumes every preceding byte, flushes the server log, then acknowledges exit. This avoids both immediate `process.exit()` losing the final write and Electron’s exit handler removing pipe listeners. The regression holds the real log append, requires the stopped server to stay alive until persistence finishes, and checks the literal shutdown line after a normal app exit.
- Every fixture Quit waits for the process to close, requires exit zero and rejects the server shutdown deadline fallback. The private completion markers establish the output boundary without depending on native pipe ownership. Parser tests require immediate ordinary output, exact bytes, markers split at every boundary and rejection of premature EOF.
