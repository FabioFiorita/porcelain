---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Could not display the workspace."
  - "This browser is not paired"
  - "Review content"
tests:
  - apps/web/spec/e2e/access-restore-outage.e2e.ts
api:
  - DELETE /api/session
  - GET /api/inventory
---

# access.restore-outage

## What it is

A reload whose session restore fails for a reason other than an unpaired browser keeps the workspace address, shows the retrying workspace error and opens the workspace once the connection returns.

## How a user reaches it

- reload a workspace address while the server cannot answer

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A reload while the server cannot answer keeps the address and shows the workspace again when the connection returns

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the tab “Files” shows; the text “Could not display the workspace.” shows; the heading “This browser is not paired” is gone; the region “Review content” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the tab “Files” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-restore-outage.e2e.ts` (Playwright e2e): a reload while the server cannot answer keeps the address and shows the workspace again when the connection returns.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
- The tests hold or drop the live connection or a request to reach a race; the CLI cannot, so an agent drives the ordinary path and leaves the race to the tests.
- The tests declare the console error this flow logs on purpose; `console` shows it too and it is expected.
