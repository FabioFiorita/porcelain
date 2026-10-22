---
screen: /computers
selectors:
  - 'Forget computer'
  - 'No computers paired.'
tests: []
api: []
---

# access.forget-environment

Forget computer removes this device’s saved computer, credentials and remembered workspace, keeping other computers and the server’s device registration.

## How to get to it (user POV)

- Settings → Computers → the environment's Forget computer button

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. In Computers locate the full card computer name, status badge and Forget computer trash button. Forget it; expect its row gone and No computers paired. when it was last.
2. Cold-launch: that computer and workspace selection remain absent. Independently confirm its device registration still exists on the server.
3. With two disposable computers, forget one and confirm the other reconnects. Exercise a removal error: show its row error; unreadable saved storage or a pending removal disables Forget.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Forget is local; it does not revoke the server device. Keep the existing unsaved-draft guard when leaving a selected workspace.
