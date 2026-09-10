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
Each layer has `{ id, title, files }`; each reference has `{ path, scope }`, where scope is
`staged` or `unstaged`. Unknown worktrees without stored metadata return 404. Responses disable
caching and expose safe errors. Request bodies are limited to 1 MiB; contracts additionally bound
100 layers, 500 references per layer, 2000 references total, 200-character trimmed titles, and
4096-character paths. UUIDs are unique within the set. Path/scope pairs are unique across all layers;
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

Before saving, the server inspects the immutable commit against the chosen parent in the source
worktree's project. Selected paths must occur in that comparison. Renames use their destination
path, deletions their old path. This verifies committed-path membership, not content equivalence
with the source worktree. For a partial-file commit the ordering applies only to that commit's diff;
it makes no claim that all source-file edits were committed. Unassigned committed changes remain
available through the existing commit inspection API.

The live layer set is retained independently. An explicit subset can be associated with each split
commit, and one source revision can describe multiple commits. A later layer edit cannot rewrite
a saved snapshot. Source revision and project ownership are checked again in the same immediate
SQLite transaction that inserts the snapshot, rejecting concurrent source changes or project removal.

Identical association retries return the saved snapshot even if the live revision changed, the
source worktree disappeared, or the checkout became unavailable. Changed source, revision, parent
or reference selection returns a conflict. The snapshot has no edit/delete operation beyond explicit
project removal. Refresh, worktree disappearance, restart and Git garbage collection retain metadata;
retention does not keep Git objects alive or guarantee the commit diff remains inspectable.

The authenticated routes are owned by
[association](../../apps/server/src/http/routes/associate-commit-review-layers.ts) and
[retrieval](../../apps/server/src/http/routes/get-commit-review-layers.ts).
Retrieval requires a registered project but no available checkout; an unassociated commit returns
null without asserting that the Git object exists. New associations require an available registered
source worktree. Requests and snapshots use bounded contracts; at most 500 unique committed paths
can be selected, within the existing live-layer and Git inspection limits.

This slice supports explicit association of commits created inside or outside Porcelain. Automatic
association during commit execution or external Git reconciliation is deferred: it needs captured
content/hunk identities and an agreed ambiguity policy. Amend and rebase create distinct OIDs with
no inherited association. There is no content matching, automatic consumption of live references,
UI, MCP, or agent execution in this boundary.
