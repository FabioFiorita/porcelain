---
route: /remotes/$environmentId/$projectId/$worktreeId
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Remote computers"
  - "Pairing link"
  - "Add"
  - "Back"
  - "Online"
  - "Open project"
  - "Open project on"
  - "This computer"
  - "Browse for a repository on "
  - "Browse for a repository on the Porcelain server."
  - "Every worktree appears in the sidebar."
tests:
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
api:
  - GET /api/environment
  - GET /api/inventory
  - GET /api/projects/folders
  - POST /api/pair
  - POST /api/projects
---

# projects.open-remote

## What it is

In the desktop app with a remote computer added, the navigator's `Open project` button becomes a menu "Open project on" with `This computer` and each remote computer by name: a remote computer browses that computer's own folders, registers the repository on it alone and opens its worktree under `/remotes/…`; `This computer` still opens a project on this computer.

## How a user reaches it

- Desktop shell only. Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → `Open project` (plus button) → menu "Open project on" → `This computer` or the remote computer's name (disabled with a status badge while it is not online) → dialog "Open project" ("Browse for a repository on <name>.") → folder → `Open <folder>`.
- A remote computer is added in Settings → `Remote computers` (route `/settings/remotes`) → textbox `Pairing link` → `Add`.
- Without remote computers, `Open project` is a plain button (`projects.open-folder`).

## Driving it

`$C start --desktop`; pair your browser using the card’s pairing-link command; `REPO` is connection.json fixtures.repositoryPath.

### Setup: a second computer

1. `$C remote start`
   Look for: "remote computer Remote journey computer, project remote-sample", its address and `remote repository <path>` (call it `$REMOTE_REPO`).
2. `LINK=$($C remote pairing-link | head -1)`, Navigate to `/settings/remotes` on the card’s web URL (full page load), replace the contents of textbox named `Pairing link` with the expanded value `$LINK`, click button named `Add`, then wait for text 'Online' to be visible
   Look for: list "Remote computers" with listitem "Remote journey computer" holding "Online".
3. A repository on each computer's project home, one commit each:
   ```sh
   git init -q -b main "$REMOTE_REPO/../elsewhere"
   printf '# Elsewhere\n' > "$REMOTE_REPO/../elsewhere/README.md"
   git -C "$REMOTE_REPO/../elsewhere" add README.md
   git -C "$REMOTE_REPO/../elsewhere" -c user.name=Verify -c user.email=verify@example.invalid commit -q -m "Initial commit"
   git init -q -b main "$REPO/../here"
   printf '# Here\n' > "$REPO/../here/README.md"
   git -C "$REPO/../here" add README.md
   git -C "$REPO/../here" -c user.name=Verify -c user.email=verify@example.invalid commit -q -m "Initial commit"
   ```

### Case 1: open a project on the remote computer

1. Navigate to `/` on the card’s web URL (full page load), then click button named `Toggle Sidebar`
   Look for: group "This computer" with project button "repository"; group "Remote journey computer" with button "Remote journey computer Online" and its own project "remote-sample".
2. Click button named `Open project`
   Look for: menu "Open project" with group "Open project on" holding menuitems "This computer" and "Remote journey computer".
3. Click menuitem named `Remote journey computer`
   Look for: dialog "Open project" with text "Browse for a repository on Remote journey computer."; the breadcrumb (navigation "Folder path") ends in the remote's project home `porcelain-dev-…`; folder buttons "elsewhere", "home", "repository", "state", "web" (the remote's disk; no "here").
4. Click button named `elsewhere`
   Look for: text "Every worktree appears in the sidebar."; button "Open elsewhere" enabled.
5. Click button named `Open elsewhere`
   Look for: the dialog is gone; Page URL `/remotes/<remote environmentId>/<projectId>/<worktreeId>`; Page Title "Changes — elsewhere · Remote journey computer"; in the sheet, group "Remote journey computer" holds project button "elsewhere" and group "This computer" does not.
6. Inspect HTTP requests and responses
   Look for: `POST /api/projects` sent to the remote's address (`127.0.0.1:<remote port>`) with status 200; none to this computer's web address.

### Case 2: This computer still opens here

7. Click button named `Open project`, then click menuitem named `This computer`
   Look for: dialog "Open project" with text "Browse for a repository on the Porcelain server."; folder button "here" (this computer's disk; no "elsewhere").
8. Click button named `here`, then click button named `Open here`
   Look for: the dialog is gone; Page URL `/<projectId>/<worktreeId>` (no `/remotes/`); Page Title "Changes — here"; group "This computer" holds project button "here", and group "Remote journey computer" still holds "elsewhere".

## What proves it works

- End state: `elsewhere` is registered on the remote only and `here` on this computer only: after Navigate to `/` on the card’s web URL (full page load) and click button named `Toggle Sidebar`, "here" is listed under "This computer" and "elsewhere" only under "Remote journey computer"; step 6's `POST /api/projects` went to the remote's address.
- `apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts`: choosing the remote computer in the menu shows "Browse for a repository on <name>.", `Open elsewhere` registers it in the remote server's inventory and not in this one, the URL is `/remotes/<environmentId>/<projectId>/<worktreeId>` and the remote group shows "elsewhere"; `This computer` shows "Browse for a repository on the Porcelain server.", registers `here` on this server only, the URL is `/<projectId>/<worktreeId>` and group "This computer" shows "here" (read through each server's `inventory()`).

## Gotchas

- Desktop shell only: start with `start --desktop` (Vite desktop mode without the Electron bridge, so `This computer` opens the in-app dialog, not the native picker). Remote computers are kept in the browser's `localStorage` without the bridge.
- `remote start` names the second computer "Remote journey computer" and its project "remote-sample", so no menuitem, group or project name collides with this computer's.
- Phone width: the navigator is in the sidebar sheet; after `Open <folder>` the sheet stays open. The menuitem name is the remote's name only while it is online.
