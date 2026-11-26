---
route: /
selectors:
  - 'Review'
  - 'Branch'
  - 'Uncommitted'
  - ' · on the branch'
  - 'Reviewed'
  - 'Document controls'
tests:
  - apps/web/spec/integration/changes-review-branch.test.tsx
  - apps/web/spec/integration/changes-presentation.test.tsx
  - apps/web/spec/integration/changes-branch-marks.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/reviewed
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# changes.review-branch

The Branch view lists files committed since the selected base, opens their exact diff and keeps their Reviewed marks separate from uncommitted changes. Plain Branch and Uncommitted Changes use the same reading column, so toggling the comparison keeps code aligned and at the same width. Guided step views and individual file tabs retain their existing layout, and the developer’s long-line preference remains in force. The document bar has Reviewed (R), Open file and Timeline where supported. Diff gutters and file actions can start a draft comment. The Changes panel shows open comment counts by file and the Review and publish entry opens the shared draft list.

Create and commit a topic file in a disposable repository. Open Changes → Branch, choose the base and open the file. Mark it reviewed and check the branch fingerprint through the server. Make an uncommitted edit: its separate worktree mark changes while the branch mark stays current. Commit it: the old branch mark becomes stale. Mark-all handles current fingerprintable files and reports conflicts. Repeat at desktop and phone widths, including non-text files, base switching and returning through Back.

At a wide desktop viewport, use a branch with a committed file and a later local edit. Compare Changes → Uncommitted and Changes → Branch: the rendered code has the same left and right edges. Return to Uncommitted and confirm the local edit is still displayed. The shared width does not change Branch's diff rendering or reading position when a later commit arrives; exercise the pagination and reading-position journey in [branch read more](changes.branch-read-more.md).

At compact pane widths, Uncommitted and Branch use icons with selected styles and accessible names. Hover or keyboard-focus either icon for its label; the selected mode tooltip adds "(current comparison)". The Compare tablist describes the current mode. See [workspace shell](reviews.workspace-shell.md) for narrow-tab and tooltip proof.
