---
route: /pair
selectors:
  - "This browser is not paired"
  - "Review content"
tests:
  - apps/web/spec/e2e/access-pair-open-page.e2e.ts
api:
  - GET /api/inventory
  - POST /api/pair
---

# access.pair-open-page

## What it is

A one-time link entered in a tab already showing the not-paired page pairs the browser and opens the workspace.

## How a user reaches it

- the not-paired page already open → enter the one-time link in the same tab

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A link entered in a tab already showing the not-paired page pairs the browser

```sh
.agents/skills/web-verify/scripts/cli open /pair
```

After `open`, look for: the heading “This browser is not paired” shows.
After `open`, look for: the region “Review content” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-pair-open-page.e2e.ts` (Playwright e2e): a link entered in a tab already showing the not-paired page pairs the browser.
- The tests read back what the server kept through the kit: `server.devices()`.

## Gotchas

- None known.
