---
route: /remotes/$environmentId/$projectId/$worktreeId
shell: desktop
selectors:
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Computers'
  - 'Pairing link'
  - 'Add'
  - 'Back'
  - 'Online'
  - 'Open project'
  - 'Open project on'
  - 'This computer'
  - 'Browse for a repository on '
  - 'Browse for a repository on the Porcelain server.'
  - 'Every worktree appears in the sidebar.'
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

In the desktop app with a remote computer added, the navigator's `Open project` button becomes a menu "Open project on" with `This computer` and each remote computer by name: a remote computer browses that computer's own folders, registers the repository on it alone and opens its worktree under `/remotes/…`; `This computer` still opens a project on this computer.

## Sub-features

- `projects.open-remote` — Remote computer and workspace selection.

## How to get to it (user POV)

- Desktop shell only. Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → `Open project` (plus button) → menu "Open project on" → `This computer` or the remote computer's name (disabled with a status badge while it is not online) → dialog "Open project" ("Browse for a repository on <name>.") → folder → `Open <folder>`.
- A remote computer is added in Settings → `Computers` (route `/settings/computers`) → textbox `Pairing link` → `Add`.
- Without remote computers, `Open project` is a plain button (`projects.open-folder`).

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `--desktop`.

### Setup: a second computer

1. `$C remote start`
   Expect: "remote computer Remote journey computer, project remote-sample", its address and `remote repository <path>` (call it `$REMOTE_REPO`).
2. `LINK=$($C remote pairing-link | head -1)`, Navigate to `/settings/computers`, replace the contents of textbox named `Pairing link` with the expanded value `$LINK`, click button `Add`, then wait for 'Online'
   Expect: list "Computers" with listitem "Remote journey computer" holding "Online".
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

1. Navigate to `/`, then click button `Toggle Sidebar`
   Expect: the navigator header names this computer. The former per-computer Settings shortcut buttons are absent; Settings → Computers owns those details. Projects remains available from its own navigator control.
2. Click button `Open project`
   Expect: menu "Open project" with group "Open project on" holding menuitems "This computer" and "Remote journey computer".
3. Click menuitem `Remote journey computer`
   Expect: dialog "Open project" with text "Browse for a repository on Remote journey computer."; the breadcrumb (navigation "Folder path") ends in the remote's project home `porcelain-dev-…`; folder buttons "elsewhere", "home", "repository", "state", "web" (the remote's disk; no "here").
4. Click button `elsewhere`
   Expect: text "Every worktree appears in the sidebar."; button "Open elsewhere" enabled.
5. Click button `Open elsewhere`
   Expect: the dialog is gone; URL `/remotes/<remote environmentId>/<projectId>/<worktreeId>`; title "Changes — elsewhere · Remote journey computer"; in the sheet, group "Remote journey computer" holds project button "elsewhere" and group "This computer" does not.
6. Inspect HTTP traffic
   Expect: `POST /api/projects` sent to the remote's address (`127.0.0.1:<remote port>`) with status 200; none to this computer's web address.

### Case 2: This computer still opens here

7. Click button `Open project`, then click menuitem `This computer`
   Expect: dialog "Open project" with text "Browse for a repository on the Porcelain server."; folder button "here" (this computer's disk; no "elsewhere").
8. Click button `here`, then click button `Open here`
   Expect: the dialog is gone; URL `/<projectId>/<worktreeId>` (no `/remotes/`); title "Changes — here"; group "This computer" holds project button "here", and group "Remote journey computer" still holds "elsewhere".

### Observable proof

Reload navigator: here belongs only to This computer, elsewhere only to Remote journey computer; registration POST went to the remote.

Automated coverage: `projects-open-remote.desktop.e2e.ts`.

## Gotchas

- Requires --desktop for views without native picker/bridge; remotes persist in this browser. Remote fixture names are Remote journey computer and remote-sample.
- Navigator sheet stays open after Open <folder>. Remote menuitem uses the computer name only while online.
