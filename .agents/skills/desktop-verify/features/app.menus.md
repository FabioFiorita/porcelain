---
selectors:
  - open-settings
  - open-project
  - 'Settings…'
  - togglefullscreen
  - 'This build updates by reinstalling; there is no update feed yet.'
tests:
  - apps/desktop/spec/e2e/menus.e2e.ts
  - apps/desktop/spec/e2e/folder-picker.e2e.ts
api: []
---

# app.menus

## What it is

The Mac app's application menu: Porcelain (About, Settings… with ⌘,, Services, Hide, Quit), File (Open Project… with ⌘O, Close), Edit, View and Window. Settings and Open Project send an action to the web, which opens Settings or the native folder sheet; an action sent before the page is ready waits for it. View offers zoom and full screen; Reload and Developer Tools appear only in an unpackaged app given a Vite server, the one `pnpm dev --desktop` runs, never in the verified or installed app.

## How a user reaches it

- the menu bar, or ⌘, for Settings and ⌘O for Open Project

## Driving it

Start an instance first: `.agents/skills/desktop-verify/scripts/cli start`.

### The menu tree has no developer items

```sh
.agents/skills/desktop-verify/scripts/cli menu
```

Look for: View holds Actual Size, Zoom In, Zoom Out and Toggle Full Screen; no item anywhere has the role `reload`, `forcereload` or `toggledevtools`.

### Settings opens from the menu

```sh
.agents/skills/desktop-verify/scripts/cli menu "Porcelain/Settings…"
.agents/skills/desktop-verify/scripts/cli click --role button --name "This computer"
.agents/skills/desktop-verify/scripts/cli snapshot
```

After the snapshot, look for: the Settings page, “Porcelain app 0.1.0” and “This build updates by reinstalling; there is no update feed yet.”

Open Project from the menu is driven in `projects.folder-picker`.

## What proves it works

- `apps/desktop/spec/e2e/menus.e2e.ts` (Playwright Electron): the Settings menu opens Settings with the app version and the reinstall line; the View menu is exactly zoom and full screen, with no Reload or Developer Tools item; delayed visibility, full screen and load events after the window closes do not throw or block Quit.
- `apps/desktop/spec/e2e/folder-picker.e2e.ts` (Playwright Electron): the Open Project menu opens the native sheet directly.

## Gotchas

- `menu <path>` matches labels with or without their trailing “…”, segment by segment.
- macOS can deliver visibility events after a window is destroyed. Electron 44's internal visibility listener still calls native window methods, so the app removes window listeners on `closed` and guards its delayed load and show callbacks. The menu test delivers those events after closing and then quits, without retries.
