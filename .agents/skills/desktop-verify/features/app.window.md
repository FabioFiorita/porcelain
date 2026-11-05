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

The desktop app's window and the private server behind it. Loopback trust boundaries and draining shutdown are portable; traffic lights, Dock reopening and Mac window transitions require macOS.

## How to get to it (user POV)

- resize, move, maximize or enter full screen with the traffic lights or View › Toggle Full Screen
- close the window with ⌘W, reopen it from the Dock
- quit with ⌘Q

## Driving it with Electron

Preconditions: [surface baseline](README.md).

On Linux, drive step 5 and quit through the lifecycle's `stop()` or the card's stop command: captured app/server PIDs exit normally, the owner socket disappears and the retained server log records shutdown. The named `portable` regressions also hold log writes and interrupt request setup to verify draining. Steps 1–3 and Mac window restoration use the `macos` project; Linux closing its last window quits the app rather than leaving it available in the Dock.

1. Inspect the sidebar: traffic lights have clearance, the header drags, and buttons remain clickable. Resize, maximize and enter/leave full screen through the traffic lights and View → Toggle Full Screen; the sidebar inset follows full screen.
2. Choose an appearance. For restart persistence, use the named regression's reusable disposable profile: restore bounds, maximized state, appearance and project. Confirm the main worktree card in Projects and worktrees remains visible with aria-current=page after reopening or restarting. A fresh CLI start creates a new profile.
3. Close with ⌘W. The captured server PID stays alive; passive `status --instance <id>` has no page targets. Activate the same development app from the Dock; its window returns.
4. Quit with ⌘Q or the card's stop command. Captured app/server PIDs exit, the owner socket disappears, and retained `server.log` includes shutdown. Inspect the stop outcome for a normal exit.
5. Through the paired HTTP boundary, verify the server is loopback-only and refuses unauthenticated/wrong credentials. The renderer must expose no credential, cookies or Node access.

Automated coverage: `window.e2e.ts`.

## Gotchas

- Full-screen transitions require an awake, unlocked macOS session. Wait for native events; renderer closure alone does not establish native window closure before Dock activation.
- Capture `electron.process()` before closing if checking its exit code. Quit must finish pending window persistence and log writes before exiting; shutdown fallback is a failure.
- The development Quit item is “Quit Porcelain Dev”. Use the same owned profile for restart proof.
