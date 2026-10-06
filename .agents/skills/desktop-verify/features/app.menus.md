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

Start with `.agents/skills/desktop-verify/scripts/cli start`. Bind CUA to its actual running development bundle and confirm its PID before native menu or keyboard actions.

### The menu tree has no developer items

Open the actual native View menu in CUA. Look for Actual Size, Zoom In, Zoom Out and Toggle Full Screen, with no Reload or Developer Tools item. The launcher stages a build without a Vite server. The focused regression checks the exact roles across the menu tree.

### Settings opens from the menu

1. Use CUA to open the development app's actual application menu and select Settings…. The native label may reflect the running Electron bundle; read it instead of assuming a label.
2. Observe the Settings page. With CUA or the skill's optional exact-CDP renderer recipe, select This computer. Look for “Porcelain app” with the current app version and “This build updates by reinstalling; there is no update feed yet.”
3. Select Back. Look for the previous project/worktree and surface, or the empty workspace if no project was open.
4. Focus the native window through CUA and press ⌘,. Observe Settings again, then return with Back. Record the physical menu and accelerator results separately.

Open Project from the menu is driven in `projects.folder-picker`.

## What proves it works

- CUA establishes physical menu selection and native accelerator behavior, with Settings and its return path visible.
- `apps/desktop/spec/e2e/menus.e2e.ts` (Playwright Electron): the Settings menu callback opens Settings with the current app version and reinstall line, Back exits it, and the View menu has exactly zoom/full screen roles without Reload or Developer Tools.
- `apps/desktop/spec/e2e/folder-picker.e2e.ts` intercepts the picker to verify the Open Project callback's native request/options and cancellation. Actual folder selection is the CUA journey in `projects.folder-picker`.

Run the relevant named regressions when the menu or its action changes:

```sh
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/menus.e2e.ts
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/folder-picker.e2e.ts
```

## Gotchas

- A direct `MenuItem.click` callback is bridge/action proof, not evidence that a physical menu or native accelerator worked. A renderer key command returning success is also insufficient.
- Keep menu labels and the reported running bundle distinct from the installed app; select only the disposable development target.
