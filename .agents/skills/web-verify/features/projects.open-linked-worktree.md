---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Remove from Porcelain"
  - "No projects registered"
  - "Select a worktree"
  - "Open project"
  - "Folder path"
  - "Every worktree appears in the sidebar."
  - "Main worktree"
tests:
  - apps/web/spec/e2e/projects-open-linked-worktree.e2e.ts
api:
  - DELETE /api/projects/:projectId
  - POST /api/projects
---

# projects.open-linked-worktree

## What it is

Opening a repository that has a linked worktree from the empty workspace (no project registered) registers it with both worktrees, shows the worktree the dialog opened (its main worktree), and replaces the empty workspace in the browser history so Back does not return to it.

## How a user reaches it

- Empty workspace `/` ("Select a worktree") → `Toggle Sidebar` (or `ControlOrMeta+b`) → `Open project` → browse to the repository → `Open <folder>`.
- The empty workspace exists only when no project is registered; with this CLI that means removing the sample project first (`projects.remove`).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (web mode), then `REPO=<the repository path start printed>`. Drive it last in an instance or on a fresh one: it removes and re-registers the sample project.

### Setup

A linked worktree on a new branch beside the sample (the kit does the same):

```sh
git -C "$REPO" worktree add -q -b linked "$REPO/../linked"
```

Check: `git -C "$REPO" worktree list` prints two lines, `$REPO … [main]` and `$REPO/../linked … [linked]` (as absolute paths).

### Reach the empty workspace

1. `$C open /`, then `$C click --role button --name "Toggle Sidebar"`
   Look for: dialog "Sidebar" with project button "repository" and two worktree rows under it ("main", and "linked" once the server's inventory refresh picks the worktree up).
2. `$C click --role button --name "repository" --button right`, then `$C click --role menuitem --name "Remove from Porcelain"`
   Look for: alertdialog "Remove repository from Porcelain?" with buttons "Cancel" and "Remove from Porcelain".
3. `$C click --role button --name "Remove from Porcelain"`
   Look for: the alertdialog is gone; text "No projects registered" in the sheet; Page URL `/`; Page Title "Porcelain".
4. `$C open /`
   Look for: after the full reload, Page URL stays `/`; text "Select a worktree"; button "Toggle Sidebar".

### Open the repository again

5. `$C click --role button --name "Toggle Sidebar"`, then `$C click --role button --name "Open project"`
   Look for: dialog "Open project"; navigation "Folder path"; folder buttons "repository" and "linked" (both are worktrees of one repository).
6. `$C click --role button --name "repository"`
   Look for: text "Every worktree appears in the sidebar."; button "Open repository" enabled.
7. `$C click --role button --name "Open repository"`
   Look for: dialog "Open project" is gone; Page URL `/<new projectId>/<main worktreeId>` (not `/`); Page Title "Changes — repository"; in the sheet, project button "repository" with two worktree rows: one whose name contains "Main worktree" and is pressed, one labelled "linked".
8. `$C network`
   Look for: `DELETE /api/projects/<old projectId>` 200 and `POST /api/projects` 200.

## What proves it works

- End state: the URL is the new project's main worktree and the main row is pressed; the registration holds both worktrees (two rows under "repository").
- The history promise (no `/` entry left behind to go Back to) cannot be read through the CLI; see Gotchas.
- `apps/web/spec/e2e/projects-open-linked-worktree.e2e.ts`: after removal the URL is `/` and a reload shows "Select a worktree"; opening the main repository path closes the dialog, the server registers one project with 2 worktrees, the URL is that project's main worktree, the button matching /Main worktree/ is pressed, and the navigation history holds exactly that one entry (read through `server.inventory()` and `navigation.entries()`).

## Gotchas

- CLI gap for the history promise: there is no command to read the browser history or go Back. Needed: `cli history` (prints `navigation.entries()` pathnames; the last entry must be `/<projectId>/<worktreeId>` with the `/` from step 4 replaced, not followed) or `cli back` (must not land on the empty `/`). Note that `open` itself pushes history entries, unlike the test's `page.reload()`.
- Phone width: the navigator is in the sidebar sheet; after removing the project and after opening the repository the sheet stays open.
- The worktree row's accessible name is built from its branch label, path, project name, status and the hidden "Main worktree" text, so address it by `--name "/Main worktree/"` and never by an exact name.
- The project gets a new id: any URL saved from before step 3 now redirects to `/`. File preferences, reviewed marks and comments of the old project are gone.
- Remove the linked worktree afterwards if the instance continues: `git -C "$REPO" worktree remove "$REPO/../linked" && git -C "$REPO" branch -D linked`.
