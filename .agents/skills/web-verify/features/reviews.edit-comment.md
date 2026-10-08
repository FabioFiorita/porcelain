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

Start with `$C start`; pair your browser using the card’s pairing-link command.

### Setup

The agent comments first, to show its message has no menu: `$C agent comment README.md "I renamed the heading"`.

1. Navigate to `/` on the card’s web URL (full page load), then wait for text 'I renamed the heading' to be visible
   Look for: article "Comment thread" under README.md holding "I renamed the heading" with no button "Comment actions" anywhere on the page.
2. Click button named `Comment on README.md (unstaged · modified)` then replace the contents of textbox named `Comment` with 'Please explain this change' then click button named `Comment`
   Look for: a second article "Comment thread" under README.md with the text "Please explain this change" and the page's only button "Comment actions".
3. Click button named `Comment actions`
   Look for: a menu with menuitems "Edit" and "Delete".
4. Click menuitem named `Edit`
   Look for: textbox "Edit comment" holding "Please explain this change"; buttons "Cancel" and "Save"; button "Comment actions" is gone while editing.
5. Replace the contents of textbox named `Edit comment` with '   '
   Look for: button "Save" is disabled.
6. Replace the contents of textbox named `Edit comment` with 'Please explain why the heading changed' then click button named `Save`
   Look for: textbox "Edit comment" is gone; the text "Please explain why the heading changed" and the text "edited" in the message header. `$C server comment-threads` holds the rewritten body beside the agent's "I renamed the heading".
7. Click button named `Comment actions` then click menuitem named `Delete`
   Look for: the text "Please explain why the heading changed" is gone; the only article "Comment thread" left is the agent's "I renamed the heading". `$C server comment-threads` lists only the agent's thread.
8. Inspect HTTP requests and responses
   Look for: `PATCH /api/worktrees/<id>/comments/<threadId>/messages` answered 200 (step 6) and `DELETE /api/worktrees/<id>/comments/<threadId>/messages?messageId=<id>` answered 200 (step 7).

## What proves it works

- Step 6's rewritten text with "edited", step 7's removed thread, and step 8's 200 PATCH and DELETE.
- Persistence: run Navigate to `/` on the card’s web URL (full page load) after step 6 to see the rewritten text and "edited" read back; after step 7 the reload shows no thread.
- `apps/web/spec/integration/reviews-edit-comment.test.tsx`: the agent comment shows with no "Comment actions"; Edit opens "Edit comment" holding the first text; Save is disabled when blank; after Save the new text and "edited" show and `server.commentThreads()` reads `reviewer: Please explain why the heading changed`; Delete leaves only the agent thread on the server.

## Gotchas

- "Delete" deletes at once, with no confirmation.
- "Comment actions" must be unique: any other reviewer message left in this instance (another thread, a reply) adds one more and the click fails. `stop` and `start` for a clean instance.
- `Escape` in the "Edit comment" textbox cancels the edit without saving.
