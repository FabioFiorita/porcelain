# projects.open-folder

## What it is

The Open project dialog browses the server's folders, starting in its project home; a folder that is a Git repository opens as a registered project and its worktree is shown, while a folder that is not a repository cannot be opened.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first, or `Mod+B`) → `Open project` (plus button in the navigator header) → dialog "Open project" → region "Browse for a folder": click a folder to enter it, `Up` to go to the parent, a breadcrumb button (navigation "Folder path") to jump to an ancestor → `Open <folder>`.
- Desktop shell with remote computers added: `Open project` is a menu → `This computer` (see `projects.open-remote`). The desktop app with its bridge opens the native folder picker instead of this dialog.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (web mode), then `REPO=<the repository path start printed>`. The dialog opens in the project home `$REPO/..`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

A plain folder and a repository with one commit beside the sample:

```sh
mkdir "$REPO/../plain"
git init -q -b main "$REPO/../browsed"
printf '# Browsed\n' > "$REPO/../browsed/README.md"
git -C "$REPO/../browsed" add README.md
git -C "$REPO/../browsed" -c user.name=Verify -c user.email=verify@example.invalid commit -q -m "Initial commit"
```

### A plain folder cannot be opened

1. Open `/` on the instance web URL, then click the button named 'Toggle Sidebar'
   Look for: dialog "Sidebar" with button "Open project" and project button "repository".
2. Click the button named 'Open project'
   Look for: dialog "Open project", text "Browse for a repository on the Porcelain server."; folder buttons "plain", "browsed", "repository"; the project home is no repository, so text "Pick a folder that is a Git repository." and a disabled `Open porcelain-dev-…` button.
3. Click the button named 'plain'
   Look for: text "No subfolders."; text "Pick a folder that is a Git repository."; button "Open plain" disabled; button "Up" present.

### A repository opens as a project

4. Click the button named 'Up'
   Look for: back in the project home (folder buttons "plain", "browsed" again).
5. Click the button named 'browsed'
   Look for: text "Every worktree appears in the sidebar."; button "Open browsed" enabled.
6. Click the button named 'Open browsed'
   Look for: dialog "Open project" is gone; Page URL `/<new projectId>/<worktreeId>`; Page Title "Changes — browsed"; the still-open sidebar sheet shows project buttons "browsed" and "repository", with the "browsed" worktree row pressed.
7. Inspect browser network evidence
   Look for: `GET /api/projects/folders` (no query), `GET /api/projects/folders?path=…plain`, and one `POST /api/projects` with status 200; no POST while "plain" was shown.
8. Open `/` on the instance web URL, then click the button named 'Toggle Sidebar'
   Look for: after the reload the navigator still lists "browsed" and "repository" and no "plain".

## What proves it works

- End state: the plain folder never produces a request to register (step 7 shows the single POST came after choosing "browsed"), and after a reload the server's inventory, as the navigator shows it, still holds `browsed`.
- `apps/web/spec/e2e/projects-open-folder.e2e.ts`: inside "plain" the dialog shows "No subfolders.", "Pick a folder that is a Git repository." and a disabled "Open plain", and the server never registers it; going `Up` and choosing "browsed" shows "Every worktree appears in the sidebar.", `Open browsed` closes the dialog, the navigator shows "browsed" and the server's inventory contains its path (read through `server.inventory()`).

## Gotchas

- Phone width: the navigator is in the sidebar sheet behind `Toggle Sidebar`; the sheet stays open after the dialog closes.
- The folder list also holds the kit's folders (`home`, `repository`, `state`, `web` and others): do not name test folders after them. Clicking the "repository" folder while the sample project is registered may collide with the sidebar's "repository" project button (the dialog is modal over the sheet, which should hide the sheet from the accessibility tree; if the click reports two matches, that is why). This map never clicks it.
- Closing the dialog resets the browser to the project home; reopening starts there again.
- Registering leaks into later features of the same instance (`/` opens the first worktree waiting for review). Remove `browsed` with right-click `browsed` → `Remove from Porcelain` → confirm (see `projects.remove`), or start a fresh instance.
