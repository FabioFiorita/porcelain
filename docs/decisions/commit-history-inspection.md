# Commit history and inspection

Status: accepted for the read-only history slice.

History lists all ancestors of the selected worktree HEAD in topological order, with 50 commits by
default and at most 100 per page. A cursor captures the full tip object ID and page size; advancing,
resetting, switching, or deleting refs does not change subsequent pages. Detached HEAD is supported.
Unborn HEAD returns an empty result with an explicit unborn state.

Cursors are limited to 4096 characters; an oversized continuation fails with the read-limit error.
Cursors are authenticated with an application-lifetime random key and scoped to environment, project,
and worktree identity. Restarting the application invalidates them. Changes to shallow boundaries or
the Git version invalidate continuation. No refs or objects are retained for pagination; garbage
collection can make a snapshot unavailable. Replacement objects and grafts are ignored. A shallow
repository reports its boundary explicitly, and missing parents never become root commits.

Inspection compares a commit to its first parent unless another one-based parent number is selected.
A root compares against the empty tree for the repository object format. Both SHA-1 and SHA-256 are
supported. Combined merge diffs, arbitrary revisions, branch selection, and file timelines are outside
this slice. Inspection accepts a full commit ID available in the registered repository, including an
object no longer reachable from HEAD; it does not require membership in a currently open listing.

Rename detection uses 50 percent similarity without copy detection. Inspection returns at most 500
changes and 1 MiB of serialized JSON, with no partial success. Binary changes are identified without
returning binary payloads. Submodule changes report the recorded commit change without recursive
inspection. Subjects are limited to 512 UTF-8 bytes with explicit truncation. Other oversized reads fail
explicitly. Invalid UTF-8 data is rejected instead of returning corrupted paths or text.

Reads reuse application serialization and cancellation. Git output is capped at 4 MiB per command and
commands retain the existing ten-second timeout. Offset pagination can repeat traversal work; a deep
page may exceed its execution deadline. No automatic fetch, external diff, text conversion, hooks, or
configured filesystem-monitor program is run. Inventory identity is checked before and after reads;
this detects ordinary checkout replacement but is not an atomic snapshot of externally mutable files.

The shared contracts are exported from `@porcelain/contracts/commit-history` and
`@porcelain/contracts/commit-changes`. Authenticated, uncached GET routes are:

- `/worktrees/:worktreeId/commits`, with optional `limit` or continuation `cursor`.
- `/worktrees/:worktreeId/commits/:oid/changes`, with optional `parent`.

Unknown worktrees return 404 `WORKTREE_NOT_FOUND`; known unavailable worktrees return 422
`REPOSITORY_UNAVAILABLE`. Invalid input or cursors return 400 `INVALID_REQUEST`. Missing snapshot
objects return 422 `HISTORY_SNAPSHOT_UNAVAILABLE`; output limits and unsupported encodings return
422 `READ_LIMIT_EXCEEDED` and `UNSUPPORTED_HISTORY_DATA`. Cancellation and timeouts retain 503
`SERVICE_UNAVAILABLE`. Responses do not expose command diagnostics or server filesystem identities.
