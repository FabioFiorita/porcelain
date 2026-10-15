---
screen: /review-file
selectors:
  - 'Comment on file'
  - 'Comment on selected lines'
  - 'Clear selection'
  - 'No longer changed'
  - 'Mark reviewed'
tests: []
api:
  - POST /api/worktrees/:worktreeId/changes/diffs
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - GET /api/worktrees/:worktreeId/text
  - PUT /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed
---

# reviews.file

Open a changed file from Review. On iPad, selection opens or activates a workspace tab. The right inspector stays beside the central document when wide; the native inspector control switches between them in narrow panes. Only phones push the native file route. Both presentations use the same file content view, and embedded content keeps the project/worktree navigation title. The existing FileHeader and DiffView show its comparison; untracked files use CodeView. If staged and unstaged comparisons both exist, use the native item menu to select one. Branch reads retain the merge-base and tip OIDs and both rename paths.

Mark reviewed, verify the independent server fingerprint, then unmark it. Mutate the file through the fixture and confirm the previous mark becomes Changed since review. Fingerprint failures disable marking. Stale diff reads use shared-client recovery, and errors offer Read again.

Tap added or deleted source lines in the native renderer to start selection. A second tap on the same side extends from the first line; a tap on the opposite side starts a new selection. Scrolling must not select a line, and tapping any wrapped segment must select its source line. Comment on selected lines presents the native sheet; Clear selection restores whole-file feedback. Verify side, start/end, comparison and fingerprint through comment-threads. A content refresh clears selection. Use Done or sheet dismissal to return to the exact file underneath; an unsent draft retains the existing discard confirmation. On phone file routes, use native Back to return to the list; on iPad, select Overview or another file tab. Closing the active file selects a remaining tab; closing an inactive tab keeps the current selection. An open tab for a file removed from the comparison displays No longer changed without silently selecting another tab.

Binary, metadata-only, omitted, malformed and empty diffs are separate states. Metadata retains the patch without selectable text-line feedback. Conflicts and unsupported comparisons explain why no diff is shown. A file removed from the comparison reads No longer changed. A changed workspace invalidates the old route; iPad restores the selected worktree's own session. Changing inspector comparison or base preserves existing tabs, each with its captured comparison.
