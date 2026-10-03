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

`C=.agents/skills/web-verify/scripts/cli; $C start`. `start` itself pairs the browser through exactly this flow (it issues a link for "Verification browser" and opens it), so the first commands after `start` read its result.

### Setup

None. Pairing a second time needs a fresh link: in a `start --desktop` instance, Settings → Ways in → "Local network" on, then Devices → "Device name" → "Create pairing link" prints it as text; `$C open "/pair#c=…&e=…"` with it pairs this browser again (see access.pair-open-page and access.device-trust). A command that issues one in either mode would be `cli pair`.

1. `$C click --role button --name "Review"`, then `$C press Escape` (only to make the CLI print the page the pairing ended on; `press` prints the page only when it changed, and right after `start` it can still print `/` and "Porcelain")
   Look for: Page URL `/<projectId>/<worktreeId>?entry=handoff` with no `#c=` fragment, Page Title "Changes — repository".
2. `$C snapshot`
   Look for: region "Review content" containing heading "Changes" and button "Mark README.md as reviewed".
3. `$C network` (before any `open`)
   Look for: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200.
4. `$C open /`
   Look for: the workspace again (region "Review content"), not `/pair`: the pairing left a working session.
5. `$C open /pair`, then `$C snapshot`
   Look for: region "Review content" and no heading "This browser is not paired": the paired browser is sent from `/pair` to its workspace (the CLI may still print Page URL `/pair` for the `open`; the `snapshot` prints the settled page).

## What proves it works

- The workspace opened from a link, the address carrying no `#c=` fragment, and a reload staying in the workspace.
- Server side, `cli server devices` (missing) should list "Verification browser".
- `apps/web/spec/e2e/access-pairing.e2e.ts`: after opening a link, region "Review content" shows, the address fragment is empty, and `server.devices()` contains the link's label; a paired browser that opens `/pair` sees region "Review content", no not-paired heading, and leaves `/pair`.

## Gotchas

- In web mode only the pairing `start` performs can be observed; repeating it needs a desktop instance's link (above) or `cli pair`. A used code cannot be replayed (the page would show "This pairing link is not usable. Ask for a new one.").
- `start` never prints the code or link; the evidence file `000-start.txt` only says the browser was paired.
- `$C network` may no longer include the pairing requests after an `open`; read it first.
