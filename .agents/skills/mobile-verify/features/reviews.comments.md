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
  - "Send reply"
  - "Thread unavailable"
tests:
  - packages/client/src/features/reviews/rules/comments.spec.ts
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
  - POST /api/worktrees/:worktreeId/comments/seen
  - GET /api/reviews/:reviewId
  - GET /api/worktrees/:worktreeId/review
---

# reviews.comments

The native comments sheet supports feedback, replies, resolution and reopening without losing the underlying document. iOS presents it as a form sheet; Android pushes it as a page, because an Android form sheet has no header for Done and Resolve and sits under the tab bar.

## How to get to it (user POV)

- Review → Comments; diff → Comment on file / Comment on selected lines. Done or sheet dismissal returns.
- A folded thread on a phone decision opens that one thread; the decision bar's Comment and a question's Answer open a whole-change draft.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open all worktree Comments or file/selected-lines feedback. Post literal text; independently read thread anchor/message. Invalid/failed submit retains draft; identical retry retains IDs. Cancel writes nothing.
2. Add an agent reply through the fixture: it appears live. Reply, Resolve and Reopen. Global comments marks the displayed revision seen; file-filtered comments must not mark unseen threads elsewhere.
3. Change the underlying file while composing: earlier-comparison notice appears and the draft retains the displayed fingerprint. Change workspace: Review unavailable. Done/checkmark or sheet gesture returns to the exact file/list underneath.

4. Open one thread from a decision diff. The title names its line, Resolve/Reopen and Done sit in the sheet header, and each message shows its author and "on rN" (the revision published before it was written). An agent reply naming stop n or decision n links to that decision when the review has it; the link closes the sheet on that decision. The reply field stays above the keyboard; Send reply posts and clears it. A resolved thread hides the reply field. A deleted thread says Thread unavailable.

Automated coverage: `comments.spec.ts` (stop links and revision markers); retain the live action and readback evidence.

## Gotchas

- Existing threads keep their original anchor, replies and resolved state. Preserve unsent-draft confirmation on return; compare saved IDs/anchors rather than a success message alone.
