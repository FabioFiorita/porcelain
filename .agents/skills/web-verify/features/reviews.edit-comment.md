---
route: /
selectors:
  - "Comment actions"
  - "Comment"
  - "Edit"
  - "Edit comment"
  - "Save"
  - "edited"
  - "Delete"
tests:
  - apps/web/spec/integration/reviews-edit-comment.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/comments/:threadId/messages
  - PATCH /api/worktrees/:worktreeId/comments/:threadId/messages
---

# reviews.edit-comment

## What it is

The reviewer rewrites their own comment, which shows as edited and is saved with the new text, then deletes it, which removes the thread, while the agent's comment offers neither.

## How a user reaches it

- All changes → your comment → Comment actions → Edit or Delete

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The reviewer edits and then deletes their own comment, and cannot change the agent comment

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, comment on `README.md` through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the text “I renamed the heading” shows.
After `open`, look for: the button “Comment actions” is gone.
1. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Please explain this change"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the text “Please explain this change” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment actions"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Edit"`
   Look for: the textbox “Edit comment” holds first.
5. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Edit comment" " "`
   Look for: the button “Save” is disabled.
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Edit comment" "Please explain why the heading changed"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Save"`
   Look for: the text “Please explain why the heading changed” shows; the text “edited” shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment actions"`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Delete"`
   Look for: the text “Please explain why the heading changed” is gone; the text “I renamed the heading” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-edit-comment.test.tsx` (Browser Mode integration): the reviewer edits and then deletes their own comment, and cannot change the agent comment.
- The tests read back what the server kept through the kit: `server.commentThreads()`.

## Gotchas

- None known.
