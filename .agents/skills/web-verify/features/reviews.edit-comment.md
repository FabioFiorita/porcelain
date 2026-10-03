---
route: /$projectId/$worktreeId
selectors:
  - "Comment on "
  - "Comment"
  - "Comment actions"
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

The reviewer rewrites their own comment, which then shows "edited" and is saved with the new text, and deletes it, which removes the thread; an agent message has no "Comment actions" menu, so it offers neither.

## How a user reaches it

- Any of your own messages (inline under a file, or in Review → Comments): the "…" button "Comment actions" in its header → menuitem "Edit" or menuitem "Delete" (destructive, no confirmation).
- In the editor: button "Save" (disabled while blank), button "Cancel" or `Escape` leaves it.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`.

### Setup

The agent comments first, to show its message has no menu: `.agents/skills/web-verify/scripts/cli agent comment README.md "I renamed the heading"`.

1. `.agents/skills/web-verify/scripts/cli open /`, then `.agents/skills/web-verify/scripts/cli wait --text "I renamed the heading"`
   Look for: article "Comment thread" under README.md holding "I renamed the heading" with no button "Comment actions" anywhere on the page.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on README.md (unstaged · modified)"` then `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Please explain this change"` then `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: a second article "Comment thread" under README.md with the text "Please explain this change" and the page's only button "Comment actions".
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment actions"`
   Look for: a menu with menuitems "Edit" and "Delete".
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Edit"`
   Look for: textbox "Edit comment" holding "Please explain this change"; buttons "Cancel" and "Save"; button "Comment actions" is gone while editing.
5. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Edit comment" "   "`
   Look for: button "Save" is disabled.
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Edit comment" "Please explain why the heading changed"` then `.agents/skills/web-verify/scripts/cli click --role button --name "Save"`
   Look for: textbox "Edit comment" is gone; the text "Please explain why the heading changed" and the text "edited" in the message header. `.agents/skills/web-verify/scripts/cli server comment-threads` holds the rewritten body beside the agent's "I renamed the heading".
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment actions"` then `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Delete"`
   Look for: the text "Please explain why the heading changed" is gone; the only article "Comment thread" left is the agent's "I renamed the heading". `.agents/skills/web-verify/scripts/cli server comment-threads` lists only the agent's thread.
8. `.agents/skills/web-verify/scripts/cli network`
   Look for: `PATCH /api/worktrees/<id>/comments/<threadId>/messages` answered 200 (step 6) and `DELETE /api/worktrees/<id>/comments/<threadId>/messages?messageId=<id>` answered 200 (step 7).

## What proves it works

- Step 6's rewritten text with "edited", step 7's removed thread, and step 8's 200 PATCH and DELETE.
- Persistence: run `.agents/skills/web-verify/scripts/cli open /` after step 6 to see the rewritten text and "edited" read back; after step 7 the reload shows no thread.
- `apps/web/spec/integration/reviews-edit-comment.test.tsx`: the agent comment shows with no "Comment actions"; Edit opens "Edit comment" holding the first text; Save is disabled when blank; after Save the new text and "edited" show and `server.commentThreads()` reads `reviewer: Please explain why the heading changed`; Delete leaves only the agent thread on the server.

## Gotchas

- "Delete" deletes at once, with no confirmation.
- "Comment actions" must be unique: any other reviewer message left in this instance (another thread, a reply) adds one more and the click fails. `stop` and `start` for a clean instance.
- `Escape` in the "Edit comment" textbox cancels the edit without saving.
