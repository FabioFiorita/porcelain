---
screen: /workspaces
selectors:
  - 'Updates available'
  - 'Updating…'
  - 'Manage computers'
  - 'Needs trust'
  - 'Closed reviews'
tests:
  - packages/client/src/features/access/rules/settings-updates.spec.ts
  - packages/client/src/features/access/commands/settings-updates.spec.ts
  - packages/client/src/features/access/queries/settings-update-matrix.spec.ts
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.updates

Worktrees offers Update for available computer updates and retains batch progress and outcomes in a native sheet.

## How to get to it (user POV)

- Worktrees from Review, Files or History → Update badge. iPad uses the embedded navigator.
- Updates available → Manage computers; native Back returns.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Precondition: use the disposable `state/service-update-fixture.json` control in [service updates](../../web-verify/features/access.service-update.md) to seed offers.

1. From Review, Files and History open Worktrees. With an offer expect text-only Update centered beside the Worktrees title, then icon-only Filter and Closed reviews. On Android compare Worktrees with the native Files and Settings titles: size, weight and baseline match with or without the badge. Retain a pixel measurement in light and dark. Tap repeatedly after closing/reopening, toggling Closed, filtering and leaving/returning: Updates available always opens. Repeat in iPad's navigator.
2. Inspect computer rows and current → offered version. Eligible rows have Update; untrusted rows have expandable Needs trust and the correct selectable connection ID; unmanaged computers show their explanation in Computers and create no offer badge. With only untrusted offers the badge stays, eligible N is zero and no updater is called.
3. Start Update all for two eligible computers. Expect Updating… in the header and Updating 1 of 2… in the sheet. Close/reopen or leave Worktrees: progress stays. Follow [Computers](access.computers.md) for request order, readbacks and failure continuation.
4. Hold the sheet through completion/read failures: success/failure outcomes stay. With no remaining offers, close it: the badge disappears. Manage computers closes it and opens Computers; native Back preserves workspace selection.
5. With no saved computers, no available/known-latest offers, or installed equal/newer than latest, show no badge unless a batch runs. A failed initial/refresh read cannot invent an offer; running progress remains through errors and recovers on confirmed outcome.

Automated coverage: `settings-updates.spec.ts`, `settings-updates.spec.ts`, `settings-update-matrix.spec.ts`.

## Gotchas

- Offer count differs from eligible Update all (N). Mac app self-updates are desktop-only.
- Retain native screenshots/recording and independent updater request logs; the badge must not alter native title weight or crowd the filter/Closed controls.
