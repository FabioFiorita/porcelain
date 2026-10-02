---
route: /
selectors:
  - "Comment"
  - "Waiting for the agent"
tests:
  - apps/web/spec/integration/reviews-comment.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.comment

## What it is

A blank comment cannot be posted, and a written comment on a changed file is saved on that file and shown waiting for the agent.

## How a user reaches it

- All changes → changed file → Comment
- Shortcut: `C`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A blank comment cannot be posted, and a written comment on a changed file is saved and waits for the agent

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the textbox “Comment” shows.
After `open`, look for: the button “Comment” is disabled.
1. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" " "`
   Look for: the button “Comment” is disabled.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Please explain this change"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the text “Please explain this change” shows; the text “Waiting for the agent” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-comment.test.tsx` (Browser Mode integration): a blank comment cannot be posted, and a written comment on a changed file is saved and waits for the agent.
- The tests read back what the server kept through the kit: `server.commentThreads()`.

## Gotchas

- None known.
