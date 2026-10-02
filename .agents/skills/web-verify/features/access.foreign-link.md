---
route: /pair
selectors:
  - "This browser is not paired"
tests:
  - apps/web/spec/e2e/access-foreign-link.e2e.ts
api:
  - GET /api/health
---

# access.foreign-link

## What it is

A pairing link made for another installation is refused after checking the real server health, and no device is paired.

## How a user reaches it

- open a pairing link made for another Porcelain installation

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A link made for another installation is refused and pairs no device

```sh
.agents/skills/web-verify/scripts/cli open /pair
```

After `open`, look for: the heading “This browser is not paired” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-foreign-link.e2e.ts` (Playwright e2e): a link made for another installation is refused and pairs no device.
- The tests read back what the server kept through the kit: `server.devices()`.

## Gotchas

- None known.
