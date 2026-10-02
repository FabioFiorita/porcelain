---
route: /
selectors:
  - "Review"
  - "Resolve"
  - "No open comments yet."
  - "Reopen"
  - "Nothing resolved yet."
tests:
  - apps/web/spec/integration/reviews-resolve.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.resolve

## What it is

Resolving a comment thread moves it from the open comments to the resolved ones and the server keeps it resolved, and reopening it moves it back.

## How a user reaches it

- Review → Comments → thread → Resolve, then Resolved → Reopen

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Resolving a comment moves it from open to resolved, and reopening it brings it back

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, comment on `README.md` through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: the text “Is this line still needed?” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Resolve"`
   Look for: the text “No open comments yet.” shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "/^resolved/i"`
   Look for: the text “Is this line still needed?” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Reopen"`
   Look for: the text “Nothing resolved yet.” shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "/^open/i"`
   Look for: the text “Is this line still needed?” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-resolve.test.tsx` (Browser Mode integration): resolving a comment moves it from open to resolved, and reopening it brings it back.
- The tests read back what the server kept through the kit: `server.commentThreads()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
