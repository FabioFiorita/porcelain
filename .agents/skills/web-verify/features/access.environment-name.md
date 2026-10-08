---
route: /
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Projects and worktrees"
  - "Settings"
  - "This computer"
  - "Name of this computer"
  - "Save"
  - "Devices"
  - "connect it to"
  - "Back"
tests:
  - apps/web/spec/e2e/access-environment-name.desktop.e2e.ts
api:
  - GET /api/inventory
  - PUT /api/environment/name
---

# access.environment-name

## What it is

The navigator header names the computer Porcelain runs on. It shows the host name until the owner saves a name in Settings → This computer. The header, the tab title and the pairing instructions then show that name, and saving an empty name goes back to the host name.

## How a user reaches it

- Workspace → `Toggle Sidebar` (phone width) → the navigator header shows "Porcelain" and the computer's name.
- Navigator footer `Settings` (or `Alt+Shift+S` on the workspace, focus outside a text field) → `This computer` → textbox "Name of this computer" → `Save` (or `Enter` in the field).
- Route: `/settings/computer` (desktop shell only).

## Driving it

Start with `$C start --desktop`; pair your browser using the card’s pairing-link command, then run from the repository root with `C=.agents/skills/web-verify/scripts/cli`.

### Setup

`HOST=$(hostname)`: the server reads the machine's own host name (the sandbox does not change it). That is the name shown until one is saved. The project is named `repository`.

1. Click button named `Toggle Sidebar`
   Look for: navigation "Projects and worktrees" whose header shows "Porcelain" and the text `$HOST`.
2. Click button named `Settings`
   Look for: Page URL ends `/settings/appearance`; Page Title "Settings".
3. Click button named `This computer`
   Look for: Page URL ends `/settings/computer`; textbox "Name of this computer" empty (its placeholder is `$HOST`); button "Save" disabled.
4. Replace the contents of textbox named `Name of this computer` with 'Workstation'
   Look for: button "Save" enabled.
5. Click button named `Save`
   Look for: Page Title "Settings · Workstation"; the Settings header under "Porcelain" shows "Workstation"; button "Save" disabled again.
6. Click button named `Devices`
   Look for: the text "Open the link or scan the code on the other device to connect it to Workstation. Each link works once, for a few minutes."
7. Click button named `This computer`
   Look for: textbox "Name of this computer" holds "Workstation"; button "Save" disabled.
8. Click button named `Back`
   Look for: Page URL `/<projectId>/<worktreeId>`; Page Title "Changes — repository · Workstation".
9. Click button named `Toggle Sidebar`
   Look for: navigation "Projects and worktrees" header shows "Workstation" (no longer `$HOST`).
10. Click button named `Settings`
    Look for: Page URL ends `/settings/appearance`; Page Title "Settings · Workstation".
11. Click button named `This computer`
    Look for: textbox "Name of this computer" holds "Workstation".
12. Replace the contents of textbox named `Name of this computer` with ''
    Look for: textbox empty; button "Save" enabled.
13. Click button named `Save`
    Look for: Page Title "Settings"; the Settings header shows `$HOST` again.
14. Click button named `Back`
    Look for: Page Title "Changes — repository".

## What proves it works

- After step 5, Navigate to `/settings/computer` on the card’s web URL (full page load) reloads the page and still shows "Workstation" in the textbox and the Page Title "Settings · Workstation". The name comes back from the server in `GET /api/inventory` (`environment: { name, custom }`).
- Inspect HTTP requests and responses lists `PUT /api/environment/name` with status 200 for each Save.
- `apps/web/spec/e2e/access-environment-name.desktop.e2e.ts`: reads the host name from the server and checks the navigator shows it. It saves "Workstation" and polls the server for `{ name: 'Workstation', custom: true }`. It checks the Devices text "to connect it to Workstation.", the titles "Settings · Workstation" and "Changes — <project> · Workstation", and the navigator header. Then it clears the name and polls for `{ name: <host>, custom: false }` and the titles "Settings" and "Changes — <project>".

## Gotchas

- Desktop shell only: without `--desktop`, Settings has no This computer section. The desktop bridge is not needed.
- The name stays for the life of the instance and changes every page title to "… · Workstation". Other maps that check a title will see it. Finish with steps 12 and 13, or start a new instance.
- Back returns to the workspace only when the workspace page is behind Settings in history. After a direct Navigate to `/settings/...` on the card’s web URL (full page load) it goes to `/`, which redirects to the workspace, so the end title is the same.
- If replacing the field contents with an empty value does not clear the field, click the textbox, then press `ControlOrMeta+a` and Press `Backspace`.
- Phone width: the navigator is a sheet behind `Toggle Sidebar`. Choosing `Settings` closes the sheet.
- This computer also shows the service update ("Porcelain 1.0.0", "Update to 1.1.0"). Do not click it here: it starts the scripted update of `access.service-update`.
