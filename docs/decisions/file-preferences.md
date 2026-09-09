# Human file and folder preferences

Status: accepted first slice.

Pin and hide intent belongs to a project ID within its environment. Flags are independent;
paths need not exist and unavailable registered projects remain editable. Preferences do not
edit the filesystem, filter Git Changes, imply recursive flag inheritance, or grant agents a
preference-mutation operation. There is no UI, sharing, or custom ordering in this slice.

`GET /projects/:projectId/file-preferences` lists saved flags in binary path order.
`PUT` at the same route accepts exactly `{ path, flag, value }`, where `flag` is `pinned`
or `hidden` and `value` is boolean. Setting or unsetting a flag is idempotent and leaves the
other flag unchanged. Rows with neither flag are omitted. There is no bulk replacement.
Each project can add paths until it has 2000 saved paths. Adding another path at capacity returns
409 FILE_PREFERENCE_LIMIT_REACHED; updating or clearing existing flags remains available.
Clearing the last flag frees a slot. The repository checks capacity and writes in one immediate
SQLite transaction, so separate writers cannot both claim the final slot.
Both routes require the configured bearer token and a registered project ID, regardless of
availability. Unknown identity is a safe 404 PROJECT_NOT_FOUND. The existing single trusted
principal authentication model applies; separate human and agent credential roles are not
introduced. No MCP operation exposes these preferences.

Paths must already be canonical, slash-separated relative paths of at most 4096 characters. Empty components, dot and
traversal components, backslashes, drive prefixes, NUL, absolute paths, and case-insensitive `.git`
components are rejected. Other colons, such as in `notes:today.txt`, are allowed. Clients must submit this spelling; the server never resolves paths
against the filesystem. File and folder intent share the same path representation.

A dedicated repository and Drizzle table own project preferences. Every linked worktree uses
its owning project's relative-path preferences, including worktrees registered later. Missing paths
retain their intent; there are no worktree overrides. Separate clones have separate project IDs.
Refresh, worktree removal, branch changes, and transient unavailability preserve preferences.
Preference operations snapshot caller intent before entering the application queue and share
application serialization, deadlines, and shutdown behavior.

The migration merges existing worktree preferences through durable project ownership. Each flag is
combined with logical OR, preserving every saved pin and hide. Merged projects may exceed the normal
2000-path admission limit: all existing paths remain editable and removable, but additions wait until
there is capacity. Historical rows without recorded ownership remain in the old table, inaccessible
through the API; no project is inferred from paths and no unknown intent is deleted. Mapped rows are
removed from the old table so there is only one active preference source.

[Explicit project removal](project-removal.md) defines the user-requested deletion exception to retention,
including associated review data and operation recovery constraints.
