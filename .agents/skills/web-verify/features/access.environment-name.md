---
route: /
shell: desktop
selectors:
  - 'Toggle Sidebar'
  - 'Projects and worktrees'
  - 'Settings'
  - 'This computer'
  - 'Name of this computer'
  - 'Save'
  - 'Open This computer'
  - 'connect it to'
  - 'Back'
tests:
  - apps/web/spec/e2e/access-environment-name.desktop.e2e.ts
api:
  - GET /api/inventory
  - PUT /api/environment/name
---

# access.environment-name

The navigator header names the computer Porcelain runs on.

## How to get to it (user POV)

- Workspace → `Toggle Sidebar` (phone width) → the navigator header shows "Porcelain" and the computer's name.
- Navigator footer `Settings` (or `Alt+Shift+S` on the workspace, focus outside a text field) → `Computers` → `Open This computer` → textbox "Name of this computer" → `Save` (or `Enter` in the field).
- Route: `/settings/computers/this-computer` (host-authorized browser or desktop).

## Driving it with browser

Preconditions: [surface baseline](README.md).

It shows the host name until the owner saves a name in Settings → Computers → This computer. The header, the tab title and the pairing instructions then show that name, and saving an empty name goes back to the host name.

Required instance mode: `--desktop`.

### Setup

`HOST=$(hostname)`: the server reads the machine's own host name (the sandbox does not change it). That is the name shown until one is saved. The project is named `repository`.

1. Click button `Toggle Sidebar`
   Expect: navigation "Projects and worktrees" whose header shows "Porcelain" and the text `$HOST`.
2. Click button `Settings`
   Expect: URL ends `/settings/general`; title "Settings".
3. Click button `Computers`, then button named `Open This computer`
   Expect: URL ends `/settings/computers/this-computer`; textbox "Name of this computer" empty (its placeholder is `$HOST`); button "Save" disabled.
4. Fill textbox `Name of this computer` with 'Workstation'
   Expect: button "Save" enabled.
5. Click button `Save`
   Expect: title "Settings · Workstation"; the Settings header under "Porcelain" shows "Workstation"; button "Save" disabled again.
   Proof before continuing: reload `/settings/computers/this-computer` now: Workstation and Settings · Workstation persist. Inventory returns `{ name, custom }`; each name PUT answers 200. Then inspect Pair a device on this detail.

6. Stay on This computer and scroll to Pair a device
   Expect: the text "Open the link or scan the code on the other device to connect it to Workstation. Each link works once, for a few minutes."
7. Click button `Computers`, then button named `Open This computer`
   Expect: textbox "Name of this computer" holds "Workstation"; button "Save" disabled.
8. Click button `Back` twice
   Expect: URL `/<projectId>/<worktreeId>`; title "Changes — repository · Workstation".
9. Click button `Toggle Sidebar`
   Expect: navigation "Projects and worktrees" header shows "Workstation" (no longer `$HOST`).
10. Click button `Settings`
    Expect: URL ends `/settings/general`; title "Settings · Workstation".
11. Click button `Computers`, then button named `Open This computer`
    Expect: textbox "Name of this computer" holds "Workstation".
12. Fill textbox `Name of this computer` with ''
    Expect: textbox empty; button "Save" enabled.
13. Click button `Save`
    Expect: title "Settings"; the Settings header shows `$HOST` again.
14. Click button `Back` twice
    Expect: title "Changes — repository".

Automated coverage: `access-environment-name.desktop.e2e.ts`.

## Gotchas

- Rename/Ways in require host authorization, in either shell. Saved name changes other maps’ title expectations; reset it or restart.
- Direct Settings Back falls back to `/`; in-app entry returns to its predecessor. To empty the field use ControlOrMeta+A then Backspace if fill does not clear it.
- Do not start the update shown on This computer in this naming journey.
