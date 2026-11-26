---
screen: /merge-pull-request
selectors:
  - 'Pull request unavailable'
  - 'Squash and merge'
  - 'Create a merge commit'
  - 'Rebase and merge'
  - 'Done'
  - 'spinner'
tests:
  - packages/client/src/features/projects/rules/pull-request.spec.ts
  - apps/mobile/src/shared/adapters/demo-transport.spec.ts
api:
  - GET /api/projects/:projectId/pull-requests/:number
  - GET /api/projects/:projectId/pull-requests/:number/status
  - POST /api/projects/:projectId/pull-requests/:number/merge
---

# reviews.merge-pull-request

The Merge sheet confirms one merge. It computes the same block as the pull request page (one client rule, including undecided Walkthrough calls at the head), offers only the merge methods the repository allows, pins the head it shows and merges that head.

## How to get to it (user POV)

- Pull request page → Merge. From the end of the Walkthrough, Merge #n. The route is `/merge-pull-request?environment=&projectId=&number=`.

## Driving it with agent-device

Preconditions: [surface baseline](README.md) with the pull request fixture of [the pull request page](reviews.pull-request.md), or the demo's Pull request #7 (Lint fails until Re-run failed jobs; then Merge works).

1. The sheet title is `Merge #n`. The line `<head> at <short sha> goes into <base> on GitHub. A merge cannot be undone.` names the pinned head.
2. With more than one allowed method, a list chooses it; the button is named after the method (`Squash and merge`, …). One allowed method shows no list.
3. While anything blocks, one line says why with its state icon and the button is disabled: failing or running checks, conflicts, draft, no allowed method, an undecided call, the computer offline. When new commits arrive after the sheet opened, it says so and refuses until reopened.
4. Merge: the button shows its pending state; a refusal appears under it. Success shows `Merged #n into <base>.`, the existing Archive offer and Done, and the notification `Merged #n`. The pull request page behind shows Merged.

Verify an Android phone and tablet, portrait and landscape; report iOS separately.

## Gotchas

- The head is pinned once the status read answers; the merge request carries that head, so GitHub refuses a head the person did not see.
