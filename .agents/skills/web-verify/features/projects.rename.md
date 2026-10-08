---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Rename project"
  - "Name"
  - "Rename"
tests:
  - apps/web/spec/integration/projects-rename.test.tsx
api:
  - PATCH /api/projects/:projectId
---

# projects.rename

## What it is

Renaming a project from the navigator's context menu changes only its label: the navigator and the tab title show the new name and the server keeps it; nothing on disk changes, and a blank name is refused.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first, or `ControlOrMeta+b`) → right-click the project button (e.g. "repository") → `Rename project` → dialog "Rename project" → textbox `Name` → `Rename` (or `Enter`; `Cancel` closes).
- Remote computers' projects in the desktop shell cannot be renamed here.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command (web mode).

### Setup

None.

### Rename the sample project

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository".
2. Click button named `Toggle Sidebar`
   Look for: dialog "Sidebar" with project button "repository".
3. Right-click button named `repository`
   Look for: context menu with menuitems "Copy path", "Rename project", "Remove from Porcelain".
4. Click menuitem named `Rename project`
   Look for: dialog "Rename project"; textbox "Name" focused with value "repository"; buttons "Cancel" and "Rename".
5. Replace the contents of textbox named `Name` with ' '
   Look for: textbox "Name" [invalid] with an alert under it reading "Too small: expected string to have >=1 characters"; button "Rename" disabled.
6. Replace the contents of textbox named `Name` with 'Browser renamed project'
   Look for: the alert is gone; button "Rename" enabled.
7. Click button named `Rename`
   Look for: dialog "Rename project" is gone; project button "Browser renamed project" in the sheet and no button "repository"; Page Title "Changes — Browser renamed project".
8. Inspect HTTP requests and responses
   Look for: `PATCH /api/projects/<projectId>` with status 200.
9. Navigate to `/` on the card’s web URL (full page load), then click button named `Toggle Sidebar`
   Look for: after the reload the project button is still "Browser renamed project".

## What proves it works

- End state: the new name survives a full reload (step 9), so the server kept it; the PATCH answered 200; `ls "$REPO/.."` still shows the folder `repository` (only the label changed).
- `apps/web/spec/integration/projects-rename.test.tsx`: a blank name disables `Rename` and shows an alert; renaming shows button "Browser renamed project" and the server's project name becomes it (read through `server.project()`).

## Gotchas

- Phone width: the navigator is in the sidebar sheet behind `Toggle Sidebar`; the old map skipped this step.
- Other maps address the project as "repository": rename it back in the same instance (steps 3–7 with "Browser renamed project" → "repository") before driving them.
- Names are trimmed and limited in length by the server contract; control characters are refused with "The name must not contain control characters".
