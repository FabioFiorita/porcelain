---
screen: /computers
selectors:
  - 'Forget computer'
  - 'No computers paired.'
tests:
  - packages/client/src/features/projects/commands/selection.spec.ts
  - packages/client/src/features/projects/store/worktree-snapshot.spec.ts
api: []
---

# access.forget-environment

Forget computer removes this device’s saved computer, credentials, remembered workspace and saved Worktrees, keeping other computers and the server’s device registration.

## How to get to it (user POV)

- Settings gear → Computers → the computer's Forget computer button

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. In Computers locate the full card computer name, status badge and Forget computer trash button. Forget it; expect its row gone and No computers paired. when it was last.
2. Cold-launch: that computer, workspace selection and saved Worktrees remain absent. Independently confirm its device registration still exists on the server.
3. With two disposable computers, forget one and confirm the other reconnects. Exercise a removal error: show its row error; unreadable saved storage or a pending removal disables Forget.

Automated coverage: `selection.spec.ts` invokes Forget through workspace cleanup and checks that the selected computer's saved Worktrees are deleted while another computer's rows remain. `worktree-snapshot.spec.ts` checks that storage discards late writes after Forget. Retain the live action and readback evidence.

## Gotchas

- Forget is local; it does not revoke the server device. Keep the existing unsaved-draft guard when leaving a selected workspace.
