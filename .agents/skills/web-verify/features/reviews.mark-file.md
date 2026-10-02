---
route: /
selectors:
  - "Review content"
tests:
  - apps/web/spec/integration/reviews-mark-file.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.mark-file

## What it is

Marking and unmarking a changed file as reviewed updates its control and the server keeps each change.

## How a user reaches it

- changed file → Mark as reviewed
- Shortcut: `R`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Marking and unmarking a changed file as reviewed updates its control and the server

```sh
.agents/skills/web-verify/scripts/cli open /
```


Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-mark-file.test.tsx` (Browser Mode integration): marking and unmarking a changed file as reviewed updates its control and the server.
- The tests read back what the server kept through the kit: `server.reviewedFiles()`.

## Gotchas

- None known.
