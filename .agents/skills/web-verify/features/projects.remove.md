---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Retry"
  - "Remove from Porcelain"
  - "Cancel"
  - "No projects registered"
  - "Select a worktree"
  - "Worktree not found"
tests:
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
  - apps/web/spec/e2e/projects-remove.e2e.ts
api:
  - POST /api/inventory/refresh
  - DELETE /api/projects/:projectId
---

# projects.remove

## What it is

Removing a project from the navigator's context menu, after confirming, takes it and all its worktrees out of the navigator and the server forgets it (its reviews, marks, comments and preferences in Porcelain); files on disk stay. Cancelling keeps it. An address of one of its worktrees, open at the time or opened later, says "Worktree not found" and does not open another worktree in its place.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → right-click the project button (its name, e.g. "repository") → `Remove from Porcelain` → alertdialog "Remove <name> from Porcelain?" → `Remove from Porcelain` or `Cancel`.
- Unavailable project alert → popover showing the reason, `Retry`, and `Remove from Porcelain` → the same removal confirmation. `Retry` sends `POST /api/inventory/refresh` and publishes its returned inventory.
- Desktop shell: a remote computer's project (in the sidebar group named for that computer) has the same `Remove from Porcelain` item and unavailable-project popover; the confirmation removes it from that computer only. If the computer stops answering or accepting this app while the confirmation is open, it shows the computer's status and reason and the confirm button is disabled; an offline computer lists no projects.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command (web mode), then `REPO=<connection.json fixtures.repositoryPath>`. Case 2 empties the instance; drive it last or re-register afterwards (Gotchas).

### Setup

None.

### Case 1: Cancel keeps the project

1. Navigate to `/` on the card’s web URL (full page load), then click button named `Toggle Sidebar`
   Look for: dialog "Sidebar" with project button "repository".
2. Right-click button named `repository`
   Look for: context menu with menuitems "Copy path", "Rename project", "Remove from Porcelain".
3. Click menuitem named `Remove from Porcelain`
   Look for: alertdialog "Remove repository from Porcelain?" stating that repository files and Git history stay on disk, the project path `$REPO`, buttons "Cancel" and "Remove from Porcelain".
4. Click button named `Cancel`
   Look for: the alertdialog is gone; project button "repository" still in the sheet; Inspect HTTP requests and responses shows no `DELETE /api/projects/…`.

### Case 2: confirming removes it

5. Right-click button named `repository`, then click menuitem named `Remove from Porcelain`
   Look for: alertdialog "Remove repository from Porcelain?".
6. Click button named `Remove from Porcelain`
   Look for: the alertdialog is gone; text "No projects registered" in the sheet; Page URL `/?worktree=<worktreeId>`; text "Worktree not found"; Page Title "Porcelain".
7. Inspect HTTP requests and responses
   Look for: `DELETE /api/projects/<projectId>` with status 200.
8. Navigate to `/` on the card’s web URL (full page load)
   Look for: after the reload Page URL stays `/` and the workspace shows "Select a worktree"; Click button named `Toggle Sidebar` shows "No projects registered" (the server forgot it).
9. Disk: `git -C "$REPO" status --short` still prints ` M README.md`; the repository is untouched.

### Unavailable project popover

1. Make the disposable repository missing, permission denied, replaced, or fail Git, then POST `/api/inventory/refresh` to observe that state.
2. Click the project's unavailable alert. Expect respectively "The repository folder is missing.", "Porcelain cannot read this repository because access is denied.", "Porcelain doesn't recognise this repository as the one it registered. Remove the project and add it again.", or "Git could not read this repository." An older server with no reason shows "Porcelain can't reach this repository right now."
3. Click `Retry` while blocked: expect POST `/api/inventory/refresh`, 200 JSON, and the same state. Restore the repository and click `Retry`: expect the original worktree and no alert.
4. Reopen an unavailable project's popover, click `Remove from Porcelain`, and drive the same Cancel/confirm paths above. On a remote computer's project, the same paths send `DELETE /api/projects/<projectId>` to that computer's address, not this server's.

## What proves it works

- End state: Case 1 leaves "repository" in the navigator with no DELETE request; Case 2 shows "Worktree not found" at the removed worktree's address and "No projects registered" both before and after a reload, the DELETE answered 200, and the repository still on disk.
- `apps/web/spec/e2e/projects-remove.e2e.ts`: the alertdialog shows "Removes this project and its reviews and comments from Porcelain; files and Git history stay on disk." and the project path; `Cancel` closes it, keeps the project button and the server's inventory still contains the project id; confirming closes the alertdialog, shows "No projects registered" and the server's inventory no longer contains it (read through `server.inventory()`); with a second project registered, opening the removed project's worktree address shows "Worktree not found" at `/`, with no region "Review content".
- `apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts`: in the desktop shell, cancelling a remote computer's removal keeps its project; confirming shows "No projects registered." in that computer's group, empties that computer's inventory and leaves this server's project in place.

## Gotchas

- Phone width: the navigator is in the sidebar sheet; it stays open through the dialog and after removal.
- After Case 2 the instance has no project. To continue, re-register the sample: Click button named `Open project`, click button named `repository`, click button named `Open repository`. The project returns with a new id, so URLs, marks, comments and file preferences from before are gone.
- A project with unsaved file drafts refuses removal with "Save or discard unsaved file drafts before removing this project." in the alertdialog.
