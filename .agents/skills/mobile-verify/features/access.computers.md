---
screen: /computers
selectors:
  - 'Computers'
  - 'Add computer'
  - 'Forget computer'
  - 'No computers paired.'
  - 'Reading saved computers…'
  - 'Try again'
  - 'Manage connections'
  - 'Check updates again'
  - 'Needs trust'
  - 'Needs pairing'
  - 'Pair again'
tests:
  - apps/mobile/src/shared/adapters/credential-storage.spec.ts
  - packages/client/src/features/access/store.spec.ts
  - packages/client/src/features/access/commands/pairing.spec.ts
  - packages/client/src/features/access/rules/settings-updates.spec.ts
  - packages/client/src/features/access/commands/settings-updates.spec.ts
api:
  - GET /api/environment
  - GET /api/session
  - GET /api/service/update
  - POST /api/service/update
---

# access.computers

Computers manages saved connections and shows status, trust and update offers, with shared progress retained across navigation.

## How to get to it (user POV)

- Settings → Computers; Worktrees update sheet → Manage computers.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Pair two disposable computers: trusted managed and untrusted managed, with known version offers. Compare identities/versions with independent reads. Both show Online and their offers; only the untrusted row has expandable Needs trust.
2. Expand its lock; copy the selectable connection ID/`porcelain trust <id>` command and compare with the active registration. Fail over to an alternate route with another device ID and repeat. Grant trust on that host, then Check updates again; this device cannot trust itself.
3. Add an unmanaged offered version. Expect “This server runs outside the installed service. Update it with npm, then run porcelain service update.” No Update action or updater POST; it contributes zero to Update all (N).
4. Update one eligible service. Observe queued/updating/progress and confirmed completion. During a batch, other update actions and Update all are disabled.
5. Update all with two eligible services. Independently record completion before the next request. Fail one: retain its error and attempt the next. Server restart/read errors and tab navigation retain rows/progress/outcomes.
6. Follow [pairing](access.pairing.md), [connections](access.connections.md) and [Forget](access.forget-environment.md). With no computers show No computers paired and Add computer. Unreadable storage disables mutation and offers Try again.

Automated coverage: `settings-updates.spec.ts`, `settings-updates.spec.ts`.

## Gotchas

- Phone Add computer opens a sheet; iPad opens the inline form. Cancel leaves saved computers unchanged.
- Untrusted offers remain visible with zero eligible updates. Unmanaged computers retain their explanation in Computers but create no offer badge. The bundled Mac server updates through the Mac app.

Missing SecureStore credentials keep a Needs pairing row with Pair again and Forget computer. Other computers and healthy alternate routes continue loading, and Add computer stays enabled. Pair again accepts only a missing connection address for that computer. A transient keychain read error keeps mutations disabled and offers Try again.

In an Android disposable verification profile, Settings → Development exposes Remove <computer> primary/alternate fixture key for emulator-loopback connections only. Remove one key, cold-launch the same profile, and verify the recovery row, healthy computers, Pair again and Forget. Never use real user credentials. Pair a second disposable server and an alternate address before removing keys. Capture light/dark screenshots and confirm operation identity survives repair.
