---
screen: /review-comments
selectors:
  - "Review comment"
  - "Add comment"
  - "Cancel"
  - "Reply"
  - "Resolve"
  - "Reopen"
  - "Done"
  - "No comments"
tests:
  - apps/mobile/spec/e2e/review.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
  - POST /api/worktrees/:worktreeId/comments/seen
---

# reviews.comments

Open Comments from Review for all worktree threads, or Comment on file/selected lines from a diff. The native form sheet uses ReviewComposer and ReviewAnnotation. Existing threads retain their original anchor and include agent replies and resolved state.

Post literal feedback and verify the server thread anchor and message. An invalid or failed submission retains the draft; identical retries retain message/thread IDs. Cancel leaves no write. Add an agent reply through the fixture and expect it live, then Reply, Resolve and Reopen from the sheet. Global comments mark the displayed revision seen; a file-filtered sheet does not mark unseen comments elsewhere as read.

Change the underlying file while composing. Expect the earlier-comparison notice; the draft keeps the fingerprint of the displayed code. Change the workspace and expect Review unavailable. Done or the native sheet gesture returns to the exact file/list underneath.
