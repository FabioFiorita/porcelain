---
route: /
selectors:
  - "Toggle Sidebar"
  - "Open project"
  - "Browse for a folder"
  - "Folder path"
  - "Every worktree appears in the sidebar."
tests:
  - apps/web/spec/e2e/projects-manual-selection.e2e.ts
api:
  - GET /api/projects/folders
  - POST /api/projects
---

# projects.manual-selection

## What it is

A repository is registered only when the owner browses to it and opens it; opening the app never discovers or registers other repositories, and the Open project dialog offers no "found on this machine" list.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → `Open project` (the plus button in the navigator header) → dialog "Open project" → click folders in "Browse for a folder" → `Open <folder>`.
- In the desktop shell with remote computers added, `Open project` is a menu: choose `This computer`.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (web mode), then `REPO=<the repository path start printed>`. The dialog starts in the project home `$REPO/..` (the server's `projectHome`).

### Setup

Two repositories beside the sample, each with one commit:

```sh
for name in selected unselected; do
  git init -q -b main "$REPO/../$name"
  printf '# %s\n' "$name" > "$REPO/../$name/README.md"
  git -C "$REPO/../$name" add README.md
  git -C "$REPO/../$name" -c user.name=Verify -c user.email=verify@example.invalid commit -q -m "Initial commit"
done
```

### Nothing is registered by opening the app

1. `$C open /`
   Look for: Page Title "Changes — repository".
2. `$C click --role button --name "Toggle Sidebar"`
   Look for: dialog "Sidebar" holding navigation "Projects and worktrees" with exactly one project button, "repository"; no button "selected" or "unselected".

### Only the browsed repository is registered

3. `$C click --role button --name "Open project"`
   Look for: dialog "Open project" with text "Browse for a repository on the Porcelain server."; region "Browse for a folder" listing folder buttons including "selected", "unselected" and "repository"; no region "Found on this machine" anywhere in the dialog.
4. `$C click --role button --name "selected"`
   Look for: text "Every worktree appears in the sidebar."; button "Open selected" enabled; the breadcrumb (navigation "Folder path") ends in "selected".
5. `$C click --role button --name "Open selected"`
   Look for: dialog "Open project" is gone; Page URL `/<new projectId>/<worktreeId>`; Page Title "Changes — selected"; the sidebar sheet shows buttons "repository" and "selected" and still no "unselected".
6. `$C network`
   Look for: one `POST /api/projects` with status 200.
7. `$C open /`, then `$C click --role button --name "Toggle Sidebar"`
   Look for: after the reload the navigator still lists exactly "repository" and "selected" (the server kept the one registration and added nothing on its own).

## What proves it works

- End state: after step 7 the server's inventory, as the navigator shows it after a reload, holds two projects: the sample and `selected`; `unselected` never appears although it is a repository in the same folder.
- `apps/web/spec/e2e/projects-manual-selection.e2e.ts`: the dialog lists both folders and has no "Found on this machine" region, the server inventory holds one project before opening, and after `Open selected` it holds exactly two, including `selected` (read through `server.inventory()`).

- `packages/client/src/features/projects/queries/inventory.spec.ts` proves a late pre-write read cannot remove a confirmed registration, even when the next read fails; native connection scopes also isolate device refreshes and cancel unmounted HTTP reads.

## Gotchas

- Phone width: the navigator is in the sidebar sheet behind `Toggle Sidebar`; after `Open selected` the sheet stays open.
- Registering leaks into later features of the same instance: `/` opens the first worktree waiting for review, and the extra project stays listed. Remove it with right-click `selected` → `Remove from Porcelain` → confirm `Remove from Porcelain` (see `projects.remove`), or start a fresh instance.
- Folder names must be unique in the project home listing: the list also holds the kit's own folders (`home`, `repository`, `state`, `web` and others), so do not name a new repository after one of them.
