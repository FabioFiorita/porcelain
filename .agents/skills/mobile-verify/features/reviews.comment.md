---
screen: /comment
selectors:
  - 'Comment'
  - 'New comment'
  - 'Edit comment'
  - 'Leave a comment'
  - 'Save'
  - 'Delete comment'
  - 'Drafts stay on this computer until you publish them.'
  - 'This comment link is invalid.'
  - 'This comment is no longer a draft.'
  - 'Another worktree is selected now.'
tests:
  - apps/mobile/src/features/comments/rules/comment-target.spec.ts
  - packages/client/src/features/comments/rules/comments.spec.ts
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - PATCH /api/worktrees/:worktreeId/comments/:commentId
  - DELETE /api/worktrees/:worktreeId/comments/:commentId
---

# reviews.comment

One draft comment in a native sheet: a new one on a Walkthrough step, a diagram node, a file or a range of lines, or an existing draft to edit or delete. Its title names the anchor ("Step · …", "<node> · …", the path, or "<path> · lines 3–5"). Drafts stay on the connected computer until [Publish review](reviews.publish-comments.md) posts or copies them.

## How to get to it (user POV)

- [Walkthrough](reviews.walkthrough-page.md) → a step's Comment, or a diagram node → "Comment on <node>".
- A draft under a step or node → Edit comment.
- The pull request and file screens push the same sheet for file and line anchors (`/comment?workspace=<key>&anchor=<JSON>`; a `lines` anchor carries `path`, `side`, `start`, `end` and the `text` snapshot the contract requires).
- Close (iOS sheet X, Android Back) returns without saving.

## Driving it with agent-device

Preconditions: [reviews.walkthrough-page](reviews.walkthrough-page.md) after `$C walkthrough sample`, or the bundled demo.

1. Step 1 → Comment: the sheet title reads "Step · Choose the empty search behavior"; Comment is disabled until the text has a non-space character. Type and press Comment: the sheet closes and the draft shows under step 1 with "Draft", Edit comment and Delete comment. `$C server` readback: `GET /api/worktrees/<id>/comments` lists it with the step anchor.
2. Edit comment: the sheet opens with the text, Save and Delete comment. Change it and Save: the draft under the step shows the new text. Delete comment from the sheet or the card removes it.
3. With writes blocked, Comment, Save and Delete comment are disabled; a refused save shows its reason beside the button.
4. Publish the draft elsewhere, then reopen its Edit link: "This comment is no longer a draft."

## Gotchas

- The anchor title for steps is the plain step title, the same text the web uses, so drafts match across clients.
- A malformed link shows "This comment link is invalid." rather than opening an empty composer.
