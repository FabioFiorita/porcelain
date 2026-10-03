---
route: /pair
selectors:
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

`C=.agents/skills/web-verify/scripts/cli; $C start --unpaired`: the tab starts on the not-paired page. `pair` issues a one-time link for "Verification browser" and opens it in this tab, as following the link `porcelain pair` prints does.

### Setup

None.

### Steps

1. `$C open /`
   Look for: redirected to Page URL `/pair`; heading "This browser is not paired"; the command text `porcelain pair "This browser" --address http://127.0.0.1:<port>`.
2. `$C pair` (the tab is already on `/pair`, so only the fragment changes), then `$C wait --role region --name "Review content"`
   Look for: region "Review content" in the same tab within a few seconds (the CLI may still print Page URL `/pair` for `pair`).
3. `$C click --role button --name "Review"`
   Look for: Page URL `/<projectId>/<worktreeId>?entry=handoff` with no `#` fragment; Page Title "Changes — repository".
4. `$C network`
   Look for: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200. `$C server devices` lists "Verification browser".

## What proves it works

- The workspace (region "Review content") appears in the same tab and the address keeps no fragment (step 3).
- A reload keeps it: `$C open /` lands on the workspace, not `/pair`.
- Server side: `$C server devices` lists the link's label, "Verification browser".
- `apps/web/spec/e2e/access-pair-open-page.e2e.ts`: an unpaired tab shows the not-paired heading at `/pair`; following the link in that tab shows "Review content", the fragment is empty, and `server.devices()` contains the link's label.

## Gotchas

- In the desktop app the link also comes from Settings → Devices → "Create pairing link" (`access.share`); `pair` issues the same kind of one-time link through the owner socket in either mode.
- A paired browser that opens `/pair` is sent to its workspace (access.pairing), so the steps start unpaired to reach the not-paired page.
- The same-tab path depends on the tab already being at `/pair`; opening the link from any other path is a full load, which is `access.pairing`.
