---
screen: /computers
selectors:
  - 'Computers'
  - 'Check for updates'
  - 'Updating…'
  - 'Queued'
  - 'Needs trust'
  - 'Check updates again'
  - 'settings-computers'
tests:
  - packages/client/src/features/access/rules/settings-updates.spec.ts
  - packages/client/src/features/access/commands/settings-updates.spec.ts
  - packages/client/src/features/access/queries/settings-update-matrix.spec.ts
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.updates

Computer updates live in Settings → Computers: Check for updates rereads offers, Update all (n) updates every eligible computer in order, and each computer row offers its own update. Batch progress and outcomes are retained across navigation. The Settings root's Computers row says how many updates are ready.

## How to get to it (user POV)

- Settings gear (Reviews or Worktrees header) → Computers.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Precondition: use the disposable `state/service-update-fixture.json` control in [service updates](../../web-verify/features/access.service-update.md) to seed offers.

1. With an offer, open Settings: the `settings-computers` row shows the paired count and the number of updates ready. Open Computers: Check for updates and Update all (n) are rows of one grouped list above the computer rows; each computer's own Update to <version> and Needs trust are rows inside that computer's group, next to This computer and Manage connections.
2. Inspect computer rows and current → offered version. Eligible rows have their own Update; untrusted rows have expandable Needs trust and the correct selectable connection ID; unmanaged computers show their explanation and count toward no update. With only untrusted offers, Update all counts zero and no updater is called.
3. Start Update all for two eligible computers. Expect Updating 1 of 2… on the button and Queued/Updating… on the rows. Close Settings, reopen it and return to Computers: progress stays. Follow [Computers](access.computers.md) for request order, readbacks and failure continuation.
4. Hold the screen through completion/read failures: success/failure outcomes stay. A failed read offers Check updates again. With no remaining offers, the Settings root no longer reports updates ready.
5. With no saved computers, no available/known-latest offers, or installed equal/newer than latest, no update is offered unless a batch runs. A failed initial/refresh read cannot invent an offer; running progress remains through errors and recovers on confirmed outcome.

Automated coverage: `settings-updates.spec.ts` (rules and commands), `settings-update-matrix.spec.ts`.

## Gotchas

- Offer count differs from eligible Update all (n). Mac app self-updates are desktop-only.
- Retain native screenshots/recording and independent updater request logs.
