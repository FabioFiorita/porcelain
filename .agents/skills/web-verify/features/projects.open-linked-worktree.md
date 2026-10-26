---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Remove from Porcelain"
  - "No projects registered"
  - "Open your first project"
  - "Worktree not found"
  - "Open project"
  - "Folder path"
  - "Every worktree appears in the sidebar."
  - "Open a worktree"
tests:
  - apps/web/spec/e2e/projects-open-linked-worktree.e2e.ts
api:
  - DELETE /api/projects/:projectId
  - POST /api/projects
---

# projects.open-linked-worktree

Opening a repository that has a linked worktree from the empty workspace (no project registered) registers it with both worktrees, shows the worktree the dialog opened (its main worktree), and replaces the empty workspace in the browser history so Back does not return to it.

## How to get to it (user POV)

- Empty workspace `/` ("Open your first project") → `Toggle Sidebar` (or `ControlOrMeta+b`) → `Open project` → browse to the repository → `Open <folder>`.
- The empty workspace exists only when no project is registered; with this fixture that means removing the sample project first (`projects.remove`).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

A linked worktree on a new branch beside the sample (the kit does the same):

```sh
git -C "$REPO" worktree add -q -b linked "$REPO/../linked"
```

Check: `git -C "$REPO" worktree list` prints two lines, `$REPO … [main]` and `$REPO/../linked … [linked]` (as absolute paths).

### Reach the empty workspace

1. Navigate to `/`, then click button `Toggle Sidebar`
   Expect: dialog "Sidebar" with project button "repository" and two worktree rows under it ("main", and "linked" once the server's inventory refresh picks the worktree up).
2. Right-click button `repository`, then click menuitem `Remove from Porcelain`
   Expect: alertdialog "Remove repository from Porcelain?" with buttons "Cancel" and "Remove from Porcelain".
3. Click button `Remove from Porcelain`
   Expect: the alertdialog is gone; text "No projects registered" in the sheet; URL `/?worktree=<old worktreeId>`; text "Worktree not found"; title "Porcelain".
4. Navigate to `/`
   Expect: after the full reload, URL stays `/`; text "Open your first project"; button "Toggle Sidebar".

### Open the repository again

5. Click button `Open project` inside the first-project notice
   Expect: dialog "Open project"; navigation "Folder path"; folder buttons "repository" and "linked" (both are worktrees of one repository).
6. Click button `repository`
   Expect: text "Every worktree appears in the sidebar."; button "Open repository" enabled.
7. Click button `Open repository`
   Expect: dialog "Open project" is gone; URL `/<new projectId>/<main worktreeId>` (not `/`); title "Changes — repository"; in the sheet, project button "repository" with two worktree rows: one whose name contains "Open a worktree" and is pressed, one labelled "linked".
8. Inspect HTTP traffic
   Expect: `DELETE /api/projects/<old projectId>` 200 and `POST /api/projects` 200.
9. Go back in browser history
   Expect: URL `/?worktree=<old worktreeId>`, the page step 3 left, saying "Worktree not found" (that project is gone) without opening the new worktree in its place; not `/`: the empty `/` of step 4 was replaced, not left in the history.

### Observable proof

New project main worktree is pressed and both checkouts appear. Browser Back skips the empty workspace and reaches the removed-worktree page.

Automated coverage: `projects-open-linked-worktree.e2e.ts`.

## Gotchas

- Browser Back must skip the empty `/` workspace; landing there indicates push instead of replacement. Navigator sheet stays open after remove/open.
- Match `/Open a worktree/`, not an exact row name. Reregistering creates new IDs; old URLs/marks/comments/preferences are gone.
- Cleanup: `git -C "$REPO" worktree remove "$REPO/../linked" && git -C "$REPO" branch -D linked`.
