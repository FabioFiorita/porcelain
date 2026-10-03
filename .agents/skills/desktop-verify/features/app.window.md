---
selectors:
  - window.json
  - porcelain:fullscreen
  - desktop-sidebar-header
  - desktop-fullscreen
tests:
  - apps/desktop/spec/e2e/window.e2e.ts
api: []
---

# app.window

## What it is

The Mac app's window and the private server behind it. The window has a hidden-inset title bar: the sidebar header leaves room for the traffic lights, drags the window and keeps its buttons clickable, and drops the inset in full screen. The window's bounds and maximized state are saved in `window.json` and restored at the next launch, with the appearance the owner chose. Closing the last window keeps the app and its server running; the Dock reopens the window; Quit stops the server, removes its owner socket and keeps its log. The server listens on loopback only, refuses callers without the app's credential, and never gives that credential to the renderer.

## How a user reaches it

- resize, move, maximize or enter full screen with the traffic lights or View › Toggle Full Screen
- close the window with ⌘W, reopen it from the Dock
- quit with ⌘Q

## Driving it

Start an instance first: `.agents/skills/desktop-verify/scripts/cli start`.

### The window, its inset and full screen

```sh
.agents/skills/desktop-verify/scripts/cli window
.agents/skills/desktop-verify/scripts/cli window resize 980 680
.agents/skills/desktop-verify/scripts/cli screenshot
.agents/skills/desktop-verify/scripts/cli window fullscreen on
.agents/skills/desktop-verify/scripts/cli screenshot
.agents/skills/desktop-verify/scripts/cli window fullscreen off
```

After each `window`, look for: one window at `porcelain://app/`, its bounds, and `fullscreen` true only between the two full screen lines. The first screenshot shows the sidebar header clear of the traffic lights; the full screen one shows it without that inset.

### Closing keeps the server, the Dock reopens

```sh
.agents/skills/desktop-verify/scripts/cli window close
.agents/skills/desktop-verify/scripts/cli window activate
.agents/skills/desktop-verify/scripts/cli snapshot
```

After `window close`, look for: no windows; after `window activate`, one window again, and the snapshot shows the app as it was.

### Quit stops the server

```sh
.agents/skills/desktop-verify/scripts/cli menu "Porcelain/Quit Porcelain Dev"
ls <evidence folder>
```

Look for: `app-exited.txt` and `server.log` in the evidence folder `start` printed; the instance stopped itself, and the server's log ends with its shutdown.

## What proves it works

- `apps/desktop/spec/e2e/window.e2e.ts` (Playwright Electron): the loopback server refuses unauthenticated and wrong credentials, the policy allows remote connections with scripts from the app only, the renderer gets the bridge but no credential, cookies or Node; the sidebar inset, its drag regions and full screen; closing keeps the same server, the Dock reopens, Quit stops the server, removes its socket and keeps its log; delayed visibility, full screen, ready-to-show and load events after window destruction do not throw or block Quit; a restart restores bounds, the maximized window, the dark appearance and the project, with no browser paired.

## Gotchas

- macOS finishes a full screen transition only on an awake, unlocked screen; `start` holds `caffeinate -d -u` for the instance's lifetime, but a locked session still leaves `window fullscreen` waiting.
- Electron names the Quit item after the app, “Quit Porcelain Dev” here; `menu` alone prints the tree with the exact labels.
- Restoring bounds and appearance across a restart needs the same profile, which a new `start` never reuses; the e2e test proves it.
- macOS can deliver visibility events after a window is destroyed. Electron 44's internal visibility listener still calls native window methods, so the app removes window listeners on `closed` and guards its delayed load and show callbacks. The window regression delivers eight window events (five visibility events, two full screen events and `ready-to-show`) plus the web contents' `did-finish-load` after destruction, then requires Quit to stop the server, without retries.
