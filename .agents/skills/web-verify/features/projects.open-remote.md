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
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Device name"
  - "Create pairing link"
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

`C=.agents/skills/web-verify/scripts/cli`. Two desktop instances, set up as below.

### Setup: a second computer

Two desktop instances stand in for two computers: B (the remote computer) and A (this desktop app). Every command then needs `--instance <id>`.

1. `$C start --desktop` (B), then `$C start --desktop` (A). Note each instance id (`$B`, `$A`), B's web URL from its `web http://127.0.0.1:<port>` line (`$B_WEB`) and each `repository` path (`$REPO_B`, `$REPO_A`).
2. Name B so its rows differ from A's (both default to the host name): `$C --instance $B open /settings/computer`, `$C --instance $B fill --role textbox --name "Name of this computer" "Remote box"`, `$C --instance $B click --role button --name "Save"`.
   Look for: Page Title "Settings · Remote box".
3. Mint a pairing link on B: `$C --instance $B click --role button --name "Ways in"`, `$C --instance $B click --role switch --name "Local network"`, `$C --instance $B click --role button --name "Devices"`, `$C --instance $B fill --role textbox --name "Device name" "Remote computer"`, `$C --instance $B click --role button --name "Create pairing link"`.
   Look for: a paragraph holding `http://192.168.1.20:<port>/pair#c=pcp_…&e=…`. `192.168.1.20` is B's fake LAN address and nothing listens there, so build `$LINK` from `$B_WEB` followed by the `/pair#…` part. The link works once, for a few minutes.
4. Add B on A: `$C --instance $A open /settings/remotes`, `$C --instance $A fill --role textbox --name "Pairing link" "$LINK"`, `$C --instance $A click --role button --name "Add"`.
   Look for: list "Remote computers" with listitem "Remote box" containing "Online" and "http://127.0.0.1:<B port> · Porcelain 1.0.0".
5. A repository on each computer's project home, one commit each:
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

### Case 1: open a project on the remote computer

1. `$C --instance $A open /`, then `$C --instance $A click --role button --name "Toggle Sidebar"`
   Look for: group "This computer" with project button "repository"; group "Remote box" with button "Remote box Online" and its own project "repository".
2. `$C --instance $A click --role button --name "Open project"`
   Look for: menu "Open project" with group "Open project on" holding menuitems "This computer" and "Remote box".
3. `$C --instance $A click --role menuitem --name "Remote box"`
   Look for: dialog "Open project" with text "Browse for a repository on Remote box."; the breadcrumb ends in B's project home `porcelain-dev-…`; folder button "elsewhere" (B's disk; no "here").
4. `$C --instance $A click --role button --name "elsewhere"`
   Look for: text "Every worktree appears in the sidebar."; button "Open elsewhere" enabled.
5. `$C --instance $A click --role button --name "Open elsewhere"`
   Look for: the dialog is gone; Page URL `/remotes/<B environmentId>/<projectId>/<worktreeId>`; Page Title "Changes — elsewhere · Remote box"; in the sheet, group "Remote box" holds project button "elsewhere" (pressed worktree row) and group "This computer" does not.
6. `$C --instance $A network`
   Look for: `POST /api/projects` sent to B's address (`127.0.0.1:<B port>`) with status 200; none to A's own address.

### Case 2: This computer still opens here

7. `$C --instance $A click --role button --name "Open project"`, then `$C --instance $A click --role menuitem --name "This computer"`
   Look for: dialog "Open project" with text "Browse for a repository on the Porcelain server."; folder button "here" (A's disk; no "elsewhere").
8. `$C --instance $A click --role button --name "here"`, then `$C --instance $A click --role button --name "Open here"`
   Look for: the dialog is gone; Page URL `/<projectId>/<worktreeId>` (no `/remotes/`); Page Title "Changes — here"; group "This computer" holds project button "here".

## What proves it works

- End state: `elsewhere` is registered on B only and `here` on A only. Read back by reloading each side: `$C --instance $B open /` then `$C --instance $B click --role button --name "Toggle Sidebar"` lists "elsewhere" and not "here"; the same on `$A` lists "here" under "This computer" and "elsewhere" only under "Remote box".
- `apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts`: choosing the remote computer in the menu shows "Browse for a repository on <name>.", `Open elsewhere` registers it in the remote server's inventory and not in this one, the URL is `/remotes/<environmentId>/<projectId>/<worktreeId>` and the remote group shows "elsewhere"; `This computer` shows "Browse for a repository on the Porcelain server.", registers `here` on this server only, the URL is `/<projectId>/<worktreeId>` and group "This computer" shows "here" (read through each server's `inventory()`).

## Gotchas

- The second computer is a second `start --desktop` instance; its Devices page mints the link (setup above, proven live). A dedicated command would still be simpler: `cli remote start` and `cli remote pairing-link`.
- Desktop shell only: start A with `start --desktop` (Vite desktop mode without the Electron bridge, so `This computer` opens the in-app dialog, not the native picker). Remote computers are kept in A's browser `localStorage` without the bridge.
- Both servers run on one host and are named after it until setup step 2 renames B; without that the menuitem and group names are the host name, and "repository" appears in both groups.
- Phone width: the navigator is in the sidebar sheet; after `Open <folder>` the sheet stays open. The menuitem name is the remote's name only while it is online.
