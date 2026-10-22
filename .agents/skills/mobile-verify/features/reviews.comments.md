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
tests: []
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
  - POST /api/worktrees/:worktreeId/comments/seen
---

# reviews.comments

The native comments sheet supports feedback, replies, resolution and reopening without losing the underlying document.

## Sub-features

- `reviews.comments` — Post, reply, resolve, reopen and retain drafts.

## How to get to it (user POV)

- Review → Comments; diff → Comment on file / Comment on selected lines. Done or sheet dismissal returns.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open all worktree Comments or file/selected-lines feedback. Post literal text; independently read thread anchor/message. Invalid/failed submit retains draft; identical retry retains IDs. Cancel writes nothing.
2. Add an agent reply through the fixture: it appears live. Reply, Resolve and Reopen. Global comments marks the displayed revision seen; file-filtered comments must not mark unseen threads elsewhere.
3. Change the underlying file while composing: earlier-comparison notice appears and the draft retains the displayed fingerprint. Change workspace: Review unavailable. Done/checkmark or sheet gesture returns to the exact file/list underneath.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Existing threads keep their original anchor, replies and resolved state. Preserve unsent-draft confirmation on return; compare saved IDs/anchors rather than a success message alone.
