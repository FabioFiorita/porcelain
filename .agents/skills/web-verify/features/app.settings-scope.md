---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Settings sections"
  - "This computer"
  - "Name of this computer"
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Paired devices"
  - "Remote computers"
  - "No remote computers yet"
  - "Sharing"
tests:
  - apps/web/spec/e2e/app-settings-scope.desktop.e2e.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# app.settings-scope

## What it is

In the desktop app, Settings splits sharing into four sections, each its own page: This computer (its name and updates), Ways in (Local network, Tailscale, Cloudflare tunnel), Devices (pair a device, paired devices) and Remote computers (add one, the saved list). There is no single "Sharing" section.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first) → `Settings` → the section buttons `This computer`, `Ways in`, `Devices`, `Remote computers` in navigation "Settings sections".
- `Alt+Shift+S` opens Settings on Appearance (ignored while focus is in a text field); then the section button.
- Routes `/settings/computer`, `/settings/ways-in`, `/settings/devices`, `/settings/remotes` (desktop mode only; in web mode they redirect to `/settings/appearance`).
- "Open Remote computers" (desktop navigator row of an unreachable remote computer) opens `/settings/remotes`.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start --desktop`. Desktop mode is required: `$C start` (web mode) does not render these sections.

### Setup

None.

### Steps

1. `$C open /`
   Look for: Page Title "Changes — repository"; button "Toggle Sidebar".
2. `$C click --role button --name "Toggle Sidebar"`, then `$C click --role button --name "Settings"`
   Look for: Page URL `/settings/appearance`; main "Settings"; navigation "Settings sections" with buttons Appearance, Git and agents, This computer, Ways in, Devices, Remote computers, Connection; no button "Sharing" and no button "Updates".
3. `$C click --role button --name "This computer"`
   Look for: Page URL `/settings/computer`; heading "This computer"; textbox "Name of this computer"; legend text "Updates".
4. `$C click --role button --name "Ways in"`
   Look for: Page URL `/settings/ways-in`; heading "Ways in"; switches "Local network", "Tailscale" and "Cloudflare tunnel"; textbox "Name of this computer" is gone.
5. `$C click --role button --name "Devices"`
   Look for: Page URL `/settings/devices`; switch "Local network" is gone; text "Pair a device" and "Paired devices"; listitem "Verification browser" with the badge "This browser".
6. `$C click --role button --name "Remote computers"`
   Look for: Page URL `/settings/remotes`; text "Add a remote computer"; text "No remote computers yet".
7. `$C network`
   Look for: `GET /api/remote-access` with status 200 (sent when Ways in or Devices opened).

## What proves it works

- Each of the four sections has its own URL and content, and content of one (switch "Local network", textbox "Name of this computer") is absent from the others.
- `$C open /settings/ways-in` (a fresh page load) lands directly on heading "Ways in": the section is in the URL, not in page state.
- `apps/web/spec/e2e/app-settings-scope.desktop.e2e.ts` (desktop project, 414x896): Ways in shows heading "Ways in" and switch "Local network"; Devices removes that switch and shows "Paired devices"; Remote computers shows "No remote computers yet". It does not click This computer (`app.settings-page` covers it).

## Gotchas

- Do not toggle the switches on Ways in while checking this feature: they send `PATCH /api/remote-access` and change server state other features read (`access.remote-access` covers them).
- If Ways in or Devices shows "Sharing is managed from a browser on the computer that runs Porcelain." instead of the switches, the server answered `GET /api/remote-access` with null for this browser; that is the non-local-browser case, not this feature.
- Remote computers starts empty in a fresh instance; a remote computer added by another feature in the same instance replaces "No remote computers yet" with a list "Remote computers".
- Phone width: `Toggle Sidebar` must be clicked before `Settings`; the section buttons are a horizontal row that the click scrolls into view.
