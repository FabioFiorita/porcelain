---
screen: /worktrees
selectors:
  - 'demo-start'
  - 'demo-reset'
  - 'demo-exit'
  - 'Try the demo'
  - 'Hello Garden'
tests:
  - apps/mobile/src/shared/adapters/demo-transport.spec.ts
api: []
---

# access.demo

The bundled demo opens the real mobile screens with a local sample computer and project. It needs no account, pairing, network or agent. Conversation replies identify themselves as simulated. Sample changes reset when the app restarts, or the user resets or exits the demo. Real paired computers remain saved.

## How to get to it (user POV)

- With no computers paired, Worktrees → Try the demo.
- Settings → Try the demo also works when real computers are saved.
- Open Hello Garden → A warmer welcome for every visitor. Read its Walkthrough, open a step, Changes, Files and History.
- Settings → Reset demo restores the sample; Exit demo removes the sample computer.

## Driving it with the surface harness

1. Start a disposable mobile instance with `--manual-pairing`; leave its development server unpaired. Open Worktrees: No computers paired, Add computer and the demo explanation stay below the native status and navigation bars, including the iOS large title. At larger text sizes or in landscape, scroll to reach the controls without overlap. Press `demo-start`. Expect Hello Garden and Demo computer without pairing.
2. Open the sample worktree. Expect the demo notice and ready Walkthrough. Open its step and source excerpt. Ask two questions; expect your text and replies beginning Simulated demo reply. Copy as prompt for one question must copy only that question. Save one question; Copy together must include only the saved question. No external conversation service is contacted.
3. Open Changes → src/welcome.ts. Read the diff, mark it Reviewed and unmark it. Repeat on Branch · main: mark a file, leave and reopen the comparison, expect Reviewed to remain; unmark it, leave and reopen, expect Unreviewed. Open Files → README.md and read the Markdown preview and source, then open its timeline. Mobile has no text editor.
4. Open History, then a commit and its diff, and return. In Settings press Reset demo; reopen the worktree and expect original sample content and no reviewed marks or conversation messages.
5. Press Exit demo in Settings and close Settings. Expect No computers paired. Start the demo again. Repeat with one real disposable computer paired; resetting/exiting must retain that computer and its selection data.
6. Verify the same bundled demo works with an unreachable development server. Capture screenshots of the Walkthrough, a simulated reply and a sample diff. The phone's Metro connection is development infrastructure, not a demo backend.

## Gotchas

- Demo operations never fall through to the network. Unsupported remote actions explain that a connected computer is required rather than reporting success.
- Demo screenshots and these instructions do not establish store approval, production artifact startup, physical iPhone or iPad behavior.
- Run on an Android phone for shared behavior. If tablet presentation changes, also verify a recognized tablet in portrait and landscape.
