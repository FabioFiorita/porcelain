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
  - "Name of this computer"
  - "Save"
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

Two instances: the remote computer B and the desktop app A. Start B first, then A: `C=.agents/skills/web-verify/scripts/cli; $C start --desktop` (B; note its instance id `$B` and repository `REPO_B`), then `$C start --desktop` (A; id `$A`, repository `REPO_A`). With two instances live every command needs `--instance`.

### Setup

1. On B's disk, a repository with one commit, and one on A's disk for case 2:
   ```sh
   git init -q -b main "$REPO_B/../elsewhere"
   printf '# Elsewhere\n' > "$REPO_B/../elsewhere/README.md"
   git -C "$REPO_B/../elsewhere" add README.md
   git -C "$REPO_B/../elsewhere" -c user.name=Verify -c user.email=verify@example.invalid commit -q -m "Initial commit"
   git init -q -b main "$REPO_A/../here"
   printf '# Here\n' > "$REPO_A/../here/README.md"
   git -C "$REPO_A/../here" add README.md
   git -C "$REPO_A/../here" -c user.name=Verify -c user.email=verify@example.invalid commit -q -m "Initial commit"
   ```
2. Name B so it is told apart from A (both default to the host name): `$C --instance $B open /settings/computer`, `$C --instance $B fill --role textbox --name "Name of this computer" "Remote journey computer"`, `$C --instance $B click --role button --name "Save"`. Look for: Page Title "Settings · Remote journey computer" (see `access.environment-name`).
3. CLI gap: a pairing link issued on B for A's browser. Needed: `cli pairing-link --instance $B --label "Remote computer"`, printing `http://127.0.0.1:<B port>/pair#…` (the kit issues it through B's owner socket, as `start` does for its own browser). B's web Devices page cannot issue one: it needs a way in turned on.

### Case 1: open a project on the remote computer

1. `$C --instance $A click --role button --name "Toggle Sidebar"`, then `$C --instance $A click --role button --name "Settings"`, then `$C --instance $A click --role button --name "Remote computers"`
   Look for: main "Settings" on `/settings/remotes`; textbox "Pairing link"; text "No remote computers yet".
2. `$C --instance $A fill --role textbox --name "Pairing link" "<link from the gap above>"`, then `$C --instance $A click --role button --name "Add"`
   Look for: list "Remote computers" with listitem "Remote journey computer"; the textbox is empty again.
3. `$C --instance $A click --role button --name "Back"`, then `$C --instance $A click --role button --name "Toggle Sidebar"`
   Look for: groups "This computer" and "Remote journey computer"; the remote group shows text "Online" and its project "repository".
4. `$C --instance $A click --role button --name "Open project"`
   Look for: menu with label "Open project on", menuitem "This computer" (enabled) and menuitem "Remote journey computer" (enabled).
5. `$C --instance $A click --role menuitem --name "Remote journey computer"`
   Look for: dialog "Open project" with text "Browse for a repository on Remote journey computer."; folder button "elsewhere" (B's project home).
6. `$C --instance $A click --role button --name "elsewhere"`
   Look for: text "Every worktree appears in the sidebar."; button "Open elsewhere" enabled.
7. `$C --instance $A click --role button --name "Open elsewhere"`
   Look for: the dialog is gone; Page URL `/remotes/<B environmentId>/<projectId>/<worktreeId>`; Page Title "Changes — elsewhere · Remote journey computer"; in the sheet, group "Remote journey computer" holds a project button "elsewhere"; group "This computer" does not.
8. `$C --instance $A network`
   Look for: `POST /api/pair` and `POST /api/projects` sent to B's address (`127.0.0.1:<B port>`), both 200; no `POST /api/projects` to A's server.

### Case 2: This computer still opens here

9. `$C --instance $A click --role button --name "Open project"`, then `$C --instance $A click --role menuitem --name "This computer"`
   Look for: dialog "Open project" with text "Browse for a repository on the Porcelain server."; folder button "here".
10. `$C --instance $A click --role button --name "here"`, then `$C --instance $A click --role button --name "Open here"`
    Look for: the dialog is gone; Page URL `/<projectId>/<worktreeId>` (no `/remotes/`); Page Title "Changes — here"; group "This computer" holds project button "here".

## What proves it works

- End state: `elsewhere` is registered on B only and `here` on A only. Read back by reloading each side: `$C --instance $B open /` then `$C --instance $B click --role button --name "Toggle Sidebar"` lists "elsewhere" and not "here"; the same on `$A` lists "here" under "This computer" and "elsewhere" only under "Remote journey computer".
- `apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts`: choosing the remote computer in the menu shows "Browse for a repository on <name>.", `Open elsewhere` registers it in the remote server's inventory and not in this one, the URL is `/remotes/<environmentId>/<projectId>/<worktreeId>` and the remote group shows "elsewhere"; `This computer` shows "Browse for a repository on the Porcelain server.", registers `here` on this server only, the URL is `/<projectId>/<worktreeId>` and group "This computer" shows "here" (read through each server's `inventory()`).

## Gotchas

- Unreachable through the CLI as it stands: it needs a second computer with a pairing link for A's browser. Two `start` instances give the second server, but nothing issues a pairing link on B. Needed: `cli pairing-link --instance <remote id> --label "Remote computer"`.
- Desktop shell only: start A with `start --desktop` (Vite desktop mode without the Electron bridge, so `This computer` opens the in-app dialog, not the native picker). Remote computers are kept in A's browser `localStorage` without the bridge.
- Both servers run on one host and are named after it until step 2 renames B; without that the menuitem and group names are the host name, and "repository" appears in both groups.
- Phone width: the navigator is in the sidebar sheet; after `Open <folder>` the sheet stays open. The menuitem name is the remote's name only while it is online.
