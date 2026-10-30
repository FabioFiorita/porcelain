---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Retry"
  - "Remove from Porcelain"
  - "Cancel"
  - "No projects registered"
  - "Open your first project"
  - "Worktree not found"
tests:
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
  - apps/web/spec/e2e/projects-remove.e2e.ts
  - apps/web/spec/e2e/projects-retry.e2e.ts
  - apps/web/spec/integration/projects-remove.test.tsx
api:
  - POST /api/inventory/refresh
  - DELETE /api/projects/:projectId
---

# projects.remove

Removing a project from the navigator's project action submenu, after confirming, takes it and all its worktrees out of the navigator and the server forgets it (its reviews, marks, comments and preferences in Porcelain); files on disk stay.

## How to get to it (user POV)

- Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → Manage projects → project menuitem (its name, e.g. "repository") → `Remove from Porcelain` → alertdialog "Remove <name> from Porcelain?" → `Remove from Porcelain` or `Cancel`.
- Manage projects → unavailable project submenu showing the reason, `Retry`, and `Remove from Porcelain` → the same removal confirmation. `Retry` sends `POST /api/inventory/refresh` and publishes its returned inventory.
- Desktop shell: a remote computer's project (under Manage projects, in the group named for that computer) has the same `Remove from Porcelain` item and unavailable-project submenu; the confirmation removes it from that computer only. If the computer stops answering or accepting this app while the confirmation is open, it shows the computer's status and reason and the confirm button is disabled; an offline computer lists no projects.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Cancelling keeps it. An address of one of its worktrees, open at the time or opened later, says "Worktree not found" and does not open another worktree in its place.

### Case 1: Cancel keeps the project

1. Navigate to `/`, then click button `Toggle Sidebar`
   Expect: dialog "Sidebar" with Filter worktrees.
2. Open Manage projects → menuitem `repository`
   Expect: project action submenu with menuitems "Copy path", "Rename project", "Remove from Porcelain".
3. Click menuitem `Remove from Porcelain`
   Expect: alertdialog "Remove repository from Porcelain?" stating that repository files and Git history stay on disk, the project path `$REPO`, buttons "Cancel" and "Remove from Porcelain".
4. Click button `Cancel`
   Expect: the alertdialog is gone; project menuitem "repository" remains after reopening Manage projects; Inspect HTTP traffic shows no `DELETE /api/projects/…`.

### Case 2: confirming removes it

5. Open Manage projects → menuitem `repository`, then click menuitem `Remove from Porcelain`
   Expect: alertdialog "Remove repository from Porcelain?".
6. Click button `Remove from Porcelain`
   Expect: the alertdialog is gone; text "No projects registered" in the sheet; URL `/?worktree=<worktreeId>`; text "Worktree not found"; title "Porcelain".
7. Inspect HTTP traffic
   Expect: `DELETE /api/projects/<projectId>` with status 200.
8. Navigate to `/`
   Expect: after the reload URL stays `/` and the workspace shows "Open your first project"; Click button `Toggle Sidebar` shows "No projects registered" (the server forgot it).
9. Disk: `git -C "$REPO" status --short` still prints ` M README.md`; the repository is untouched.

### Unavailable project submenu

1. Make the disposable repository missing, permission denied, replaced, or fail Git, then POST `/api/inventory/refresh` to observe that state.
2. Open Manage projects → the unavailable project. Expect respectively "The repository folder is missing.", "Porcelain cannot read this repository because access is denied.", "Porcelain doesn't recognise this repository as the one it registered. Remove the project and add it again.", or "Git could not read this repository." An older server with no reason shows "Porcelain can't reach this repository right now." Check every reason at 1440 and 414 in light and dark: the submenu stays within the viewport. Restore access, click Retry, and verify POST /api/inventory/refresh completes with 200; reopening the project actions removes the reason and Retry without reloading.
3. Click `Retry` while blocked: expect POST `/api/inventory/refresh`, 200 JSON, and the same state. Restore the repository and click `Retry`: expect the original worktree and no alert.
4. Reopen an unavailable project's submenu, click `Remove from Porcelain`, and drive the same Cancel/confirm paths above. On a remote computer's project, the same paths send `DELETE /api/projects/<projectId>` to that computer's address, not this server's.

### Observable proof

Cancel sends no DELETE. Confirm yields Worktree not found and No projects registered after reload; DELETE/200, repository remains on disk.

Automated coverage: `projects-open-remote.desktop.e2e.ts`, `projects-remove.e2e.ts`, `projects-remove.test.tsx`.

## Gotchas

- Navigator sheet stays open through confirmation/removal. Unsaved drafts refuse with “Save or discard unsaved file drafts before removing this project.”
- To continue, Open project → repository → Open repository. Reregistration creates new IDs without old URLs/marks/comments/preferences.
