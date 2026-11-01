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
  - apps/web/spec/integration/reviews-comment-drafts.test.tsx
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
- Clicking the same file comment button again keeps the draft visible, retains its text and focuses its field. Hover an added line and click its gutter plus; repeating that plus on the same line has the same behavior. Sending saves one thread on that exact line and side.
- Reopening through the C shortcut, toolbar or context-menu request restores focus to the existing field too. Focus moves when the opening request commits; typing or incoming comments must not repeatedly steal it.
- Leave a decision or file and return, then reopen the same comment: its unsent text returns. Another file, range, question, review revision or environment has its own draft. Cancel or Escape clears the selected new-comment draft. These drafts last for the running client session.
- Lose a POST response after the server stores the comment, then click the same file's Comment button and retry. Text and write IDs stay together; independent readback must contain exactly one thread and one message.
- While one file's send is held, open another file's retained draft. Releasing the first send must leave the second composer open with its text; only the submitted draft clears.
- Distinct question IDs keep separate answer drafts even when the question text is identical. The same question in the briefing and decision shares its draft. Sending still quotes the question in a whole-change comment; the draft key adds no wire anchor.

## Driving it with browser

Preconditions: [surface baseline](README.md). For the visual sweep, pass the concrete `/<projectId>/<worktreeId>?entry=handoff` URL; the workspace adds that canonical document entry when opened without one.

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

In the Changes document, the file comment button uses its comparison label ("unstaged · modified") at wide widths and a Comment icon in a narrow pane. Its full accessible name is unchanged.
