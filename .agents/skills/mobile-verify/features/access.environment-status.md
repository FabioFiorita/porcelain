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
tests:
  - packages/client/src/features/access/queries/environments.spec.ts
  - packages/client/spec/integration/environment-status.integration.ts
api:
  - GET /api/environment
  - GET /api/session
---

# access.environment-status

Each saved computer reports its connection state and refreshes when Computers gains focus or the app returns to the foreground.

## Sub-features

- `access.environment-status` — Connection status, revoked devices and recovery.

## How to get to it (user POV)

- Settings → Computers, or the deep link `porcelain.dev://computers`, with computers paired

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Computers. The card's computer shows Online, its current name/version and saved address. A pending read shows Checking; retries may show Reconnecting.
2. Suspend only the captured HTTP listener PID, verify HTTP is unresponsive, and expect Offline within 45 seconds without reload. Resume that PID in `finally`; JSON health returns 200 and Online returns within 45 seconds.
3. Background/foreground: probes stop in the background and resume without new pairing. Re-entering Settings also refreshes status.
4. Revoke only the fixture's native device through the owner socket (`POST /access/revoke`); foreground/re-enter Computers. Expect Needs pairing and instructions to run porcelain pair.
5. With dedicated identity/protocol fixtures, route the saved address to a different installation or incompatible protocol. Expect Another server or Update needed respectively; restore the original host and confirm recovery.

Automated coverage: `environments.spec.ts`, `environment-status.integration.ts`.

## Gotchas

- An outage does not prove identity/protocol refusal. Online requires both identity/protocol and an authorized session; 401 means Needs pairing.
- Keep listener ownership and resume in `finally`; suspending only the launcher does not stop HTTP.
