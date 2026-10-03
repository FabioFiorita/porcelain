---
route: /pair
selectors:
  - "Review content"
  - "Pairing this browser"
  - "This pairing link is not usable. Ask for a new one."
tests:
  - apps/web/spec/e2e/access-pairing.e2e.ts
api:
  - GET /api/health
  - GET /api/inventory
  - POST /api/pair
---

# access.pairing

## What it is

Opening a one-time pairing link checks the server's health, redeems the code as a new device, opens the connected workspace, and leaves no code in the address bar. A browser that is already paired and opens `/pair` without a link goes to its workspace instead of being told it is not paired.

## How a user reaches it

- Open the link `porcelain pair "<label>"` prints: `<address>/pair#c=<code>&e=<installation id>` (a full page load).
- The not-paired page shows the `porcelain pair "This browser" --address <origin>` command to get one.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start --unpaired`: the browser starts on the not-paired page. `pair` then issues a one-time link for "Verification browser" through the owner socket and opens it in this tab, as a person opens the link `porcelain pair` prints; neither prints the code.

### Setup

None.

1. `$C open /`
   Look for: Page URL `/pair` and heading "This browser is not paired".
2. `$C pair`, then `$C wait --role region --name "Review content"`
   Look for: the `pair` output names `/pair#c=[redacted]&e=<environmentId>`; the workspace shows within a few seconds.
3. `$C click --role button --name "Review"`
   Look for: Page URL `/<projectId>/<worktreeId>?entry=handoff` with no `#c=` fragment, Page Title "Changes — repository".
4. `$C network` (before any `open`)
   Look for: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200. `$C server devices` lists "Verification browser" beside "Development setup".
5. `$C open /`
   Look for: the workspace again (region "Review content"), not `/pair`: the pairing left a working session.
6. `$C open /pair`, then `$C snapshot`
   Look for: region "Review content" and no heading "This browser is not paired": the paired browser is sent from `/pair` to its workspace (the CLI may still print Page URL `/pair` for the `open`; the `snapshot` prints the settled page).

## What proves it works

- The workspace opened from a link, the address carrying no `#c=` fragment, and a reload staying in the workspace.
- Server side, `$C server devices` lists "Verification browser".
- `apps/web/spec/e2e/access-pairing.e2e.ts`: after opening a link, region "Review content" shows, the address fragment is empty, and `server.devices()` contains the link's label; a paired browser that opens `/pair` sees region "Review content", no not-paired heading, and leaves `/pair`.

## Gotchas

- A plain `start` pairs the browser through this same flow before the first command; `--unpaired` leaves it to `pair` so each step can be watched. Each `pair` issues a fresh link; a used code cannot be replayed (the page would show "This pairing link is not usable. Ask for a new one.").
- Neither `start` nor `pair` prints the code; their evidence shows `c=[redacted]`.
- `$C network` may no longer include the pairing requests after an `open`; read it first.
