# access.environment-name

## What it is

The navigator header names the computer Porcelain runs on. It shows the host name until the owner saves a name in Settings → This computer. The header, the tab title and the pairing instructions then show that name, and saving an empty name goes back to the host name.

## How a user reaches it

- Workspace → `Toggle Sidebar` (phone width) → the navigator header shows "Porcelain" and the computer's name.
- Navigator footer `Settings` (or `Alt+Shift+S` on the workspace, focus outside a text field) → `This computer` → textbox "Name of this computer" → `Save` (or `Enter` in the field).
- Route: `/settings/computer` (desktop shell only).

## Driving it

Start with `$C start --desktop`, then run from the repository root with `C=.agents/skills/web-verify/scripts/cli`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

`HOST=$(hostname)`: the server reads the machine's own host name (the sandbox does not change it). That is the name shown until one is saved. The project is named "repository".

1. Click the button named 'Toggle Sidebar'
   Look for: navigation "Projects and worktrees" whose header shows "Porcelain" and the text `$HOST`.
2. Click the button named 'Settings'
   Look for: Page URL ends `/settings/appearance`; Page Title "Settings".
3. Click the button named 'This computer'
   Look for: Page URL ends `/settings/computer`; textbox "Name of this computer" empty (its placeholder is `$HOST`); button "Save" disabled.
4. Set the text field named 'Name of this computer' to 'Workstation'
   Look for: button "Save" enabled.
5. Click the button named 'Save'
   Look for: Page Title "Settings · Workstation"; the Settings header under "Porcelain" shows "Workstation"; button "Save" disabled again.
6. Click the button named 'Devices'
   Look for: the text "Open the link or scan the code on the other device to connect it to Workstation. Each link works once, for a few minutes."
7. Click the button named 'This computer'
   Look for: textbox "Name of this computer" holds "Workstation"; button "Save" disabled.
8. Click the button named 'Back'
   Look for: Page URL `/<projectId>/<worktreeId>`; Page Title "Changes — repository · Workstation".
9. Click the button named 'Toggle Sidebar'
   Look for: navigation "Projects and worktrees" header shows "Workstation" (no longer `$HOST`).
10. Click the button named 'Settings'
    Look for: Page URL ends `/settings/appearance`; Page Title "Settings · Workstation".
11. Click the button named 'This computer'
    Look for: textbox "Name of this computer" holds "Workstation".
12. Set the text field named 'Name of this computer' to an empty value
    Look for: textbox empty; button "Save" enabled.
13. Click the button named 'Save'
    Look for: Page Title "Settings"; the Settings header shows `$HOST` again.
14. Click the button named 'Back'
    Look for: Page Title "Changes — repository".

## What proves it works

- After step 5, open `/settings/computer` on the instance web URL reloads the page and still shows "Workstation" in the textbox and the Page Title "Settings · Workstation". The name comes back from the server in `GET /api/inventory` (`environment: { name, custom }`).
- Browser network evidence lists `PUT /api/environment/name` with status 200 for each Save.
- `apps/web/spec/e2e/access-environment-name.desktop.e2e.ts`: reads the host name from the server and checks the navigator shows it. It saves "Workstation" and polls the server for `{ name: 'Workstation', custom: true }`. It checks the Devices text "to connect it to Workstation.", the titles "Settings · Workstation" and "Changes — <project> · Workstation", and the navigator header. Then it clears the name and polls for `{ name: <host>, custom: false }` and the titles "Settings" and "Changes — <project>".

## Gotchas

- Desktop shell only: without `--desktop`, Settings has no This computer section. The desktop bridge is not needed.
- The name stays for the life of the instance and changes every page title to "… · Workstation". Other maps that check a title will see it. Finish with steps 12 and 13, or start a new instance.
- Back returns to the workspace only when the workspace page is behind Settings in history. After a direct open `/settings/...` on the instance web URL it goes to `/`, which redirects to the workspace, so the end title is the same.
- If setting an empty value does not clear the field, click the textbox, then press `Mod+A` and press `Backspace`.
- Phone width: the navigator is a sheet behind `Toggle Sidebar`. Choosing `Settings` closes the sheet.
- This computer also shows the service update ("Porcelain 1.0.0", "Update to 1.1.0"). Do not click it here: it starts the scripted update of `access.service-update`.
