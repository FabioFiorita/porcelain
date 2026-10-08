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

Start a disposable instance, then read its card. `status --instance <id>` reports captured app identity, build staleness and passive renderer targets; it does not change a window.

1. With Computer Use, resize and enter full screen using the traffic lights or View › Toggle Full Screen. Inspect the sidebar clearance before and during full screen, then leave full screen.
2. Close the window with ⌘W. Confirm the captured server PID remains alive and passive status has no page targets. Activate the same development app from the Dock and confirm the window returns.
3. Quit Porcelain Dev with ⌘Q, or use the printed stop command. Confirm both captured app/server PIDs are gone and the owner socket is removed. Read the retained `server.log` and stop outcome through the evidence directory.

For programmatic main-process journeys, import the shared lifecycle and use the raw ElectronApplication to inspect BrowserWindow, resize or emit activation. For transitions, wait for the corresponding native event. Capture the child process before closing: Playwright cannot return it after disposal. Restart persistence uses the regression test's reusable disposable profile; the launcher always creates a new profile.

## What proves it works

- `apps/desktop/spec/e2e/window.e2e.ts` (Playwright Electron): the loopback server refuses unauthenticated and wrong credentials, the policy allows remote connections with scripts from the app only, the renderer gets the bridge but no credential, cookies or Node; the sidebar inset, its drag regions and full screen; closing keeps the same server, the Dock reopens, Quit stops the server, removes its socket and keeps its log; delayed bounds, visibility, full screen, ready-to-show and load events after destroying a restored maximized window do not throw or block Quit; Quit during HTTP request setup cancels forwarding without an uncaught exception and exits cleanly with its server stopped; cancelling the initial load while reopening a window during Quit does not show a startup failure dialog; Quit keeps the window while its pending atomic state save is held, then persists the latest normal bounds and maximized state before exiting; a restart restores bounds, the maximized window, the dark appearance and the project, with no browser paired.

## Gotchas

- macOS finishes a full screen transition only on an awake, unlocked screen; `start` holds `caffeinate -d -u` on macOS for the instance's lifetime; a locked session still prevents the transition.
- Electron names the development Quit item “Quit Porcelain Dev”. Inspect it with Computer Use or the raw Electron menu API.
- Restoring bounds and appearance across a restart needs the same profile, which a new `start` never reuses; the e2e test proves it.
- macOS can deliver visibility events after a window is destroyed. Electron 44's internal visibility listener still calls native window methods, so the app removes window listeners on `closed` and guards its bounds, load and show callbacks. The window regression restores a maximized window, destroys it, then delivers eleven window events (five visibility events, `unmaximize`, `move`, `resize`, two full screen events and `ready-to-show`) plus the web contents' `did-finish-load`, and requires Quit to stop the server, without retries. It also delivers appearance/actions-ready IPC and native theme updates during native closure, before the app clears its window reference; none may access the destroyed window or change appearance. The pending-save regression delivers the same messages while Quit is waiting and requires appearance to remain unchanged.
- Electron 44's fetch installs an abort listener before initializing its native request; Quit during that setup can make the listener throw a ReferenceError and open an exception dialog. HTTP forwarding gives Electron an initially live cancellation signal and forwards any request or Quit cancellation after synchronous request construction returns. An already cancelled request is rejected before construction. The regression triggers Quit at the HTTP transport boundary before request construction completes and requires a normal app exit, server exit and socket removal. Cancelling a reopening window's initial load must also exit normally; startup failures during Quit must not open a dialog.

- Quit snapshots the live window and awaits its pending atomic save before closing the window normally. It waits for the window to close before cancelling HTTP forwarding and stopping the server, so a live renderer is never left with a stopped server. Destroying the window before starting the awaited flush could leave `window.json` absent after a native crash. Closing callbacks must not enqueue another save after the Quit persistence barrier.
- The pending-save regression also installs a renderer unload guard. Electron owns the Quit decision through `will-prevent-unload`; the test records Playwright's `beforeunload` dialog without dismissing it, and requires the native unload event and normal exit. Without that observer, Playwright automatically answers a dialog already closed by the app, racing Quit with `Page.handleJavaScriptDialog`.
- Reopening tests await the native window's `closed` event and require no native windows before emitting Dock activation. Playwright's page `close` only establishes renderer teardown. Its inspector can interrupt that teardown before the native window is closed; activating at that point calls `Show()` on the retiring window and can crash Chromium's visibility update. Renderer closure alone is not the app's reopening boundary.

- After server shutdown, the utility server writes a private, per-launch completion marker to each output pipe and waits for the host’s exit acknowledgement. The host removes the markers from output, consumes every preceding byte, flushes the server log, then acknowledges exit. This avoids both immediate `process.exit()` losing the final write and Electron’s exit handler removing pipe listeners. The regression holds the real log append, requires the stopped server to stay alive until persistence finishes, and checks the literal shutdown line after a normal app exit.
- Every fixture Quit waits for the process to close, requires exit zero and rejects the server shutdown deadline fallback. The private completion markers establish the output boundary without depending on native pipe ownership. Parser tests require immediate ordinary output, exact bytes, markers split at every boundary and rejection of premature EOF.
