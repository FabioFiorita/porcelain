---
screen: /review-changes
selectors:
  - 'All changes'
  - 'review-all-changes'
  - 'Files'
  - 'Loading diff…'
  - "Couldn't load diff"
  - 'Large diff'
  - 'Open the file to see this change.'
  - 'No changes'
  - 'Review unavailable'
tests:
  - apps/mobile/src/features/workspace/rules/changes-page.spec.ts
  - apps/mobile/src/features/workspace/rules/diff-page.spec.ts
api:
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/branch-changes
  - POST /api/worktrees/:worktreeId/changes/diffs
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - GET /api/worktrees/:worktreeId/text
---

# reviews.all-changes

Every changed file of the selected comparison reads as one scrolling page, each diff under a file heading that sticks to the top while its diff scrolls.

## How to get to it (user POV)

- Worktrees → worktree → Changes → All changes, the first row of the Changed files list. It opens the comparison the Changes menu shows (Uncommitted or Branch · base). Native Back returns to Changes.

## Driving it with agent-device

Preconditions: [surface baseline](README.md) with `--fixture development` (its worktree has staged, unstaged and untracked changes).

1. Open All changes. The native title is All changes with the comparison (`Uncommitted` or `Branch · main`) beneath; a caption line counts the changes. Each comparison of a file is its own section in the Changes order: a file with staged and unstaged edits shows two sections, `staged` and `unstaged`. Headings show the file name, folder, comparison and `+added −removed`; untracked files read as added lines. Verify the lines against the server's diffs.
2. Scroll from the first to the last file without tapping: headings stick under the opaque bar while their diff scrolls, diffs appear before they reach the screen, nothing blinks and nothing jumps. With General → Long lines → Scroll, a horizontal drag on a diff pans only that diff and a vertical drag that starts on code scrolls the page. With Wrap, lines wrap and nothing pans sideways.
3. Conflicts, unsupported comparisons, binary and omitted patches, metadata-only changes and diffs above 1,000 rows are one compact row (`Large diff · n lines`, `Binary change`, `Conflict`…) that opens the file screen. A refused diff read shows Couldn't load diff with Retry.
4. Tap a heading: [the file screen](reviews.file.md) opens on that comparison with Mark reviewed and comments. Back returns to the same scroll place.
5. iPhone: the Files top-bar menu lists up to 100 sections with the one at the top checked; choosing one scrolls there. iPad landscape (content at least 700 wide): the section list stays on the left, marks the section at the top as the page scrolls, and tapping one scrolls the page to it; portrait falls back to the iPhone layout. Rotate with the page open.
6. Edit a changed file through the fixture: the page keeps showing the previous diff until the new one arrives, then updates in place. Switch to Branch in Changes and reopen: the page reads the branch comparison. Change workspace: Review unavailable.

Automated coverage: `changes-page.spec.ts` (sections, order, requests) and `diff-page.spec.ts` (compact rows, counts, groups of requests).

## Gotchas

- Files are requested twenty at a time as they approach the screen; the per-file screen keeps its own reading place.
