---
route: /pair
selectors:
  - "Toggle Sidebar"
  - "Settings"
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

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then make the browser unpaired through Settings (below). A fresh link is needed and the CLI cannot make one: see the first gotcha.

### Setup

- Unpair the browser: `$C open /settings/connection`, then `$C click --role button --name "Disconnect this browser"`. Look for heading "This browser is not paired".
- CLI gap: a fresh one-time link for this instance. Needed command: `cli pair` (issue a link for this server through its owner socket and `goto` it in the current tab without printing the code).

1. `$C open /`
   Look for: redirected to Page URL `/pair`, heading "This browser is not paired" and the command text `porcelain pair "This browser" --address http://127.0.0.1:<port>`.
2. `cli pair` (missing; with the tab still on `/pair`, the CLI's `goto` to `/pair#c=…&e=…` changes only the fragment)
   Look for: briefly "Pairing this browser…", then region "Review content", Page URL `/<projectId>/<worktreeId>` with no `#` fragment, Page Title "Changes — repository".
3. `$C network`
   Look for: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200, with no full document reload between `/pair` and the pairing requests.

## What proves it works

- The workspace (region "Review content") appears in the same tab, and the address keeps no fragment.
- A reload keeps it: `$C open /` lands on the workspace, not `/pair`.
- Server side, `cli server devices` (missing) should list the new device.
- `apps/web/spec/e2e/access-pair-open-page.e2e.ts`: an unpaired tab shows the not-paired heading at `/pair`; following the link in that tab shows "Review content", the fragment is empty, and `server.devices()` contains the link's label.

## Gotchas

- Unreachable through the CLI: no command issues a one-time pairing link, and the web cannot make one (the CLI browser is not the owner; Settings → Devices exists only with `start --desktop` and needs a "way in" turned on). Needed: `cli pair`.
- Unpairing is one-way in an instance: after this setup nothing else can be driven until the browser is paired again. Use a dedicated instance, or `$C stop` and `$C start`.
- `/pair` shows "This browser is not paired" even in a paired browser; disconnect first so the page really is the unpaired state.
- The same-tab path depends on the tab already being at `/pair`; opening the link from any other path is a full load, which is `access.pairing`.
