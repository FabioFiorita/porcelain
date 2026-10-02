---
route: /
selectors:
  - "Review"
  - "Comment on the whole change"
  - "Comment"
  - "Resolve"
  - "Delete resolved"
  - "Delete"
  - "Close"
tests:
  - apps/web/spec/integration/reviews-delete-resolved-race.test.tsx
api:
  - POST /api/worktrees/:worktreeId/comments/resolved/deletion
---

# reviews.delete-resolved-race

## What it is

A resolved thread the agent answers after the reviewer opened the confirmation is not deleted, and the dialog says it was kept because it changed.

## How a user reaches it

- Review → Comments → Resolved → Delete resolved, while the agent replies

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A resolved thread the agent answers while the reviewer confirms the deletion is kept and the dialog says so

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, reply to the thread through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on the whole change"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Split this into two commits"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Resolve"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "/^resolved/i"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Delete resolved"`
   Look for: the text “Delete 1 resolved thread?” shows.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Delete"`
   Look for: the text “Kept 1 thread that changed” shows.
10. `.agents/skills/web-verify/scripts/cli click --role button --name "Close"`
   Look for: the alertdialog is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-delete-resolved-race.test.tsx` (Browser Mode integration): a resolved thread the agent answers while the reviewer confirms the deletion is kept and the dialog says so.
- The tests read back what the server kept through the kit: `server.commentThreads()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
