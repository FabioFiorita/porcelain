---
route: /
selectors:
  - "Review"
  - "Comment"
  - "Waiting for the agent"
  - "Proof"
tests:
  - apps/web/spec/integration/reviews-readiness.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/comments
  - GET /api/worktrees/:worktreeId/reviewed
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.readiness

## What it is

The readiness panel counts reviewed files, marks that went stale, changes the review does not explain, comments waiting on the agent and failing checks, and opens the proof from its checks line.

## How a user reaches it

- Review → Readiness

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The readiness panel follows reviewed and stale files, unexplained lines, waiting comments and failing checks

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository
- write `notes.md` in the sample repository
- as the agent, publish a review with proof titled “Readme layer” through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Why?"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the text “Waiting for the agent” shows; the button “/^Readiness/” reads '5 things to check'; the heading “Proof” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-readiness.test.tsx` (Browser Mode integration): the readiness panel follows reviewed and stale files, unexplained lines, waiting comments and failing checks.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
