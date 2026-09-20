# Ordered review-layer metadata

Status: implemented live storage and explicit commit association boundaries.

A worktree has one layer set with a monotonically increasing revision. Layer UUIDs are
caller-generated stable identities; titles describe intent. JSON array positions explicitly define
layer and file order. PUT replaces the complete set atomically, including removals and reorderings;
`expectedRevision` must match or the server returns 409. Reload and reconcile before retrying.
The initial empty set has revision zero; clearing an existing set increments its revision.
This API does not identify authors: the configured bearer token is the existing trusted principal.

Authenticated GET and PUT `/worktrees/:worktreeId/review-layers` return
`{ worktreeId, revision, layers }`. PUT accepts `{ expectedRevision, layers }`.
Each layer has `{ id, title, summary?, files }`; `summary`, when present, is Markdown limited to
16,000 characters. Each reference has `{ path, scope, note? }`, where scope is `staged` or
`unstaged`; `note`, when present, is limited to 2,000 characters. Unknown worktrees without stored
metadata return 404. Responses disable caching and expose safe errors. Request bodies are limited to
1 MiB; contracts additionally bound 100 layers, 500 references per layer, 2000 references total,
200-character trimmed titles, and 4096-character paths. UUIDs are unique within the set.
Path/scope pairs are unique across all layers;
the same path may appear once in each scope. Paths are literal, case-sensitive, repository-relative
slash-separated strings, with no empty, dot, parent or case-insensitive `.git` components.
NUL, backslashes and leading drive prefixes are rejected; tabs, newlines and other colons are allowed.
This grammar matches the other file metadata surfaces; references are not patterns.

The separate persistence owner stores an ordered JSON snapshot and revision in one SQLite row.
An immediate transaction checks the revision and replaces the row, also protecting writers on separate
connections. The application validates and copies inputs before queuing updates. Metadata never
reads files or Git and cannot assert whether a reference currently exists or changed. Changes remains
authoritative and must show unassigned changes; a layer set never claims to exhaust Git changes.

Metadata uses stable worktree IDs without foreign keys into replaceable inventory rows. Refresh,
unavailability, and removal from active inventory retain existing sets. Retained sets remain readable
and editable by their ID; a new set requires a currently registered worktree. No garbage collection is
introduced. Re-registration with a different identity does not inherit a previous worktree's metadata.

## Explicit commit association

A project may store one immutable review-layer snapshot per full commit OID. Linked worktrees
read the same snapshot; separate clones and environments do not share it. The snapshot records
the source worktree ID, source layer revision and the chosen one-based comparison parent.
Parent one is the default; a root uses the empty tree. A different parent interpretation requires
a different design rather than silently replacing the existing snapshot.

Association is an explicit caller assertion of review order for selected committed file diffs.
The caller supplies a current source revision and a nonempty subset of its path/scope references.
The server copies the selected layers, titles and references in source order, omitting empty layers.
Request selection order never changes review order. A committed path may be selected only once,
even when the live set references both staged and unstaged changes. Saved scope flags describe the
source selection, not a staging state of the commit.

## Per-commit review layers, removed (2026-09-20)

A commit used to keep a copy of the layers it carried, readable at
`GET /api/projects/:projectId/commits/:oid/review-layers` and writable by an association endpoint
the web never called. Step 5c removed that surface: both routes, the repository, the contracts, and
the "Archived review notes" the commit document drew.

What a commit still does is clear the live layers it carried, so a worktree stops asking to be
reviewed for work that has been committed
([completion](../../apps/server/src/use-cases/complete-commit-review.ts)). That belongs to the live
layer set's own lifecycle and is unchanged; it now reads the commit's file list, which costs one
Git process rather than nine.

The `commit_review_layer_sets` table stays. Nothing reads it, and removing a project still clears
its rows, but an upgrade does not destroy layers a reader may still have. Dropping the table is a
separate decision about data somebody may still want, and needs its own migration.
