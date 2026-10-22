---
screen: /review
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Review'
  - 'Select a worktree to continue.'
  - 'No changes'
  - 'Open review overview'
  - 'Read agent summary'
  - 'Return to walkthrough'
  - 'Show whole file'
  - 'Show relevant range'
  - 'No agent review'
  - 'No walkthrough decisions'
  - 'Mark decision reviewed'
  - 'Unmark decision reviewed'
  - 'Mark remaining files and continue'
  - 'Review progress is unavailable.'
  - 'Mark available files reviewed'
  - 'Review unavailable'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/reviews/rules/pointer-source.spec.ts
  - packages/client/src/features/reviews/queries/publication.spec.ts
  - packages/client/src/features/reviews/commands/decisions.spec.ts
  - packages/client/src/features/reviews/rules/walkthrough.spec.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed-layers
  - DELETE /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - GET /api/worktrees/:worktreeId/comments
---

# reviews.review

Review shows the selected worktree’s changes, reviewed status, published decisions and comments, with independent Uncommitted and Branch comparisons.

## How to get to it (user POV)

- Phone Review tab; iPad Review inspector → Overview or changed file.
- `porcelain.dev://review`; Files remains the default launch destination.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. With no worktree expect Select a worktree to continue. Pair/select the focused sample; expect Review README.md. Open it, then phone Back or iPad Overview returns. On iPad open Overview/two files; inspector switches and Comments → Done retain central tabs/selection.
2. Choose Branch and a base from Uncommitted. Newly opened tabs capture that comparison; old tabs/anchors stay. Switch worktrees/back: each restores tabs/comparison/mode. Independently change content: live list/marks update, prior fingerprint becomes Changed since review, clean worktree says No changes.
3. Stop/revoke the fixture: error/unavailable state permits no old-workspace writes. Recover through Read again in the phone toolbar/iPad navigator. Switch Files/back and cold-launch through Metro: selected workspace stays.

### Overview and walkthrough

Precondition: `--fixture development`. Expect decisions in publication order: Keep document holds visible; Filter completed deliveries; Explain the dispatch handoff.

1. Open each decision; Next/Previous move stops. Read a pointer: path/range/source numbers, Show whole file/Show relevant range. Open its diff then Back/iPad Review tab returns to that decision/pointer. Read agent summary shows supplied HTML without scripts/remote assets; Return to walkthrough restores the stop.
2. Switch worktrees/back: same review restores its stop without leaks. A new revision starts its briefing; Branch/Uncommitted remain independent. No publication says No agent review; no decisions says No walkthrough decisions. Loading/failure shows state/Read again; Refresh review retries publication and expired summary links.
3. On iPad fail/hold changed-file reads: saved decisions remain usable, with separate loading/error and Read again. Unknown coverage cannot look empty. Retry restores Not explained/diff links. Missing worktree shows saved-review diagnostics and disables code pointers.

### Completion and progress

Precondition: publish multiple decisions, one shared file, a fileless decision and an unexplained file.

1. Shared files appear once under their owning stop; Open owning stop returns there. A completed decision requires all owned files and its decision mark. Mark, then read reviewed-files/reviewed-layers independently. Unmark a file: badge/count clears but decision mark stays. Mark decision reviewed fills missing file marks; Unmark decision reviewed removes only its decision mark.
2. Mark remaining files and continue writes files before the decision and advances (overview at end). Opening code/diffs writes no marks; individual file controls remain available.
3. Refuse one bulk write with a stale fingerprint: successful file marks remain, refusal displays, same stop stays and no new decision mark appears. Pending/failed marks hide completion and disable controls; Read again recovers.
4. Use an unavailable fingerprint (e.g. 66 MiB file): name/explanation keeps stop open. Mark available files reviewed keeps readable marks without advancing/marking the decision. With none available, Review unavailable is disabled. Make the file readable: ordinary completion returns.
5. Commit/republish to change a published decision fingerprint; dirty edits change only worktree marks/proof freshness. Reconnect and switch worktrees/comparisons; compare literal marks/counts with an authorized web client. Check overview, summary, range and navigation labels at larger text sizes, Android light/dark, and iPad landscape/portrait.

Automated coverage: `workspace-selection.spec.ts`, `pointer-source.spec.ts`, `publication.spec.ts`, `decisions.spec.ts`, `walkthrough.spec.ts`.

## Gotchas

- Pointer code can differ from retained excerpts: broken pointers explain unavailability; moved snippets warn and are not highlighted as current. Changed-file diffs are separate.
- A wide phone/Android retains compact routes; iPad pane width excludes its sidebar. Resize across the threshold without changing central tabs.
- The development fixture commits before publication and requires a verdict; optional proof uses pass/fail. Signed summary HTML is outside the `/api/` frontmatter format.
- Shared inventory recovery is in [Worktrees](projects.workspace-picker.md#driving-it-with-agent-device).
