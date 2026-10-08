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

`$C start`; open the web URL in a fresh unpaired browser context: the browser starts on the not-paired page. `$C pairing-link` then mints a one-time link for "Verification browser" through the owner socket which you open in this tab, as a person opens the link `porcelain pair` prints; the link command prints its code locally, while its recorded evidence redacts it.

### Setup

None.

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page URL `/pair` and heading "This browser is not paired".
2. Run `$C pairing-link` and navigate this same tab to its fresh one-time link, then wait for region named `Review content` to be visible
   Look for: the local `pairing-link` output names `/pair#c=<one-time code>&e=<environmentId>`; the workspace shows within a few seconds.
3. Click button named `Review`
   Look for: Page URL `/<projectId>/<worktreeId>?entry=handoff` with no `#c=` fragment, Page Title "Changes — repository".
4. Inspect HTTP requests and responses (before any a full page load)
   Look for: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200. `$C server devices` lists "Verification browser" beside "Development setup".
5. Navigate to `/` on the card’s web URL (full page load)
   Look for: the workspace again (region "Review content"), not `/pair`: the pairing left a working session.
6. Navigate to `/pair` on the card’s web URL (full page load), then inspect the accessibility tree
   Look for: region "Review content" and no heading "This browser is not paired": the paired browser is sent from `/pair` to its workspace (wait for the redirect to settle).

## What proves it works

- The workspace opened from a link, the address carrying no `#c=` fragment, and a reload staying in the workspace.
- Server side, `$C server devices` lists "Verification browser".
- `apps/web/spec/e2e/access-pairing.e2e.ts`: after opening a link, region "Review content" shows, the address fragment is empty, and `server.devices()` contains the link's label; a paired browser that opens `/pair` sees region "Review content", no not-paired heading, and leaves `/pair`.

## Gotchas

- Startup never pairs a browser. Open the card’s web URL in a fresh context to watch the unpaired state, then redeem a link from `$C pairing-link`. Each invocation issues a fresh link; a used code cannot be replayed (the page would show "This pairing link is not usable. Ask for a new one.").
- `start` prints no code; `pairing-link` prints the one-time code locally and redacts it in recorded evidence. Sanitize browser artifacts before sharing them.
- Inspect HTTP requests and responses may no longer include the pairing requests after an a full page load; read it first.
