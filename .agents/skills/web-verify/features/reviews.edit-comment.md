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

The reviewer rewrites their own comment, which then shows "edited" and is saved with the new text, and deletes it, which removes the thread; an agent message has no "Comment actions" menu, so it offers neither.

## How to get to it (user POV)

- Any of your own messages (inline under a file, or in Review → Comments): the "…" button "Comment actions" in its header → menuitem "Edit" or menuitem "Delete" (destructive, no confirmation).
- In the editor: button "Save" (disabled while blank), button "Cancel" or `Escape` leaves it.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

The agent comments first, to show its message has no menu: `$C agent comment README.md "I renamed the heading"`.

1. Navigate to `/`, then wait for 'I renamed the heading'
   Expect: article "Comment thread" under README.md holding "I renamed the heading" with no button "Comment actions" anywhere on the page.
2. Click button `Comment on README.md (unstaged · modified)` then replace the contents of textbox named `Comment` with 'Please explain this change' then click button `Comment`
   Expect: a second article "Comment thread" under README.md with the text "Please explain this change" and the page's only button "Comment actions".
3. Click button `Comment actions`
   Expect: a menu with menuitems "Edit" and "Delete".
4. Click menuitem `Edit`
   Expect: textbox "Edit comment" holding "Please explain this change"; buttons "Cancel" and "Save"; button "Comment actions" is gone while editing.
5. Fill textbox `Edit comment` with '   '
   Expect: button "Save" is disabled.
6. Fill textbox `Edit comment` with 'Please explain why the heading changed' then click button `Save`
   Expect: textbox "Edit comment" is gone; the text "Please explain why the heading changed" and the text "edited" in the message header. `$C server comment-threads` holds the rewritten body beside the agent's "I renamed the heading".
7. Click button `Comment actions` then click menuitem `Delete`
   Expect: the text "Please explain why the heading changed" is gone; the only article "Comment thread" left is the agent's "I renamed the heading". `$C server comment-threads` lists only the agent's thread.
8. Inspect HTTP traffic
   Expect: `PATCH /api/worktrees/<id>/comments/<threadId>/messages` answered 200 (step 6) and `DELETE /api/worktrees/<id>/comments/<threadId>/messages?messageId=<id>` answered 200 (step 7).

### Observable proof

Reload after edit: new text/edited persist; after Delete: no thread. PATCH/DELETE answer 200.

Automated coverage: `reviews-edit-comment.test.tsx`.

## Gotchas

- Delete acts immediately without confirmation. Scope Comment actions to the intended reviewer message if others exist. Escape in Edit comment cancels.
