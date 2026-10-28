---
route: /
selectors:
  - 'All changes'
  - 'Collapse all'
  - 'Expand all'
  - 'Mark all'
  - 'No changes to review'
  - 'uncommitted changes'
  - 'reviewed'
tests:
  - apps/web/spec/integration/reviews-all-changes.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.all-changes

All changes opens one scrollable document of every current changed file, also with a published review.

## How to get to it (user POV)

- Review (sheet at phone width, dialog "Worktree review") → tab "Review" → nav "Walkthrough" → button "All changes".
- With no review published, the handoff tab "Changes" is the same document under the "No review yet" introduction.

The document is a centred reading column (760px, 28px gutters; 16px in a narrow pane). Above the diffs, region "n uncommitted changes" (or "n uncommitted spec changes" on Specs) has a header with that count and "r of n files reviewed", with a File review actions popover on that progress count containing Collapse all/Expand all and Mark all reviewed, then one 32px row per file: checkbox "<path> reviewed", and a button with the path (folder muted) and its −deletions +additions that unfolds and scrolls to the file's diff and carries `aria-current` for the current file. The selected file stays current when other diffs finish loading. File review actions stays open while file content refreshes.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `$C start --review-sample`. Before loading, remove `"$REPO/packages/workspace/src/actor.ts"` and append a line to `"$REPO/tests/publish-note.spec.ts"`. Expect five current changes: deleted actor, policy, revoke-access, unexplained migration and spec. The retained revision inventory is separate.

It includes unexplained files, deleted files and specs. With a review published, the files come in walkthrough order, each with the name of its stop beside it ("<n>. <decision title>", "Not explained" or "Specs"), and the agent's notes carry decision-numbered markers such as "1.2". Each file can be collapsed and marked reviewed; the bulk mark covers the same complete file set. Unsupported content is listed, not silently removed.

1. Open Review → tab "Review" → button "All changes".
   Expect: the All changes document with heading "5 uncommitted changes", five rows and a progress button "File review actions: 0 of 5 files reviewed". Open it to reach "Mark all 5 files reviewed". The revoke-access change retains its decision's agent notes.
2. Click "Collapse all", scroll to the end and expand an individual file.
   Expect: all five paths, including the removed packages/workspace/src/actor.ts, scripts/migrate-workspaces.ts and tests/publish-note.spec.ts. Expanding a file restores its content.
3. Open File review actions if closed, then click "Mark all 5 files reviewed" and wait for "Unmark all" to become enabled.
   Expect: `$C server reviewed-files` holds exactly those five marks. The bulk action records current-file marks, not a reviewed decision on the retained revision.
4. Click "Unmark all" and wait for "Mark all 5 files reviewed" to become enabled.
   Expect: `$C server reviewed-files` holds no marks.
5. Reload the All changes document. Repeat at 414 × 896.
   Expect: its complete file count, bulk actions and file folding stay reachable. The separate Specs document is covered by [reviews.spec-files](reviews.spec-files.md).

### Observable proof

Read independent server marks after each bulk action; Specs-document marking must exclude ordinary files.

Automated coverage: `reviews-all-changes.test.tsx`.

### Clean worktree

With the default fixture and no review published, commit the sample edit in the disposable repository before loading the page. The permanent Changes tab shows "No changes to review" and the branch name followed by "matches its last commit. Browse files or history from the right." It cannot close with Alt+W and has no Close Changes button.

Use the Files or History button inside the notice. Its shortcut hint comes from the shared shortcuts. The selected panel opens even when it was hidden. Escape closes the phone sheet and returns focus to the notice button that opened it. At desktop width, Files and History remain in the docked panel. Repeat at 1440 and 414, light and dark.

Automated coverage: `reviews-all-changes.test.tsx`, "a clean worktree keeps Changes open and reaches Files/History from its notice".

## Gotchas

- The bulk count leaves out current files already reviewed. Unmark first if the fixture has marks from an earlier run.
- Files committed in a retained review are not all current worktree changes. Use the retained walkthrough to read the complete published revision.

Changes diff cards use the shared token syntax theme, 12.5px/22px code, a 40px muted header with a reviewed toggle, collapse control and Previous file / Next file buttons (K/J). Click the comparison label (for example "unstaged · modified", or the Comment icon in a narrow pane) to comment on that file; its accessible name remains "Comment on <path> (<note>)".
