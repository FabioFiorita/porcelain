---
screen: /+not-found
selectors:
  - 'Worktrees'
  - 'Settings'
  - 'Select a worktree'
tests:
  - packages/client/src/features/projects/commands/selection.spec.ts
api:
  - GET /api/environment
  - GET /api/session
---

# app.deep-links

Pairing links open the pairing form. Unknown destinations, including removed published-review links, return to Worktrees.

## How to get to it (user POV)

Open the development scheme at `/worktrees` or an old `/open/reviews/<id>` link.

## Driving it with agent-device

Open both warm and cold links. The old destination returns to Worktrees without crashing. Open Settings and return. Pairing links retain their own form and validation; follow [pairing link](access.pairing-link.md).

## Gotchas

Old review records and routes have no compatibility reader.
