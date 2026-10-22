---
route: /pair
selectors:
  - "Review content"
  - "Pairing this browser"
  - "This pairing link is not usable. Ask for a new one."
tests:
  - apps/web/spec/e2e/access-pairing.e2e.ts
  - apps/web/spec/e2e/access-pair-open-page.e2e.ts
api:
  - GET /api/health
  - GET /api/session
  - GET /api/inventory
  - POST /api/pair
---

# access.pairing

Opening a one-time pairing link checks the server's health, redeems the code as a new device, opens the connected workspace, and leaves no code in the address bar.

## How to get to it (user POV)

- Open the link `porcelain pair "<label>"` prints: `<address>/pair#c=<code>&e=<installation id>` (a full page load).
- The not-paired page shows the `porcelain pair "This browser" --address <origin>` command to get one.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Start in a fresh unpaired context; mint the first link with `$C pairing-link`. Do not apply the paired baseline.

A browser with a valid session goes to its workspace when it opens `/pair` without a link or reopens an unusable link. An unusable link still cannot pair an unpaired browser.

1. Navigate to `/`
   Expect: URL `/pair` and heading "This browser is not paired".
2. Run `$C pairing-link` and navigate this same tab to its fresh one-time link, then wait for region named `Review content`
   Expect: the local `pairing-link` output names `/pair#c=<one-time code>&e=<environmentId>`; the workspace shows within a few seconds.
3. Click button `Review`
   Expect: URL `/<projectId>/<worktreeId>?entry=handoff` with no `#c=` fragment, title "Changes — repository".
4. Inspect HTTP traffic (before any reload)
   Expect: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200. `$C server devices` lists "Verification browser" beside "Development setup".
5. Navigate to `/`
   Expect: the workspace again (region "Review content"), not `/pair`: the pairing left a working session.
6. Navigate to `/pair`, then inspect the accessibility tree
   Expect: region "Review content" and no heading "This browser is not paired": the paired browser is sent from `/pair` to its workspace (wait for the redirect to settle).
7. Reopen the same used pairing link, then reload and reopen it again
   Expect: the workspace each time, no not-paired heading, no fragment left in the address, and no additional device in `$C server devices`. The rejected `POST /api/pair` is followed by successful session and inventory reads.
8. Open that used link in a fresh browser context
   Expect: "This browser is not paired" and "This pairing link is not usable. Ask for a new one."; no extra device. Reload keeps the browser unpaired. Mint and open a fresh link to return to the workspace.

### Observable proof

Reload: workspace remains without `#c=`; `$C server devices` contains Verification browser.

Automated coverage: `access-pairing.e2e.ts`, `access-pair-open-page.e2e.ts`.

## Gotchas

- Use a separate fresh context for replay refusal; clearing live cookies can race session renewal. A valid existing session may still open the workspace after refusing a used code.
- Inspect pairing requests before navigation clears network history. Sanitize pairing fragments from browser artifacts.
