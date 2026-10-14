---
screen: /settings
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

## What it is

Each environment row shows its saved address, its current server name and version when online, and the shared status explanation when unavailable. Status refreshes when Settings gains focus, when the app returns to the foreground, and through the shared polling read.

Each environment row in Settings says what its server answered: “Checking” until it answers, “Online”, “Reconnecting” while retrying an offline host, “Offline” when it cannot be reached, “Needs pairing” when the server no longer accepts this device, “Another server” when a different environment answers at that address, and “Update needed” when the server speaks another protocol.

## How a user reaches it

- Settings, or the deep link `porcelain.dev://settings`, with environments paired

## Driving it

1. Select Settings. Expect the environment named on the card to show Online.
2. Suspend only the captured HTTP listener PID of this disposable server; verify HTTP becomes unresponsive. Do not suspend only its launcher.
3. Wait up to 45 seconds. Expect Offline without reloading the app.
4. Resume that exact listener in a finally block. Verify JSON health 200 returns, then expect Online within 45 seconds without reloading.
5. Background and foreground the app. Expect a fresh status read without pairing or changing the saved credential. While backgrounded, expect status probes to stop.
6. To verify Needs pairing, revoke only this fixture's native device through its owner socket, then re-enter Settings or return to the foreground. Expect Needs pairing and instructions to run porcelain pair.
7. Another server and Update needed require dedicated identity/protocol fixtures; do not infer them from an outage.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- The shared client reads the public `GET /api/environment` for identity and protocol, then authenticated `GET /api/session` before calling it online. A 401 shows “Needs pairing”.
- `apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts` pairs a real remote, revokes its device, and checks the shared status read shows “Needs pairing”. On iPhone, revoking the instance's “Verification simulator” device through the server's owner socket (`POST /access/revoke`) and returning to the foreground shows “Needs pairing”. Re-entering Settings and returning to the foreground also refresh the read.
- The shared-client integration test routes a saved address to a second real disposable host, rejects its identity without reading its authenticated session, then restores the original host. The unit test advances the polling clock through this recovery. Incompatible protocols are covered by the named unit test; native identity/protocol journeys need dedicated fixtures.
