---
route: /
selectors:
  - 'Toggle Sidebar'
  - 'Open project'
  - 'Browse for a folder'
  - 'Folder path'
  - 'Every worktree appears in the sidebar.'
tests:
  - apps/web/spec/e2e/projects-manual-selection.e2e.ts
api:
  - GET /api/projects/folders
  - POST /api/projects
---

# projects.manual-selection

A repository is registered only when the owner browses to it and opens it; opening the app never discovers or registers other repositories, and the Open project dialog offers no "found on this machine" list.

## How to get to it (user POV)

- Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → `Open project` (the plus button in the navigator header) → dialog "Open project" → click folders in "Browse for a folder" → `Open <folder>`.
- In the desktop shell with remote computers added, `Open project` is a menu: choose `This computer`.

## Driving it with browser

Preconditions: [surface baseline](README.md).

The folder dialog opens at project home (`$REPO/..`).

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

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Toggle Sidebar`
   Expect: dialog "Sidebar" holding navigation "Projects and worktrees" with an always-visible search field and Filter worktrees. Only the scoped "repository · <computer>" project header is registered; no "selected" or "unselected" project header.

### Only the browsed repository is registered

3. Click button `Open project`
   Expect: dialog "Open project" with text "Browse for a repository on the Porcelain server."; region "Browse for a folder" listing folder buttons including "selected", "unselected" and "repository"; no region "Found on this machine" anywhere in the dialog.
4. Click button `selected`
   Expect: text "Every worktree appears in the sidebar."; button "Open selected" enabled; the breadcrumb (navigation "Folder path") ends in "selected".
5. Click button `Open selected`
   Expect: dialog "Open project" is gone; URL `/<new projectId>/<worktreeId>`; title "Changes — selected"; open Worktrees: the "selected" checkout is marked "Current"; "repository" is also listed and "unselected" is absent. Press Escape.
6. Inspect HTTP traffic
   Expect: one `POST /api/projects` with status 200.
7. Navigate to `/`, then click button `Toggle Sidebar` and inspect the project headers
   Expect: after the reload the project headers still list exactly "repository" and "selected", each with its computer identity (the server kept the one registration and added nothing on its own).

### Observable proof

Reload inventory: sample and selected are registered; unselected stays absent despite its disk repository.

Automated coverage: `projects-manual-selection.e2e.ts`.

## Gotchas

- Open selected leaves the navigator sheet open. Registration persists and changes default workspace selection; remove selected through its labelled Project actions menu → Remove from Porcelain, or reset.
- Use unique folder names: home/repository/state/web already exist in the fixture home.
