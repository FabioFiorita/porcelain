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
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.updates

The Worktrees header has a small text-only default Update badge beside filter and the icon-only Closed reviews button. A running shared batch changes its text to Updating…. The badge appears for available offers, including untrusted and unmanaged computers even when eligible N is zero, and disappears with no offers and no running batch. The open native Updates available sheet retains outcomes after completion.

Web and mobile use the same offer/visibility rules: available plus a known latest version, or a running batch for visibility. Equal or newer installed versions reported as unavailable never create an offer. The native title retains Android's medium weight and the existing iOS style, with or without the badge.

1. With a disposable update offer, open Worktrees from Review, Files and History. Expect the small Update badge beside the title, filter and icon-only Closed reviews (the accessible name stays Closed reviews when toggled). Open and close the sheet, toggle Closed reviews twice, then open it again; repeat after changing filters and leaving/revisiting Worktrees. Every badge tap must open the sheet. On iPad the embedded navigator has the same badge and icon action beside search.
2. Tap Update. Expect native BottomSheet Updates available, named computer rows and current → offered version. Each eligible row offers Update; an untrusted row has an expandable lock/Needs trust hint and selectable correct connection ID. An unmanaged row shows the existing outside-installed-service explanation and contributes nothing to Update all (N).
3. With only an untrusted offer, N is zero but Update still opens the sheet. With only an unmanaged offer, repeat; never call its updater. Verify N against the shared eligibility rule, not the displayed offer count.
4. Start Update all with two eligible computers. Expect Updating… in the header and Updating 1 of 2… progress in the sheet. Shared batch state owns ordering, completion, errors and disabled actions. Close/reopen the sheet or leave/revisit Worktrees while running; progress remains. Follow access.computers for real updater request/readback proof and failure continuation.
5. Keep the sheet open through completion: retain success/failure outcomes through service restart/read errors. With no offers after completion, close it and expect the header badge gone. Manage computers closes the sheet and opens Computers; native Back returns through navigation without changing worktree selection.

Capture native screenshots/recording and independent service update request logs. Each platform and connection kind needs explicit evidence.
