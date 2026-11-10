---
route: /
selectors:
  - "Review"
  - "Branch"
  - "Uncommitted"
  - " · on the branch"
  - "Reviewed"
  - "Document controls"
tests:
  - apps/web/spec/integration/changes-review-branch.test.tsx
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

The Branch view lists files committed since the selected base, opens their exact diff and keeps their Reviewed marks separate from uncommitted changes. The document bar has Reviewed (R), Open file and Timeline where supported. There are no Comment controls or C shortcut.

Create and commit a topic file in a disposable repository. Open Changes → Branch, choose the base and open the file. Mark it reviewed and check the branch fingerprint through the server. Make an uncommitted edit: its separate worktree mark changes while the branch mark stays current. Commit it: the old branch mark becomes stale. Mark-all handles current fingerprintable files and reports conflicts. Repeat at desktop and phone widths, including non-text files, base switching and returning through Back.
