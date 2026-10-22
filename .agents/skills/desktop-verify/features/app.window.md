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

The Mac app's window and the private server behind it.

## Sub-features

- `app.window` — Window restoration, appearance, close and quit.

## How to get to it (user POV)

- resize, move, maximize or enter full screen with the traffic lights or View › Toggle Full Screen
- close the window with ⌘W, reopen it from the Dock
- quit with ⌘Q

## Driving it with Electron

Preconditions: [surface baseline](README.md).

1. Inspect the sidebar: traffic lights have clearance, the header drags, and buttons remain clickable. Resize, maximize and enter/leave full screen through the traffic lights and View → Toggle Full Screen; the sidebar inset follows full screen.
2. Choose an appearance. For restart persistence, use the named regression's reusable disposable profile: restore bounds, maximized state, appearance and project. A fresh CLI start creates a new profile.
3. Close with ⌘W. The captured server PID stays alive; passive `status --instance <id>` has no page targets. Activate the same development app from the Dock; its window returns.
4. Quit with ⌘Q or the card's stop command. Captured app/server PIDs exit, the owner socket disappears, and retained `server.log` includes shutdown. Inspect the stop outcome for a normal exit.
5. Through the paired HTTP boundary, verify the server is loopback-only and refuses unauthenticated/wrong credentials. The renderer must expose no credential, cookies or Node access.

Automated coverage: `window.e2e.ts`.

## Gotchas

- Full-screen transitions require an awake, unlocked macOS session. Wait for native events; renderer closure alone does not establish native window closure before Dock activation.
- Capture `electron.process()` before closing if checking its exit code. Quit must finish pending window persistence and log writes before exiting; shutdown fallback is a failure.
- The development Quit item is “Quit Porcelain Dev”. Use the same owned profile for restart proof.
