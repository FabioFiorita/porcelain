---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Rename project"
  - "Name"
  - "Rename"
tests:
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
  - apps/web/spec/integration/projects-rename.test.tsx
api:
  - PATCH /api/projects/:projectId
---

# projects.rename

Renaming a project from the navigator's project action submenu changes only its label: the navigator and the tab title show the new name and the server keeps it; nothing on disk changes, and a blank name is refused.

## How to get to it (user POV)

- Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → Manage projects → project menuitem (e.g. "repository") → `Rename project` → dialog "Rename project" → textbox `Name` → `Rename` (or `Enter`; `Cancel` closes).
- Desktop shell: a remote computer's project (under Manage projects, in the group named for that computer) has the same `Rename project` item; the dialog sends the rename to that computer. If the computer stops answering or accepting this app while the dialog is open, the dialog shows its status and reason (e.g. "Needs pairing. It no longer accepts this app. …") and `Rename` is disabled; an unavailable computer can retain its last known projects; the existing action guards still refuse changes until it reconnects.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Rename the sample project

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Toggle Sidebar`
   Expect: dialog "Sidebar" with Filter worktrees.
3. Open Manage projects → menuitem `repository`
   Expect: project action submenu with menuitems "Copy path", "Rename project", "Remove from Porcelain".
4. Click menuitem `Rename project`
   Expect: dialog "Rename project"; textbox "Name" focused with value "repository"; buttons "Cancel" and "Rename".
5. Fill textbox `Name` with ' '
   Expect: textbox "Name" [invalid] with an alert under it reading "Too small: expected string to have >=1 characters"; button "Rename" disabled.
6. Fill textbox `Name` with 'Browser renamed project'
   Expect: the alert is gone; button "Rename" enabled.
7. Click button `Rename`
   Expect: dialog "Rename project" is gone; project menuitem "Browser renamed project" after reopening Manage projects in the sheet and no project menuitem "repository"; title "Changes — Browser renamed project".
8. Inspect HTTP traffic
   Expect: `PATCH /api/projects/<projectId>` with status 200.
9. Navigate to `/`, then click button `Toggle Sidebar`
   Expect: after reopening Manage projects the project menuitem is still "Browser renamed project".

### Observable proof

Reload retains new label; PATCH/200; `ls "$REPO/.."` still contains repository.

Automated coverage: `projects-open-remote.desktop.e2e.ts`, `projects-rename.test.tsx`.

## Gotchas

- Rename back to repository before other maps. Names are trimmed/length-limited; control characters give “The name must not contain control characters”.
