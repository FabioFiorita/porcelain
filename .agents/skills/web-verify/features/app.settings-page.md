---
route: /settings/$section
shell: desktop
selectors:
  - "Review content"
  - "Toggle Sidebar"
  - "Settings"
  - "Settings sections"
  - "Appearance"
  - "Diff layout"
  - "Git and agents"
  - "Back"
  - "This computer"
  - "Name of this computer"
  - "Devices"
  - "repository"
  - "Remove from Porcelain"
  - "No projects registered"
  - "Select a worktree"
tests:
  - apps/web/spec/e2e/app-settings-page.desktop.e2e.ts
api:
  - DELETE /api/projects/:projectId
  - GET /api/inventory
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# app.settings-page

## What it is

Settings is its own page (`main` "Settings") that replaces the workspace and shows one section at a time. Back and Escape return to where it was opened, Escape does nothing while focus is in one of its text fields, and Settings still opens once no project is registered.

## How a user reaches it

- Sidebar footer button `Settings` (phone width: click `Toggle Sidebar` first; the sidebar is a sheet). It opens `/settings/appearance`.
- Keyboard `Alt+Shift+S` anywhere on the workspace (ignored while focus is in a text field). No test covers the shortcut.
- Route `/settings/$section`. Section slugs, in button order:
  - desktop mode (`start --desktop`): `appearance` (Appearance), `git` (Git and agents), `computer` (This computer), `ways-in` (Ways in), `devices` (Devices), `remotes` (Remote computers), `connection` (Connection).
  - web mode (`start`): `appearance`, `git`, `connection`, `updates` (Updates).
  - Any other slug redirects (replace) to `/settings/appearance`.
- Desktop app menu "Settings" (the Electron bridge's `open-settings` action); not reachable through the CLI.
- "Open Remote computers" buttons (desktop navigator, unreachable remote) open `/settings/remotes`.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start --desktop`. Cases 1 and 2 also work in web mode except the `This computer` and `Devices` steps, which exist only in desktop mode. Run case 3 last: it removes the only project from the instance.

### Setup

None.

### Case 1: its own page, one section at a time, Back returns

1. `$C open /`
   Look for: Page URL `/<projectId>/<worktreeId>` (sometimes with `?entry=handoff`), Page Title "Changes — repository", region "Review content".
2. `$C click --role button --name "Toggle Sidebar"`
   Look for: navigation "Projects and worktrees" with the button "repository" and, at its foot, button "Settings".
3. `$C click --role button --name "Settings"`
   Look for: Page URL `/settings/appearance`, Page Title "Settings"; main "Settings" with navigation "Settings sections" (buttons Appearance, Git and agents, This computer, Ways in, Devices, Remote computers, Connection, and Back); heading "Appearance"; text "Diff layout"; region "Review content" is gone.
4. `$C click --role button --name "Git and agents"`
   Look for: Page URL `/settings/git`; heading "Git and agents"; text "Diff layout" is gone; text "Pull strategy" shows.
5. `$C click --role button --name "Back"`
   Look for: main "Settings" is gone; region "Review content" shows; Page URL back to the workspace address it left; Page Title "Changes — repository". One Back is enough: switching sections replaces the history entry.

### Case 2: Escape leaves, except while typing in a field

1. `$C click --role button --name "Toggle Sidebar"`, then `$C click --role button --name "Settings"`
   Look for: main "Settings", heading "Appearance".
2. `$C click --role button --name "This computer"`
   Look for: Page URL `/settings/computer`; heading "This computer"; textbox "Name of this computer"; under the "Updates" legend a line "Porcelain " followed by the server's version (or "development build").
3. `$C click --role textbox --name "Name of this computer"`, then `$C press Escape`
   Look for: main "Settings" still shows, Page URL still `/settings/computer`.
4. `$C click --role button --name "Devices"`
   Look for: Page URL `/settings/devices`; text "Paired devices"; list "Paired devices and links" holding listitem "Verification browser" with the badge "This browser".
5. `$C press Escape`
   Look for: main "Settings" is gone; region "Review content" shows; Page Title "Changes — repository".

### Case 3: Settings opens with no project registered (destructive)

1. `$C click --role button --name "Toggle Sidebar"`, then `$C click --role button --name "repository" --button right`
   Look for: menu with menuitem "Remove from Porcelain".
2. `$C click --role menuitem --name "Remove from Porcelain"`
   Look for: alertdialog "Remove repository from Porcelain?" with buttons "Cancel" and "Remove from Porcelain".
3. `$C click --role button --name "Remove from Porcelain"`
   Look for: the dialog closes; text "No projects registered" in the still-open sidebar sheet; Page URL `/`; Page Title "Porcelain". `$C network` shows `DELETE /api/projects/<projectId>` with status 2xx.
4. `$C click --role button --name "Settings"`
   Look for: Page URL `/settings/appearance`; heading "Appearance".
5. `$C click --role button --name "Back"`
   Look for: Page URL `/`; text "Select a worktree".

## What proves it works

- Settings replaces the workspace (region "Review content" absent while main "Settings" shows), the URL names one section at a time, and Back/Escape restore the exact worktree URL and title it came from.
- Removal is server state: `$C open /` after case 3 still shows "Select a worktree" and, behind `Toggle Sidebar`, "No projects registered"; the repository stays on disk (`ls "$REPO"` still lists README.md).
- `apps/web/spec/e2e/app-settings-page.desktop.e2e.ts` (desktop project, 414x896):
  - Settings opens as main "Settings" with heading "Appearance" and "Diff layout", Git and agents replaces it, Back returns to region "Review content";
  - Escape inside textbox "Name of this computer" keeps Settings, Escape after clicking Devices leaves it;
  - after removing the project through the alertdialog, "No projects registered" shows, Settings still opens on Appearance, and Back shows "Select a worktree".

## Gotchas

- Escape is bound to the Settings `main` element (`apps/web/src/app/settings-page.tsx:332`), so it only works while focus is inside the page: click a section button first. Right after opening Settings from the sidebar, focus may be outside it and Escape does nothing.
- Back goes back in browser history when there is history, otherwise to `/`. After `$C open /settings/<slug>` (a fresh page load) Back lands on `/`, which redirects to the worktree.
- Phone width: the project navigator lives in a sheet; click `Toggle Sidebar` before `Settings` or `repository`. On the Settings page itself the sections are a horizontal row at the top.
- `This computer`, `Ways in`, `Devices` and `Remote computers` exist only in desktop mode; in web mode `/settings/computer` or `/settings/devices` redirects to `/settings/appearance`.
- Case 3 removes the instance's only project and leaks into every later feature: drive it last, or `$C stop` and `$C start --desktop` afterwards.
- "Remove from Porcelain" is both a menuitem and the dialog's button; address them by role as written. The dialog's button reads "Removing…" while the request runs.
