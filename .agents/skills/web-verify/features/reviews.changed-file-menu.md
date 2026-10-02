---
route: /
selectors:
  - "Review"
  - "Changes"
  - "Mark as reviewed"
  - "Unmark as reviewed"
  - "Comment"
  - "Show timeline"
tests:
  - apps/web/spec/integration/reviews-changed-file-menu.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/file-commits
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.changed-file-menu

## What it is

Right-clicking a changed file marks it reviewed and offers to unmark it, starts a comment on the file, and opens its timeline.

## How a user reaches it

- Review → Changes → right-click a changed file

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Right-clicking a changed file marks it reviewed, starts a comment on it and opens its timeline

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Changes"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Mark as reviewed"`
   Look for: the menuitem “Unmark as reviewed” shows.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Comment"`
   Look for: the textbox “Comment” shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Show timeline"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-changed-file-menu.test.tsx` (Browser Mode integration): right-clicking a changed file marks it reviewed, starts a comment on it and opens its timeline.
- The tests read back what the server kept through the kit: `server.reviewedFiles()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
