---
route: /
selectors:
  - 'Toggle Sidebar'
  - 'Open project'
  - 'Browse for a folder'
  - 'Folder path'
  - 'No subfolders.'
  - 'Pick a folder that is a Git repository.'
  - 'Up'
  - 'Every worktree appears in the sidebar.'
tests:
  - apps/web/spec/e2e/projects-open-folder.e2e.ts
  - apps/web/spec/integration/projects-open-folder.test.tsx
api:
  - GET /api/projects/folders
  - POST /api/projects
---

# projects.open-folder

The Open project dialog browses the server's folders, starting in its project home; a folder that is a Git repository opens as a registered project and its worktree is shown, while a folder that is not a repository cannot be opened.

## How to get to it (user POV)

- Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → `Open project` (plus button in the navigator header) → dialog "Open project" → region "Browse for a folder": click a folder to enter it, `Up` to go to the parent, a breadcrumb button (navigation "Folder path") to jump to an ancestor → `Open <folder>`.
- Desktop shell with remote computers added: `Open project` is a menu → `This computer` (see `projects.open-remote`). The desktop app with its bridge opens the native folder picker instead of this dialog.

## Driving it with browser

Preconditions: [surface baseline](README.md).

The folder dialog opens at project home (`$REPO/..`).

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

1. Navigate to `/`, then click button `Toggle Sidebar`
   Expect: dialog "Sidebar" with button "Open project", an always-visible search field and Filter worktrees. The scoped "repository · <computer>" project header is registered.
2. Click button `Open project`
   Expect: dialog "Open project", text "Browse for a repository on the Porcelain server."; folder buttons "plain", "browsed", "repository"; the project home is no repository, so text "Pick a folder that is a Git repository." and a disabled `Open porcelain-dev-…` button.
3. Click button `plain`
   Expect: text "No subfolders."; text "Pick a folder that is a Git repository."; button "Open plain" disabled; button "Up" present.

### A repository opens as a project

4. Click button `Up`
   Expect: back in the project home (folder buttons "plain", "browsed" again).
5. Click button `browsed`
   Expect: text "Every worktree appears in the sidebar."; button "Open browsed" enabled.
6. Click button `Open browsed`
   Expect: dialog "Open project" is gone; URL `/<new projectId>/<worktreeId>`; title "Changes — browsed"; open Worktrees in the still-open sidebar sheet: "browsed" is marked "Current" and "repository" is also listed. Press Escape.
7. Inspect HTTP traffic
   Expect: `GET /api/projects/folders` (no query), `GET /api/projects/folders?path=…plain`, and one `POST /api/projects` with status 200; no POST while "plain" was shown.
8. Navigate to `/`, then click button `Toggle Sidebar` and inspect the project headers
   Expect: after the reload the project headers still list "browsed" and "repository" with computer identity, and no "plain".

### Observable proof

No registration POST for the plain folder; exactly one after choosing browsed. Reload inventory retains browsed.

Automated coverage: `projects-open-folder.e2e.ts`, `projects-open-folder.test.tsx`.

## Gotchas

- The navigator sheet stays open after dialog close. Reopening the folder browser starts at project home.
- Fixture names home/repository/state/web already exist; avoid collisions with directory/sidebar controls. Remove browsed or reset before another map.
