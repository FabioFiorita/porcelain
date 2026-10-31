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
  - 'Icon: '
  - 'Laptop'
  - 'Desktop'
  - 'Open This computer:'
  - 'Close Settings'
tests:
  - apps/web/spec/e2e/access-environment-name.desktop.e2e.ts
api:
  - GET /api/inventory
  - PUT /api/environment/name
  - PUT /api/environment/icon
---

# access.environment-name

Settings names the computer Porcelain runs on and picks its icon (desktop, laptop, server or cloud; desktop until one is picked). Project controls keep that identity accessible; badges show the icon and name when multiple computers are connected, and only the icon, with the name in a tooltip, when the project or computer name would be cut off. The application header stays Porcelain.

## How to get to it (user POV)

- Workspace → `Toggle Sidebar` (phone width) → the application header shows "Porcelain" and project controls name their computer; badges appear only with multiple connected computers.
- Navigator footer `Settings` (or `Alt+Shift+S` on the workspace, focus outside a text field) → `Computers` → `Open This computer: <name>` → `Rename` beside the title → textbox "Name of this computer" → `Save` (or `Enter` in the field); `Cancel` or `Escape` closes the field.
- Same page → `Icon: <icon>` beside `Rename` → menu "Icon of this computer" → `Desktop`, `Laptop`, `Server` or `Cloud`; the choice saves at once. `Desktop` is the default and clears the choice.
- Route: `/settings/computers/this-computer` (host-authorized browser or desktop).
- The sidebar badge needs a second computer: `$C remote start`, then add `$C remote pairing-link` in Settings → `Computers` → `Pairing link` → `Add` (see [projects.remote-workspace](projects.remote-workspace.md)). The remote computer's icon comes from its own inventory: set it with `PUT /api/environment/icon` on the remote server.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Computer details, pairing and project identity use the host name until the owner saves a name in Settings → Computers → This computer. The title, tab title and accessible project identity then show that name, and saving an empty name goes back to the host name. The application header and footer keep their own labels.

Required instance mode: `--desktop`.

### Setup

`HOST=$(hostname)`: the server reads the machine's own host name (the sandbox does not change it). That is the name shown until one is saved. The project is named `repository`.

1. Click button `Toggle Sidebar`
   Expect: navigation "Projects and worktrees" with application header "Porcelain". There is no redundant badge with one connected computer. Project actions and collapse controls include `$HOST` in their full accessible names. With multiple connected computers the static badge has role img `Computer: $HOST`.
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
   Expect: navigation "Projects and worktrees" keeps application header "Porcelain" and updates the project controls to include Workstation in their accessible identity; old host-labelled controls are absent. A single computer still has no badge. With multiple computers, the static badge updates to `Computer: Workstation`, retaining its full accessible name.
10. Click button `Settings`
    Expect: URL ends `/settings/general`; title "Settings · Workstation".
11. Click button `Computers`, then button named `Open This computer: <name>`, then button `Rename`
    Expect: textbox "Name of this computer" holds "Workstation".
12. Fill textbox `Name of this computer` with ''
    Expect: textbox empty; button "Save" enabled.
13. Click button `Save`
    Expect: title "Settings"; the name field closes and the heading shows `$HOST`.
14. Click button `Close Settings` twice
    Expect: title "Changes — repository"; reopening the navigator restores `$HOST` in the project controls, without a single-computer badge.

15. Click button `Settings`, then button `Computers`, then button named `Open This computer: <name>`, then button `Icon: Desktop`
    Expect: menu with label "Icon of this computer" and radio items Desktop (checked), Laptop, Server, Cloud.
16. Click menu item radio `Laptop`
    Expect: the trigger is named `Icon: Laptop` and shows a laptop; inventory `environment` is `{ name: $HOST, custom: false, icon: 'laptop' }`; the PUT answers 200.
17. Click button `Icon: Laptop`, then menu item radio `Desktop`
    Expect: trigger `Icon: Desktop`; inventory `environment` has no `icon`.

Sidebar badge with two computers (after pairing the remote as above, 1280 × 800):

18. Give both short names (`PUT /api/environment/name` `Desk` here, `Lab` on the remote) and the remote icon `server`
    Expect: each project header has a badge with role img `Computer: <name>` that shows its icon and the name.
19. Rename the remote to a name longer than the badge (the remote fixture's `Remote journey computer`), or rename a project to a long name
    Expect: that header's badge shows only the icon, keeps role img `Computer: <full name>`, and hovering or focusing it (Tab) shows the full computer name in a tooltip. Headers whose names fit keep the icon and name.
20. Click button `Filter worktrees`
    Expect: each Environments row shows its computer's icon before the name.

Automated coverage: `access-environment-name.desktop.e2e.ts`.

## Gotchas

- Rename/Ways in require host authorization, in either shell. Saved name changes other maps’ title expectations; reset it or restart.
- Direct Settings Back falls back to `/`; in-app entry returns to its predecessor. To empty the field use ControlOrMeta+A then Backspace if fill does not clear it.
- Do not start the update shown on This computer in this naming journey.
