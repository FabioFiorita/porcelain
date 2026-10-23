---
route: /$projectId/$worktreeId
selectors:
  - "Comment on "
  - "Comment"
  - "Cancel"
  - "Waiting for the agent"
  - "The agent reads this when you ask it to check its comments."
tests:
  - apps/web/spec/integration/reviews-comment.test.tsx
  - apps/web/spec/integration/reviews-retained-comments.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.comment

A blank comment cannot be posted, and a written comment on a changed file is saved on that file (a whole-file anchor) and shown inline, waiting for the agent.

## How to get to it (user POV)

- The file header of a changed file in any code document (the "Changes" document the workspace opens on): button `Comment on <path> (<note>)`, for the sample `Comment on README.md (unstaged · modified)`. Below 720 px its visible text "Comment" is screen-reader only, so the accessible name is the full label.
- Keyboard: `C` (no modifier) with focus outside any input opens the composer on the focused file of the active code document.
- Right-click a changed file in Review → Changes → menuitem "Comment" (see `reviews.changed-file-menu`).
- In the composer: `ControlOrMeta+Enter` posts, `Escape` cancels.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

 the sample `README.md` is already modified, so the "Changes" document shows it with its comment button.

1. Navigate to `/`
   Expect: title "Changes — repository"; button "Comment on README.md (unstaged · modified)" in region "Review content".
2. Click button `Comment on README.md (unstaged · modified)`
   Expect: textbox "Comment" (placeholder "Share feedback…") above the label text "README.md · Whole file"; button "Comment" is disabled; button "Cancel".
3. Fill textbox `Comment` with '   '
   Expect: button "Comment" is still disabled (whitespace only is blank).
4. Fill textbox `Comment` with 'Please explain this change'
   Expect: button "Comment" is enabled.
5. Click button `Comment`
   Expect: textbox "Comment" is gone; an article "Comment thread" under the README.md diff holding "You", the text "Please explain this change", the badge text "Waiting for the agent", buttons "Reply" and "Resolve", and the text "The agent reads this when you ask it to check its comments."
6. Inspect HTTP traffic
   Expect: exactly one `POST /api/worktrees/<id>/comments` answered 200, sent at step 5 (none at step 3).

### Observable proof

Reload: Please explain this change persists in Comment thread under README. Exactly one comment POST/200.

Automated coverage: `reviews-comment.test.tsx`.

## Retained context code

Publish a decision with changed code and an unchanged context step (`agent publish-architecture` includes `packages/workspace/src/actor.ts`). Open a decision and its `Existing code it relies on` section. Post a whole-file comment from the file header, then a selected-line comment from the gutter. Both must save without an anchor error. Through MCP, list comments with `reviewId`, reply and resolve; the anchors keep the selected head and branch base, and the thread keeps its review revision after another publication.

Repeat at 1440 and 414 in light and dark. A failed request keeps the draft and retry posts one thread. Ordinary worktree branch comments retain their existing matching behavior.

## Gotchas

- Use full Comment on README.md (unstaged · modified); Comment alone is the submit control. C is ignored in text fields and only the active pane listens.
- Repeated threads make Reply/Resolve ambiguous; delete through Comment actions → Delete or reset.
