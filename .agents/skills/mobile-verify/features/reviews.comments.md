---
screen: /review-comments
selectors:
  - 'Review comment'
  - 'Add comment'
  - 'Cancel'
  - 'Reply'
  - 'Resolve'
  - 'Reopen'
  - 'Done'
  - 'No comments'
  - 'Send reply'
  - 'Thread unavailable'
tests:
  - packages/client/src/features/reviews/rules/comments.spec.ts
  - packages/client/src/features/reviews/commands/comments.spec.ts
  - packages/client/src/features/reviews/queries/comments.spec.ts
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

Comment filters and document owners share the canonical connection/worktree discussion read. Switching open/resolved filters must not start separate cached readers; both nonempty filters must see the current discussion before it is acknowledged. Shared-client tests hold further reads while proving the already loaded discussion can be acknowledged and a newer snapshot resets the required filters.

## How to get to it (user POV)

- Review → Comments; diff → Comment on file / Comment on selected lines. Done or sheet dismissal returns.
- A folded thread on a phone decision opens that one thread; the decision bar's Comment and a question's Answer open a whole-change draft.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open all worktree Comments or file/selected-lines feedback. Post literal text; independently read thread anchor/message. Invalid/failed submit retains draft; identical retry retains IDs. Cancel writes nothing.
2. Add an agent reply through the fixture: it appears live. Reply, Resolve and Reopen. Global comments marks the displayed revision seen; file-filtered comments must not mark unseen threads elsewhere.
3. Change the underlying file while composing: earlier-comparison notice appears and the draft retains the displayed fingerprint. Change workspace: Review unavailable. Done/checkmark or sheet gesture returns to the exact file/list underneath.

4. Open one thread from a decision diff. The title names its line, Resolve/Reopen and Done sit in the sheet header (Android: Resolve/Reopen as an icon, back returns), and each message shows its author and "on rN" (the revision published before it was written). An agent reply naming stop n or decision n links to that decision when the thread's review and revision are the ones shown and that decision exists; the link closes the sheet on that decision. The reply field and Send stay above the device's real keyboard (the driver's hidden test IME never covers them, so switch to the system keyboard); Send reply posts and clears it. A thread written on the published review replies and resolves on that review: read the message and resolution back through MCP `list_comments` with its `reviewId`. A resolved thread hides the reply field. A deleted thread says Thread unavailable.
5. From a decision, Comment, change the prefilled text, then native Back: Discard comment? appears; Discard returns to the decision, Keep writing keeps the draft. Repeat from a thread reply. Sent decision comments belong to the published review and show "on rN".

Automated coverage: `comments.spec.ts` (stop links, revision markers, thread write target), `navigation.spec.ts` (review identity for new comments), `review-comments.integration.ts` (review-owned writes through the worktree owner); retain the live action and readback evidence.

## Gotchas

- Existing threads keep their original anchor, replies and resolved state. Preserve unsent-draft confirmation on return; compare saved IDs/anchors rather than a success message alone.
