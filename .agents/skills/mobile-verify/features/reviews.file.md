---
screen: /review-file
selectors:
  - "Comment on file"
  - "Comment on selected lines"
  - "Clear selection"
  - "No longer changed"
  - "Mark reviewed"
tests: []
api:
  - POST /api/worktrees/:worktreeId/changes/diffs
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - GET /api/worktrees/:worktreeId/text
  - PUT /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed
---

# reviews.file

Open a changed file from Review. On iPad, selection opens or activates a workspace tab. Wide panes display its content beside navigation; narrow panes show it in place and expose a Changed files control to return to navigation. Only phones push the native file route. Both presentations use the same file content view, and embedded content keeps the Review navigation title. The existing FileHeader and DiffView show its comparison; untracked files use CodeView. If staged and unstaged comparisons both exist, use the native item menu to select one. Branch reads retain the merge-base and tip OIDs and both rename paths.

Mark reviewed, verify the independent server fingerprint, then unmark it. Mutate the file through the fixture and confirm the previous mark becomes Changed since review. Fingerprint failures disable marking. Stale diff reads use shared-client recovery, and errors offer Read again.

Select added or deleted lines in the native renderer. Comment on selected lines presents the native sheet; Clear selection restores whole-file feedback. Verify side, start/end, comparison and fingerprint through comment-threads. A content refresh clears selection. Use Done or sheet dismissal to return to the exact file underneath; an unsent draft retains the existing discard confirmation. On phone file routes, use native Back to return to the list; on iPad, select Overview or another file tab. Closing the active file selects a remaining tab; closing an inactive tab keeps the current selection. An open tab for a file removed from the comparison displays No longer changed without silently selecting another tab.

Binary, metadata-only, omitted, malformed and empty diffs are separate states. Metadata retains the patch without selectable text-line feedback. Conflicts and unsupported comparisons explain why no diff is shown. A file removed from the comparison reads No longer changed. A changed workspace invalidates the old route and resets the iPad tabs. Changing comparison or base also resets the iPad tabs to Overview.
