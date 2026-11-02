---
route: /reviews/$reviewId
selectors:
  - 'Agent feedback'
  - 'Connected session:'
  - 'Send feedback'
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

The saved review's Comments panel and closing completion card show its connected T3 session and an explicit Send feedback action. The agent connects its existing session through MCP; the reviewer never enters a session ID. Sending hands off saved feedback as a batch, preserves drafts and comments, and leaves review completion, decisions and merge controls unchanged.

## How to get to it (user POV)

- Open a published saved review, then its Review panel → Comments, or its final Not explained/Specs stop → Review completion.
- Connect the existing local T3 session through the review's MCP tool. The same connected session appears in both places. Disconnect session removes the association.

## Driving it with browser

Preconditions: [surface baseline](README.md). Publish a committed review and connect a disposable T3 session through MCP. Use the server feedback contract and independently read the durable delivery after each action.

1. Without an association, check the quiet guidance to ask the agent to connect through MCP. Connect the session: its complete identity appears, including a long ID at phone width. No human-entered session ID field appears.
2. Save a literal review comment, keep a second comment draft open, and choose Send feedback once. Verify the captured host input names the review/revision and saved comment; the draft is absent. Both saved comment and draft remain. The review stays open and decision/file marks stay unchanged.
3. Deliver to the host queue. The UI says Delivered to the T3 host queue and explicitly says the agent has not acknowledged. The same saved batch cannot be resent. Acknowledge through MCP: the live UI confirms receipt and explicitly does not claim a fix.
4. Save new feedback after confirmed delivery/acknowledgement: Send feedback becomes available for the new watermark. Repeat without new feedback: it remains disabled. Open an older revision, or close/archive the review: sending is disabled.
5. Make a host attempt lose its response. The durable pending/attempted delivery shows Delivery outcome unknown, explains that comments are saved, and disables further sending even if more comments are saved. Refresh/reconnect must read the delivery, never trigger another host attempt. An unavailable host after the durable attempt is claimed remains unconfirmed, even if the host refused before sending input.
6. Disconnect session. Independently verify the association is absent, the current delivery is cleared, comments/drafts remain, and the session can only be re-associated through the agent. Read failures offer Read agent connection again; send/disconnect failures remain visible without claiming success.

Drive 1440/1080/414 widths in light and dark. Check keyboard access, long identities/errors, wrapping controls, the Comments panel and closing card together, and state updates in both places. Desktop reuses this component; Electron/native behavior requires desktop verification. Native mobile proof is separate.

A different MCP session cannot replace a connected recipient or clear its uncertain delivery. The reviewer must explicitly disconnect first; re-connecting the same session preserves its receipt.
