---
route: /pair
selectors:
  - "Review content"
tests:
  - apps/web/spec/e2e/access-pairing.e2e.ts
api:
  - GET /api/health
  - GET /api/inventory
  - POST /api/pair
---

# access.pairing

## What it is

A one-time link pairs the browser as a device, opens the connected workspace and leaves no code in the address bar.

## How a user reaches it

- open the one-time link that porcelain pair prints

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A one-time link pairs the browser and opens the workspace without leaving its code in the address

```sh
.agents/skills/web-verify/scripts/cli open /pair
```

After `open`, look for: the region “Review content” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-pairing.e2e.ts` (Playwright e2e): a one-time link pairs the browser and opens the workspace without leaving its code in the address.
- The tests read back what the server kept through the kit: `server.devices()`.

## Gotchas

- None known.
