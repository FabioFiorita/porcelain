---
route: /
selectors:
  - "Review content"
tests:
  - apps/web/spec/integration/reviews-delete-resolved.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - POST /api/worktrees/:worktreeId/comments/resolved/deletion
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.delete-resolved

## What it is

After confirming, the reviewer deletes every resolved thread they started, for them and for the agent, while a resolved thread the agent started stays and the confirmation says so.

## How a user reaches it

- Review → Comments → Resolved → Delete resolved → Delete

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

## What proves it works

- `apps/web/spec/integration/reviews-delete-resolved.test.tsx` (Browser Mode integration): .
- The tests read back what the server kept through the kit: `server.commentThreads()`.

## Gotchas

- None known.
