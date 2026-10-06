# access.pairing

## What it is

Opening a one-time pairing link checks the server's health, redeems the code as a new device, opens the connected workspace, and leaves no code in the address bar. A browser that is already paired and opens `/pair` without a link goes to its workspace instead of being told it is not paired.

## How a user reaches it

- Open the link `porcelain pair "<label>"` prints: `<address>/pair#c=<code>&e=<installation id>` (a full page load).
- The not-paired page shows the `porcelain pair "This browser" --address <origin>` command to get one.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` launches the disposable server without a browser. Open the printed web root in a fresh in-app tab before using any attachment. `$C pair` issues a fresh one-time link for "Verification browser" through the owner socket and returns safe attachment details; open that attachment page and follow "Open workspace" with the skill’s in-app workflow.

### Setup

None.

1. Open `/` on the instance web URL
   Look for: Page URL `/pair` and heading "This browser is not paired".
2. Run `$C pair`, open the fresh attachment page it returns and follow "Open workspace", then wait for the region named 'Review content'
   Look for: the attachment opens the pairing flow; the workspace shows within a few seconds and no pairing code remains in the address.
3. Click the button named 'Review'
   Look for: Page URL `/<projectId>/<worktreeId>?entry=handoff` with no `#c=` fragment, Page Title "Changes — repository".
4. Inspect browser network evidence (before any page load)
   Look for: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200. `$C server devices` lists "Verification browser" beside "Development setup".
5. Open `/` on the instance web URL
   Look for: the workspace again (region "Review content"), not `/pair`: the pairing left a working session.
6. Open `/pair` on the instance web URL, then inspect the current page
   Look for: region "Review content" and no heading "This browser is not paired": the paired browser leaves `/pair` for its workspace after navigation settles.

## What proves it works

- The workspace opened from a link, the address carrying no `#c=` fragment, and a reload staying in the workspace.
- Server side, `$C server devices` lists "Verification browser".
- `apps/web/spec/e2e/access-pairing.e2e.ts`: after opening a link, region "Review content" shows, the address fragment is empty, and `server.devices()` contains the link's label; a paired browser that opens `/pair` sees region "Review content", no not-paired heading, and leaves `/pair`.

## Gotchas

- Start is browser-free. Keep the fresh tab unpaired until step 2 so the whole flow is observable. Each `$C pair` issues a fresh link; a used code cannot be replayed (the page would show "This pairing link is not usable. Ask for a new one.").
- Neither `start` nor `pair` prints the code. Use the returned attachment details and keep the private connection artifact local.
- Retain the pairing requests before the next page load if the in-app browser clears request history on navigation.
