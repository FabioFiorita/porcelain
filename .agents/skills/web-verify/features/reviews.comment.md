# reviews.comment

## What it is

A blank comment cannot be posted, and a written comment on a changed file is saved on that file (a whole-file anchor) and shown inline, waiting for the agent.

## How a user reaches it

- The file header of a changed file in any code document (the "Changes" document the workspace opens on): button `Comment on <path> (<note>)`, for the sample `Comment on README.md (unstaged · modified)`. Below 720 px its visible text "Comment" is screen-reader only, so the accessible name is the full label.
- Keyboard: `C` (no modifier) with focus outside any input opens the composer on the focused file of the active code document.
- Right-click a changed file in Review → Changes → menuitem "Comment" (see `reviews.changed-file-menu`).
- In the composer: `Mod+Enter` posts, `Escape` cancels.

## Driving it

Start with `$C start`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None: the sample `README.md` is already modified, so the "Changes" document shows it with its comment button.

1. Open `/` on the instance web URL
   Look for: Page Title "Changes — repository"; button "Comment on README.md (unstaged · modified)" in region "Review content".
2. Click the button named 'Comment on README.md (unstaged · modified)'
   Look for: textbox "Comment" (placeholder "Share feedback…") above the label text "README.md · Whole file"; button "Comment" is disabled; button "Cancel".
3. Set the text field named 'Comment' to '   '
   Look for: button "Comment" is still disabled (whitespace only is blank).
4. Set the text field named 'Comment' to 'Please explain this change'
   Look for: button "Comment" is enabled.
5. Click the button named 'Comment'
   Look for: textbox "Comment" is gone; an article "Comment thread" under the README.md diff holding "You", the text "Please explain this change", the badge text "Waiting for the agent", buttons "Reply" and "Resolve", and the text "The agent reads this when you ask it to check its comments."
6. Inspect browser network evidence
   Look for: exactly one `POST /api/worktrees/<id>/comments` answered 200, sent at step 5 (none at step 3).

## What proves it works

- Step 5's inline thread with "Waiting for the agent", and step 6's single 200 `POST .../comments`.
- Persistence: open `/` on the instance web URL again shows the same article "Comment thread" with "Please explain this change" under README.md, read back from `GET .../comments`.
- `apps/web/spec/integration/reviews-comment.test.tsx`: the post button is disabled for an empty and a whitespace body and the server holds no thread; after posting, the body and "Waiting for the agent" are visible and `server.commentThreads()` holds one unresolved thread on `README.md` with that one message.

## Gotchas

- Choose the file header button named "Comment on README.md (unstaged · modified)". The composer’s separate "Comment" button posts the comment and exists only while the composer is open.
- The `C` shortcut is ignored while focus is in a text field, and only the active pane's code document listens. After a page load, focus is on the page body, so press `c` works there.
- Comments persist in the instance: a later run adds a second "Comment thread", which makes "Reply" and "Resolve" ambiguous for other features. Delete it through its "Comment actions" → "Delete" (see `reviews.edit-comment`), or `stop` and `start` a fresh instance.
