---
screen: /review-file
selectors:
  - "Comment on file"
  - "Comment on selected lines"
  - "Clear selection"
  - "No longer changed"
  - "Mark reviewed"
tests:
  - apps/mobile/spec/e2e/review.e2e.ts
api:
  - POST /api/worktrees/:worktreeId/changes/diffs
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - GET /api/worktrees/:worktreeId/text
  - PUT /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed
---

# reviews.file

Open a changed file from Review. The existing FileHeader and DiffView show its comparison; untracked files use CodeView. If staged and unstaged comparisons both exist, use the native item menu to select one. Branch reads retain the merge-base and tip OIDs and both rename paths.

Mark reviewed, verify the independent server fingerprint, then unmark it. Mutate the file through the fixture and confirm the previous mark becomes Changed since review. Fingerprint failures disable marking. Stale diff reads use shared-client recovery, and errors offer Read again.

Select added or deleted lines in the native renderer. Comment on selected lines presents the native sheet; Clear selection restores whole-file feedback. Verify side, start/end, comparison and fingerprint through comment-threads. A content refresh clears selection. Use Done and the native Back gesture to return to the file and list.

Binary, metadata-only, omitted, malformed and empty diffs are separate states. Metadata retains the patch without selectable text-line feedback. Conflicts and unsupported comparisons explain why no diff is shown. A file removed from the comparison reads No longer changed. A changed workspace invalidates the old route.
