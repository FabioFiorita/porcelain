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
  - "Git and agents"
  - "Appearance"
tests:
  - apps/web/spec/e2e/app-settings-scope.desktop.e2e.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# app.settings-scope

## What it is

In the desktop app, Settings opens on This computer and lists, in order, This computer (its name and update), Ways in (Local network, Tailscale, Cloudflare tunnel), Remote computers (add one, the saved list, each with its own update), Devices (pair a device, paired devices), Git and agents and Appearance, each its own page. The app is not a browser, so there is no Connection ("This browser") section.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first) → `Settings` → the section buttons in navigation "Settings sections".
- `Alt+Shift+S` opens Settings on This computer (ignored while focus is in a text field); then the section button.
- Routes `/settings/computer`, `/settings/ways-in`, `/settings/remotes`, `/settings/devices` (desktop mode only; in web mode they show an in-app not-found with Back to workspace).
- "Open Remote computers" (desktop navigator row of an unreachable remote computer) opens `/settings/remotes`.

## Driving it

`$C start --desktop`; pair your browser using the card’s pairing-link command. Desktop mode is required: `$C start`; pair your browser using the card’s pairing-link command (web mode) does not render these sections.

### Setup

None.

### Steps

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository"; button "Toggle Sidebar".
2. Click button named `Toggle Sidebar`, then click button named `Settings`
   Look for: Page URL `/settings/computer`; main "Settings"; navigation "Settings sections" holding exactly the buttons This computer, Ways in, Remote computers, Devices, Git and agents, Appearance and Back; no button "Connection" or "Updates"; heading "This computer"; textbox "Name of this computer"; legend text "Updates".
3. Click button named `This computer`
   Look for: Page URL stays `/settings/computer`.
4. Click button named `Ways in`
   Look for: Page URL `/settings/ways-in`; heading "Ways in"; switches "Local network", "Tailscale" and "Cloudflare tunnel"; textbox "Name of this computer" is gone.
5. Click button named `Devices`
   Look for: Page URL `/settings/devices`; switch "Local network" is gone; text "Pair a device" and "Paired devices"; listitem "Verification browser" with the badge "This browser".
6. Click button named `Remote computers`
   Look for: Page URL `/settings/remotes`; text "Add a remote computer"; text "No remote computers yet".
7. Inspect HTTP requests and responses
   Look for: `GET /api/remote-access` with status 200 (sent when Ways in or Devices opened).

## What proves it works

- Each of the four sections has its own URL and content, and content of one (switch "Local network", textbox "Name of this computer") is absent from the others.
- Navigate to `/settings/ways-in` on the card’s web URL (full page load) (a fresh page load) lands directly on heading "Ways in": the section is in the URL, not in page state.
- `apps/web/spec/e2e/app-settings-scope.desktop.e2e.ts` (desktop project, 414x896): the section buttons read exactly This computer, Ways in, Remote computers, Devices, Git and agents, Appearance, Back, and Settings opens on heading "This computer"; Ways in shows heading "Ways in" and switch "Local network"; Devices removes that switch and shows "Paired devices"; Remote computers shows "No remote computers yet".

## Gotchas

- Do not toggle the switches on Ways in while checking this feature: they send `PATCH /api/remote-access` and change server state other features read (`access.remote-access` covers them).
- If Ways in or Devices shows "Sharing is managed from a browser on the computer that runs Porcelain." instead of the switches, the server answered `GET /api/remote-access` with null for this browser; that is the non-local-browser case, not this feature.
- Remote computers starts empty in a fresh instance; a remote computer added by another feature in the same instance replaces "No remote computers yet" with a list "Remote computers".
- Phone width: `Toggle Sidebar` must be clicked before `Settings`; the section buttons are a horizontal row that the click scrolls into view.
