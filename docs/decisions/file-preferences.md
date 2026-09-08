# Human file and folder preferences

Status: accepted first slice.

Pin and hide intent belongs to a worktree ID within its environment. Flags are independent;
paths need not exist and unavailable registered worktrees remain editable. Preferences do not
edit the filesystem, filter Git Changes, imply recursive flag inheritance, or grant agents a
preference-mutation operation. There is no UI, sharing, or custom ordering in this slice.

`GET /worktrees/:worktreeId/file-preferences` lists saved flags in binary path order.
`PUT` at the same route accepts exactly `{ path, flag, value }`, where `flag` is `pinned`
or `hidden` and `value` is boolean. Setting or unsetting a flag is idempotent and leaves the
other flag unchanged. Rows with neither flag are omitted. There is no bulk replacement.
Each worktree can store at most 2000 paths. Adding another path at capacity returns
409 FILE_PREFERENCE_LIMIT_REACHED; updating or clearing existing flags remains available.
Clearing the last flag frees a slot. The repository checks capacity and writes in one immediate
SQLite transaction, so separate writers cannot both claim the final slot.
Both routes require the configured bearer token and a registered worktree ID, regardless of
availability. Unknown identity is a safe 404 WORKTREE_NOT_FOUND. The existing single trusted
principal authentication model applies; separate human and agent credential roles are not
introduced. No MCP operation exposes these preferences.

Paths must already be canonical, slash-separated relative paths of at most 4096 characters. Empty components, dot and
traversal components, backslashes, drive prefixes, NUL, absolute paths, and case-insensitive `.git`
components are rejected. Other colons, such as in `notes:today.txt`, are allowed. Clients must submit this spelling; the server never resolves paths
against the filesystem. File and folder intent share the same path representation.

A dedicated repository and Drizzle table own preferences. There is deliberately no foreign key
to inventory worktree rows: inventory refresh replaces those rows. Refresh and transient
unavailability must preserve intent. Removed worktree intent is retained without automatic
orphan cleanup, but cannot be accessed through these routes while its identity is unregistered.
Preference operations snapshot caller intent before entering the application queue and share
application serialization, deadlines, and shutdown behavior.
