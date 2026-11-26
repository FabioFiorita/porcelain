---
screen: /publish-comments
selectors:
  - 'Publish review'
  - 'Nothing is posted until you publish.'
  - 'Post as one pull request review'
  - 'Preview review'
  - 'Copy for an agent'
  - 'Copy Markdown'
  - 'Copied comments'
  - 'These drafts will be posted as one review if they are still open.'
  - 'Summary'
  - 'Post review'
  - 'Back'
  - 'Review posted'
  - 'Open on GitHub'
  - 'Comments could not be read.'
tests:
  - packages/client/src/features/comments/rules/comments.spec.ts
  - apps/mobile/src/shared/application/notice.spec.ts
  - apps/mobile/src/shared/adapters/demo-transport.spec.ts
api:
  - GET /api/worktrees/:worktreeId/comments
  - PATCH /api/worktrees/:worktreeId/comments/:commentId
  - DELETE /api/worktrees/:worktreeId/comments/:commentId
  - GET /api/worktrees/:worktreeId/comments/review
  - POST /api/worktrees/:worktreeId/comments/review
---

# reviews.publish-comments

The open draft comments of a worktree, each with its anchor, and two ways out: post them as one pull request review (preview first, edit each body, then Post review) or copy them as Markdown for an agent. It copies the web's comments dialog.

## How to get to it (user POV)

- [Walkthrough](reviews.walkthrough-page.md) → Before you merge → Comments → Publish review (or Show once everything is posted).
- Close returns to the page; Back inside the review returns to the drafts.

## Driving it with agent-device

Preconditions: [reviews.walkthrough-page](reviews.walkthrough-page.md) with at least one draft (see [reviews.comment](reviews.comment.md)), or the bundled demo.

1. The sheet reads "N draft comments on <branch> at <sha>. Nothing is posted until you publish.", lists each draft with its anchor label, Edit comment and Delete comment, then the two ways out. Edit comment turns that card into the comment form in place (Save, Delete comment); Save returns to the card with the new text.
2. Copy Markdown: the clipboard holds the server's Markdown (each anchor, its text and the head commit). On Android 13 and later the system confirms the copy; elsewhere Porcelain shows "Copied comments" (title only).
3. Preview review without a pull request (fixture or demo): the line under "Post as one pull request review" becomes "This branch has no open pull request. Push it and open one, or copy the comments for an agent."
4. With a pull request on GitHub: Preview review shows "Review on #N · <title>", an optional Summary, "On their lines · n" and "In the review body · n", each body editable. Post review stays disabled while any body is empty; posting shows "Review posted" with Open on GitHub and the included drafts turn into posted comments. Posting uses the confirmed text and current placement of the previewed drafts that are still open. A changed destination is refused.

## Gotchas

- Posting needs a real GitHub pull request and gh on the connected computer; the fixture's fake GitHub does not answer the review preview.
- Editing here happens in place, so the sheet never stacks a second sheet.
