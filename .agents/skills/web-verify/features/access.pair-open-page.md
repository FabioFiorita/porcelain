---
route: /pair
selectors:
  - 'This browser is not paired'
  - 'Review content'
tests:
  - apps/web/spec/e2e/access-pair-open-page.e2e.ts
api:
  - GET /api/health
  - GET /api/inventory
  - POST /api/pair
---

# access.pair-open-page

A one-time link entered in a tab that already shows the not-paired page (`/pair`) pairs the browser without a reload of its own and opens the workspace, leaving no code in the address.

## How to get to it (user POV)

- The not-paired page is open at `/pair` → paste or follow the one-time link (`/pair#c=<code>&e=<installation id>`) in the same tab. Only the fragment changes, so the page's `hashchange` listener re-runs the pairing loader.
- The link comes from `porcelain pair` on the host, or from Settings → Computers → This computer → Pair a device → "Create pairing link" in the desktop app.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Start unpaired at `/pair`, then mint a fresh link with `$C pairing-link` and open it in that same tab. Do not apply the paired baseline.

1. Navigate to `/`
   Expect: redirected to URL `/pair`; heading "This browser is not paired"; the command text `porcelain pair "This browser" --address http://127.0.0.1:<port>`.
2. Run `$C pairing-link` and navigate this same tab to its fresh one-time link (the tab is already on `/pair`, so only the fragment changes), then wait for region named `Review content`
   Expect: region "Review content" in the same tab within a few seconds.
3. Click button `Review`
   Expect: URL `/<projectId>/<worktreeId>?entry=handoff` with no `#` fragment; title "Changes — repository".
4. Inspect HTTP traffic
   Expect: `GET /api/health` 200, `POST /api/pair` 200, `GET /api/inventory` 200. `$C server devices` lists "Verification browser".

### Observable proof

Reload `/`: workspace remains, no pairing fragment. `$C server devices` contains Verification browser.

Automated coverage: `access-pair-open-page.e2e.ts`.

## Gotchas

- Start at `/pair` unpaired for same-tab entry; another starting route performs a full load. A paired browser opening `/pair` redirects to its workspace.
- Settings → Computers → This computer → Pair a device → Create pairing link is another source for the same one-time link.
