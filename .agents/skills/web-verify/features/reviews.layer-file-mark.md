---
route: /
selectors:
  - "Review"
tests:
  - apps/web/spec/integration/reviews-layer-file-mark.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.layer-file-mark

## What it is

A file inside a published layer is marked and unmarked reviewed on its own, and the server keeps each change like any changed file.

## How a user reaches it

- Review → published layer → file → Mark as reviewed

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A file inside a published layer is marked and unmarked reviewed on its own, like any changed file

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, publish a review titled “Readme layer” through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "/Readme layer/"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-layer-file-mark.test.tsx` (Browser Mode integration): a file inside a published layer is marked and unmarked reviewed on its own, like any changed file.
- The tests read back what the server kept through the kit: `server.reviewedFiles()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
