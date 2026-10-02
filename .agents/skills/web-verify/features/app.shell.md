---
route: /
selectors:
  - "This browser is not paired"
tests:
  - apps/web/spec/e2e/app-shell.e2e.ts
api:
  - DELETE /api/session
  - GET /api/inventory
---

# app.shell

## What it is

A browser that was never paired finds no session on the real server and sees the instructions to pair it.

## How a user reaches it

- open Porcelain in a browser that was never paired

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A browser that was never paired sees how to pair it

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the heading “This browser is not paired” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/app-shell.e2e.ts` (Playwright e2e): a browser that was never paired sees how to pair it.

## Gotchas

- None known.
