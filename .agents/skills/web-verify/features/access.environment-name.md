---
route: /
shell: desktop
selectors:
  - 'Toggle Sidebar'
  - 'Projects and worktrees'
  - 'Settings'
  - 'This computer'
  - 'Rename'
  - 'Name of this computer'
  - 'Save'
  - 'Open This computer:'
  - 'Close Settings'
tests:
  - apps/web/spec/e2e/access-environment-name.desktop.e2e.ts
api:
  - GET /api/inventory
  - PUT /api/environment/name
---

# access.environment-name

Settings names the computer Porcelain runs on; the navigator header stays generic.

## How to get to it (user POV)

- Workspace → `Toggle Sidebar` (phone width) → the navigator header shows only "Porcelain".
- Navigator footer `Settings` (or `Alt+Shift+S` on the workspace, focus outside a text field) → `Computers` → `Open This computer: <name>` → `Rename` beside the title → textbox "Name of this computer" → `Save` (or `Enter` in the field); `Cancel` or `Escape` closes the field.
- Route: `/settings/computers/this-computer` (host-authorized browser or desktop).

## Driving it with browser

Preconditions: [surface baseline](README.md).

Computer details and pairing show the host name until the owner saves a name in Settings → Computers → This computer. The title and the tab title then show that name, and saving an empty name goes back to the host name. Sidebar headers, rows and footer chrome never show the computer name.

Required instance mode: `--desktop`.

### Setup

`HOST=$(hostname)`: the server reads the machine's own host name (the sandbox does not change it). That is the name shown until one is saved. The project is named `repository`.

1. Click button `Toggle Sidebar`
   Expect: navigation "Projects and worktrees" whose header shows "Porcelain" without `$HOST`.
2. Click button `Settings`
   Expect: URL ends `/settings/general`; title "Settings".
3. Click button `Computers`, then button named `Open This computer: <name>`, then button `Rename`
   Expect: URL ends `/settings/computers/this-computer`; textbox "Name of this computer" focused and empty (its placeholder is `$HOST`); button "Save" disabled.
4. Fill textbox `Name of this computer` with 'Workstation'
   Expect: button "Save" enabled.
5. Click button `Save`
   Expect: title "Settings · Workstation"; the name field closes; heading "Computers. Workstation".
   Proof before continuing: reload `/settings/computers/this-computer` now: Workstation and Settings · Workstation persist. Inventory returns `{ name, custom }`; each name PUT answers 200.

6. Click button `Rename`, then press `Escape`
   Expect: the name field closes without saving; heading "Computers. Workstation".
7. Click button `Computers`, then button named `Open This computer: <name>`, then button `Rename`
   Expect: textbox "Name of this computer" holds "Workstation"; button "Save" disabled.
8. Click button `Close Settings` twice
   Expect: URL `/<projectId>/<worktreeId>`; title "Changes — repository · Workstation".
9. Click button `Toggle Sidebar`
   Expect: navigation "Projects and worktrees" header shows only "Porcelain", with neither "Workstation" nor `$HOST`.
10. Click button `Settings`
    Expect: URL ends `/settings/general`; title "Settings · Workstation".
11. Click button `Computers`, then button named `Open This computer: <name>`, then button `Rename`
    Expect: textbox "Name of this computer" holds "Workstation".
12. Fill textbox `Name of this computer` with ''
    Expect: textbox empty; button "Save" enabled.
13. Click button `Save`
    Expect: title "Settings"; the name field closes and the heading shows `$HOST`.
14. Click button `Close Settings` twice
    Expect: title "Changes — repository".

Automated coverage: `access-environment-name.desktop.e2e.ts`.

## Gotchas

- Rename/Ways in require host authorization, in either shell. Saved name changes other maps’ title expectations; reset it or restart.
- Direct Settings Back falls back to `/`; in-app entry returns to its predecessor. To empty the field use ControlOrMeta+A then Backspace if fill does not clear it.
- Do not start the update shown on This computer in this naming journey.
