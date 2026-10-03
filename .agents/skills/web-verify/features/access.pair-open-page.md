---
route: /pair
selectors:
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Device name"
  - "Create pairing link"
  - "Connection"
  - "Disconnect this browser"
  - "This browser is not paired"
  - "Review content"
tests:
  - apps/web/spec/e2e/access-pair-open-page.e2e.ts
api:
  - GET /api/health
  - GET /api/inventory
  - POST /api/pair
---

# access.pair-open-page

## What it is

A one-time link entered in a tab that already shows the not-paired page (`/pair`) pairs the browser without a reload of its own and opens the workspace, leaving no code in the address.

## How a user reaches it

- The not-paired page is open at `/pair` → paste or follow the one-time link (`/pair#c=<code>&e=<installation id>`) in the same tab. Only the fragment changes, so the page's `hashchange` listener re-runs the pairing loader.
- The link comes from `porcelain pair` on the host, or from Settings → Devices → "Create pairing link" in the desktop app.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start --desktop`. The feature is not desktop-only, but only the desktop Settings can mint a one-time link through the CLI's browser: Devices shows the link as text, which the steps copy.

### Setup: mint a link, then unpair the browser

1. `$C open /settings/ways-in`, then `$C click --role switch --name "Local network"`
   Look for: switch "Local network" checked and the text `http://192.168.1.20:<port>` (Devices offers the form only while a way in is on).
2. `$C click --role button --name "Devices"`, `$C fill --role textbox --name "Device name" "Open page tab"`, `$C click --role button --name "Create pairing link"`
   Look for: img "Pairing QR code"; text "Scan on Open page tab"; a paragraph holding the link `http://192.168.1.20:<port>/pair#c=pcp_…&e=…`. Copy everything from `/pair#` to the end; call it `$LINK`. Listitem "Open page tab" reads "Pending link".
3. `$C click --role button --name "Connection"`, then `$C click --role button --name "Disconnect this browser"`
   Look for: Page URL `/pair`; heading "This browser is not paired".

### Steps

1. `$C open /`
   Look for: redirected to Page URL `/pair`; heading "This browser is not paired"; the command text `porcelain pair "This browser" --address http://127.0.0.1:<port>`.
2. `$C open "$LINK"` (the tab is already on `/pair`, so only the fragment changes)
   Look for: region "Review content" with heading "Changes" in the same tab (the CLI may still print Page URL `/pair` for this command).
3. `$C click --role button --name "Review"`
   Look for: Page URL `/<projectId>/<worktreeId>` with no `#` fragment; Page Title "Changes — repository".
4. `$C network`
   Look for: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200.

## What proves it works

- The workspace (region "Review content") appears in the same tab and the address keeps no fragment (step 3).
- A reload keeps it: `$C open /` lands on the workspace, not `/pair`.
- Server side: `$C open /settings/devices` lists listitem "Open page tab" with the badge "This browser" (no longer "Pending link").
- `apps/web/spec/e2e/access-pair-open-page.e2e.ts`: an unpaired tab shows the not-paired heading at `/pair`; following the link in that tab shows "Review content", the fragment is empty, and `server.devices()` contains the link's label.

## Gotchas

- Web mode (`$C start`) cannot mint a link: Settings → Devices exists only with `--desktop`, and `POST /api/pairings` is an owner route. A command that issues a link in either mode would be `cli pair`.
- The link works once and expires after a few minutes ("Works once, until <time>"); mint it right before the steps.
- Unpairing is one-way: if the link was lost, nothing else can be driven in that instance; `$C stop` and `$C start --desktop`.
- `/pair` shows "This browser is not paired" even in a paired browser; disconnect first so the page really is the unpaired state.
- The same-tab path depends on the tab already being at `/pair`; opening the link from any other path is a full load, which is `access.pairing`.
