---
route: /
selectors:
  - 'This browser is not paired'
  - 'porcelain pair'
  - 'Computers'
  - 'Open This computer:'
  - 'Disconnect this browser'
tests:
  - apps/web/spec/e2e/app-routing.e2e.ts
api:
  - GET /api/inventory
---

# app.shell

A browser with no session asks the real server for its inventory, gets 401, is sent to `/pair`, and sees the instructions to pair it instead of the workspace.

## How to get to it (user POV)

- Open Porcelain (`/` or any workspace or settings address) in a browser that was never paired, or whose session ended.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Start in a fresh unpaired context without minting a pairing link. Do not apply the paired baseline.

1. Navigate to `/`
   Expect: URL `/pair`; heading "Porcelain" (level 1); heading "This browser is not paired"; the text "Pair it from your computer." and a three-step route named "How pairing works"; code `porcelain pair "This browser" --address http://127.0.0.1:<port>` naming the web origin the CLI started; no region "Review content". `$C server devices` lists only the server's own "Development setup".
2. Navigate to `/settings/general`
   Expect: also redirected to `/pair` with the same heading: every paired route is guarded.
3. Inspect HTTP traffic
   Expect: `GET /api/inventory` answered 401 for each load.

Automated coverage: `app-routing.e2e.ts`.

## Gotchas

- Run `$C pairing-link` and navigate this same tab to the link to pair the browser afterwards through a fresh one-time link (`access.pairing`), so the same instance can go on to other features. Disconnecting a paired browser from Settings → Computers → This computer reaches the same page by another path (`access.disconnect`).
- `/pair` shows the not-paired page only when the browser has no session; a paired browser that opens it is sent to its workspace.
