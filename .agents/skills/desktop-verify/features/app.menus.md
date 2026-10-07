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

The Mac app's application menu: Porcelain (About, Settings… with ⌘,, Services, Hide, Quit), File (Open Project… with ⌘O, Close Window), Edit, View and Window. Settings and Open Project send an action to the web, which opens Settings or the native folder sheet; an action sent before the page is ready waits for it. View offers zoom and full screen; Reload and Developer Tools appear only in an unpackaged app given a Vite server, the one `pnpm dev --desktop` runs, never in the verified or installed app.

## How a user reaches it

- the menu bar, or ⌘, for Settings and ⌘O for Open Project

## Driving it

Start a disposable instance with `.agents/skills/desktop-verify/scripts/cli start`. For the real menu bar, use Computer Use and open Porcelain Dev › Settings…; the renderer should show Settings, the app version and the reinstall message under This computer. Repeat with ⌘,.

For a main-process journey, import `startDesktop` as the skill describes. Use the raw `electron.evaluate(({ Menu }) => ...)` to inspect the application menu: View has resetZoom, zoomIn, zoomOut and togglefullscreen, with no reload, forceReload or toggleDevTools. Invoke the `open-settings` menu item's click through the raw handle, then observe Settings through `electron.firstWindow()`. There is no menu RPC or CLI UI command.

File › Open Project… and ⌘O are covered by [projects.folder-picker](projects.folder-picker.md).

## What proves it works

- `apps/desktop/spec/e2e/menus.e2e.ts` (Playwright Electron): the Settings menu opens Settings with the app version and the reinstall line; the View menu is exactly zoom and full screen, with no Reload or Developer Tools item.
- `apps/desktop/spec/e2e/folder-picker.e2e.ts` (Playwright Electron): the Open Project menu opens the native sheet directly.

## Gotchas

- Use the card's Porcelain Dev identity to select the development app; never select the installed app.
- Native menu roles and keyboard dispatch remain macOS checks. Linux launch proof covers renderer startup and shutdown.
