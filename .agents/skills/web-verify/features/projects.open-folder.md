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
  - 'Reconnect'
  - 'Choose folder'
tests:
  - apps/web/spec/e2e/projects-reconnect.desktop.e2e.ts
  - apps/web/spec/e2e/projects-open-folder.e2e.ts
  - apps/web/spec/integration/projects-open-folder.test.tsx
  - apps/server/spec/projects-reconnection-retention.spec.ts
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
   Expect: dialog "Open project" is gone; URL `/<new projectId>/<worktreeId>`; title "Review — browsed"; open Worktrees in the still-open sidebar sheet: "browsed" is marked "Current" and "repository" is also listed. Press Escape.
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

## Repository recovery

Unavailable project groups show the inspection reason inline, with `Reconnect` and `Choose folder`, even when collapsed. Project actions also offer `Reconnect project`. Reconnect opens a confirmation for that project and its saved path; Choose folder browses the selected server's filesystem and asks for confirmation after choosing a repository. Folder choice itself does not accept a new identity.

For an isolated fixture, move its `.git` outside the checkout without deleting it, then initialize a new Git repository at the same checkout path. Refresh inventory. Expect the original project to be unavailable with the different-identity explanation. Capture this sidebar as the after image for report 26.

- Open the same path through Open project: expect `Reconnect <original name>` and the selected path, one original project in inventory and no duplicate. Cancel: old worktree routes stay unavailable.
- From inline Reconnect, inspect the trust warning and press `Reconnect`: expect the original project id and name, a newly identified main worktree and empty current review marks. No old review or Walkthrough rows are deleted or reassigned. Replacement worktrees do not display saved records from the old filesystem identity.
- From Choose folder, navigate on the affected computer, choose a repository, then cancel the confirmation: inventory must remain unchanged. Confirming a folder already registered to another project is refused.
- Make the confirmation path disappear before pressing Reconnect: expect an inline error naming the missing folder. Git inspection errors identify a present but unreadable or invalid repository. Browsing a broken Git marker reports that error with Try again and Home folder controls.
- Restore the saved `.git`, refresh and explicitly reconnect it: the original worktree id and its saved review marks return. The server regression `apps/server/spec/integration/projects-register.integration.ts` covers this round trip with real Git and saved marks.

Retain sidebar, confirmation and connected sidebar screenshots; compare with the baseline gallery. Repeat folder selection against a connected remote: requests and filesystem browsing belong to that environment, never the local machine. Mobile remains a reader and has no project recovery controls.

Saved old records stay under their original worktree ids and are preserved outside ordinary absent-worktree collection. The retention regression advances beyond thirty days, reopens the database, restores the original identity and reads back its marks; replacement worktrees removed normally still expire. Once an original worktree returns, its ordinary absence policy resumes. Explicit project removal can still remove its records. Reopen the replacement folder through Open project and confirm the retained name remains. This flow does not add an archive reader or migrate old records into replacement worktrees; that requires a separate owner decision if history must be browsed while the original filesystem identity is absent.

A confirmed reconnect opens the replacement worktree before dismissing the dialog. The route must contain its new worktree id and show Changes; it must not remain on Worktree not found. Cancellation leaves the original unavailable binding unchanged. The named desktop-mode reconnect regression covers this navigation and return behavior.
