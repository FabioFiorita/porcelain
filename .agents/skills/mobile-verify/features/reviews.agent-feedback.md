---
screen: /review
selectors:
  - 'Connected session:'
  - 'Send feedback'
  - 'Send feedback to agent'
  - 'Disconnect session'
  - 'Delivery outcome unknown'
  - 'Read agent connection again'
tests:
  - packages/client/src/features/reviews/rules/agent-feedback.spec.ts
  - packages/client/src/features/reviews/queries/agent-feedback.spec.ts
api:
  - GET /api/reviews/:reviewId/agent-feedback
  - POST /api/reviews/:reviewId/agent-feedback
  - DELETE /api/reviews/:reviewId/agent-session
---

# reviews.agent-feedback

The published workspace walkthrough and its whole-review Comments sheet share the durable feedback connection and explicit Send feedback action. A connected session is established by the agent through MCP; there is no native session ID entry form. Published reviews opened from the Reviews tab, Show older reviews or a link show the recipient and delivery status without Send feedback or Disconnect session controls, including when they show the latest revision. Comments entry defaults to read-only feedback status unless the existing writable published-workspace flow explicitly supplies its source context.

## How to get to it (user POV)

- Worktrees → worktree → Review. Feedback status appears below the review's progress; Send feedback to agent sits in the bottom bar under Continue whenever saved feedback can be sent. A published review opened from the Reviews tab or a link shows connection/status only.
- From a published decision, Comment opens the review-owned whole-change Comments sheet; the same session and delivery state appear above the saved comments.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Publish a committed review and associate an existing disposable local T3 session through MCP. Verify tablets in landscape and portrait; phone separately.

1. Read unassociated guidance, connect through the agent, and verify the full T3 session identity. Save review feedback, keep an unsent draft and send once. Independently read the delivery and host input; only saved feedback belongs to the batch. The draft, saved anchors, marks and open review remain.
2. Check Delivered names the host queue; acknowledge through MCP and observe the live receipt wording. Receipt never claims the feedback is fixed. A confirmed batch stays disabled until new saved feedback advances the comment watermark. An older revision or closed/archived review cannot send or disconnect. Open the published review (Reviews tab row or link) at its latest revision: recipient/status remain visible, and neither mutation control appears. A Comments route without the explicit writable published-workspace context also shows status only.
3. Lose the host response after an attempt. Pending/attempted shows Delivery outcome unknown and keeps sending disabled after reconnect and after new comments. Reconnect sends reads only. A host-unavailable pre-attempt error stays visible and permits a deliberate send.
4. Disconnect session, independently confirm removal of the association and current delivery while comments/draft remain, then reconnect through the agent. Exercise failed reads and writes and Read agent connection again. No operation silently closes the review or marks decisions.
5. With the real keyboard visible, keep a draft open, observe a live acknowledgement and return with native Back or the sheet's Close. The existing draft confirmation and exact underlying document remain. Check large text and long session/error wrapping on phones and tablets.

Shared-client tests establish rules and request/invalidation behavior. Browser proof does not establish this native flow. Broader native Comments/keyboard follow-up remains separate.

A different MCP session cannot replace a connected recipient or clear its uncertain delivery. The reviewer must explicitly disconnect first; re-connecting the same session preserves its receipt.
