---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Remove from Porcelain"
  - "Cancel"
  - "No projects registered"
  - "Select a worktree"
tests:
  - apps/web/spec/e2e/projects-remove.e2e.ts
api:
  - DELETE /api/projects/:projectId
---

# projects.remove

## What it is

Removing a project from the navigator's context menu, after confirming, takes it and all its worktrees out of the navigator and the server forgets it (its reviews, marks, comments and preferences in Porcelain); files on disk stay. Cancelling keeps it.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → right-click the project button (its name, e.g. "repository") → `Remove from Porcelain` → alertdialog "Remove <name> from Porcelain?" → `Remove from Porcelain` or `Cancel`.
- Remote computers' projects in the desktop shell have no Rename/Remove items (only `Copy path`).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (web mode), then `REPO=<the repository path start printed>`. Case 2 empties the instance; drive it last or re-register afterwards (Gotchas).

### Setup

None.

### Case 1: Cancel keeps the project

1. `$C open /`, then `$C click --role button --name "Toggle Sidebar"`
   Look for: dialog "Sidebar" with project button "repository".
2. `$C click --role button --name "repository" --button right`
   Look for: context menu with menuitems "Copy path", "Rename project", "Remove from Porcelain".
3. `$C click --role menuitem --name "Remove from Porcelain"`
   Look for: alertdialog "Remove repository from Porcelain?" stating that repository files and Git history stay on disk, the project path `$REPO`, buttons "Cancel" and "Remove from Porcelain".
4. `$C click --role button --name "Cancel"`
   Look for: the alertdialog is gone; project button "repository" still in the sheet; `$C network` shows no `DELETE /api/projects/…`.

### Case 2: confirming removes it

5. `$C click --role button --name "repository" --button right`, then `$C click --role menuitem --name "Remove from Porcelain"`
   Look for: alertdialog "Remove repository from Porcelain?".
6. `$C click --role button --name "Remove from Porcelain"`
   Look for: the alertdialog is gone; text "No projects registered" in the sheet; Page URL `/`; Page Title "Porcelain".
7. `$C network`
   Look for: `DELETE /api/projects/<projectId>` with status 200.
8. `$C open /`
   Look for: after the reload Page URL stays `/` and the workspace shows "Select a worktree"; `$C click --role button --name "Toggle Sidebar"` shows "No projects registered" (the server forgot it).
9. Disk: `git -C "$REPO" status --short` still prints ` M README.md`; the repository is untouched.

## What proves it works

- End state: Case 1 leaves "repository" in the navigator with no DELETE request; Case 2 ends at `/` with "No projects registered" both before and after a reload, the DELETE answered 200, and the repository still on disk.
- `apps/web/spec/e2e/projects-remove.e2e.ts`: `Cancel` closes the alertdialog, keeps the project button and the server's inventory still contains the project id; confirming closes the alertdialog, shows "No projects registered" and the server's inventory no longer contains it (read through `server.inventory()`).

## Gotchas

- Phone width: the navigator is in the sidebar sheet; it stays open through the dialog and after removal.
- After Case 2 the instance has no project. To continue, re-register the sample: `$C click --role button --name "Open project"`, `$C click --role button --name "repository"`, `$C click --role button --name "Open repository"`. The project returns with a new id, so URLs, marks, comments and file preferences from before are gone.
- A project with unsaved file drafts refuses removal with "Save or discard unsaved file drafts before removing this project." in the alertdialog.
