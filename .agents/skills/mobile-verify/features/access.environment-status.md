---
screen: /computers
selectors:
  - 'Online'
  - 'Offline'
  - 'Needs pairing'
  - 'Another server'
  - 'Update needed'
  - 'Checking'
  - 'Reconnecting'
  - 'reading-connection'
  - 'Pair again'
tests:
  - packages/client/src/features/access/queries/environments.spec.ts
  - packages/client/spec/integration/environment-status.integration.ts
api:
  - GET /api/environment
  - GET /api/session
---

# access.environment-status

Each saved computer reports its connection state and refreshes when Computers gains focus or the app returns to the foreground.

The screen being read reports the same state for its computer. Every reading screen (the Worktree page and its sections, Changed file, All changes, a step, a commit and its diff, a file and its timeline) and the file and screenshot sheets float one `reading-connection` notice at the top of their content; only the focused screen or sheet shows it, so a screen under Settings or a sheet stays quiet. After two seconds without an answer it reads Reconnecting. When the computer refuses this device it reads Needs pairing with one Pair again button, which opens the pairing sheet over Settings for that computer only, including after scanning a QR code; a link for another computer is refused. Re-pairing returns to the same page and position. It reads Another server answers or Update needed when those states apply. The notice takes no layout space: the page, its content and its scroll position stay where they were while the computer is away and when it returns, and the notice leaves as soon as the computer answers. While any notice shows, the page's writes are disabled and the notice is their only explanation: Git Fetch and Pull, Mark reviewed, Ask and Try again in a Walkthrough conversation, Post and Save for later, Write, Update and Try again on the Walkthrough, and the Files create, rename, trash, pin and hide actions with the file sheet's Create or Rename. Copy, Open and Timeline stay available. The Worktrees list shows the same notice for the selected computer on a phone, or when no worktree is open beside it, and its worktree actions (delete, switch branch) and project rename and remove are disabled while that computer is away. Every write command also refuses at the moment it runs while the computer is away, so an alert or sheet opened earlier cannot write.

## How to get to it (user POV)

- Settings tab → Computers, or the deep link `porcelain.dev://computers`, with computers paired

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Computers. The card's computer shows Online, its current name/version and saved address. A pending read shows Checking; retries may show Reconnecting.
2. Suspend only the captured HTTP listener PID, verify HTTP is unresponsive, and expect Offline or Reconnecting within 45 seconds without reload. Resume that PID in `finally`; JSON health returns 200 and Online returns within 45 seconds.
3. Background/foreground: diagnostic HTTP probes stop in the background and resume without new pairing. A healthy live session stays Online when only its independent HTTP probe fails. Foreground checks the existing session before replacement; a long resume refreshes active reads and pending operations after the round trip. Re-entering Settings also refreshes metadata.
4. On All changes and on the Worktree page, suspend the listener as in step 2. Within a few seconds `reading-connection` reads Reconnecting (in the raw snapshot; it is not interactive), the content keeps its place, and it leaves within seconds of resuming without moving the page. While it shows, History's Fetch and Pull and Changed file's Mark reviewed are disabled; they work again after resuming.
5. Revoke only the fixture's native device through the owner socket (`POST /access/revoke`); foreground/re-enter Computers. Expect Needs pairing and instructions to run porcelain pair. On a reading screen the notice reads Needs pairing; Pair again → Use development server → Pair → Close Settings returns to the same page without the notice.
6. With dedicated identity/protocol fixtures, route the saved address to a different installation or incompatible protocol. Expect Another server or Update needed respectively; restore the original host and confirm recovery.

Automated coverage: `environments.spec.ts`, `environment-status.integration.ts`.

## Gotchas

- An outage does not prove identity/protocol refusal. Online requires both identity/protocol and an authorized session; confirmed rejection of every saved route means Needs pairing; an unreachable alternate remains retryable. Live connection state is authoritative while a session is owned.
- Keep listener ownership and resume in `finally`; suspending only the launcher does not stop HTTP.
