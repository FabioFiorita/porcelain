# Ordered review-layer metadata

Status: implemented storage boundary; commit association below is a proposal.

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
slash-separated strings, with no empty, dot, parent, control-character, backslash or colon components.
This deliberately portable grammar excludes some legal platform filenames; references are not patterns.

The separate persistence owner stores an ordered JSON snapshot and revision in one SQLite row.
An immediate transaction checks the revision and replaces the row, also protecting writers on separate
connections. The application validates and copies inputs before queuing updates. Metadata never
reads files or Git and cannot assert whether a reference currently exists or changed. Changes remains
authoritative and must show unassigned changes; a layer set never claims to exhaust Git changes.

Metadata uses stable worktree IDs without foreign keys into replaceable inventory rows. Refresh,
unavailability, and removal from active inventory retain existing sets. Retained sets remain readable
and editable by their ID; a new set requires a currently registered worktree. No garbage collection is
introduced. Re-registration with a different identity does not inherit a previous worktree's metadata.

## Proposed commit association — agreement required

Introduce immutable association records keyed by environment, project, full commit OID, source worktree
ID and source layer revision. Snapshot layer IDs, titles and order, plus the exact subset of references
matched to each commit. Preserve the live set independently. Never bind by clean-worktree state alone.

For commits created outside Porcelain, a future Git reconciliation owner compares parent-to-commit
changes against captured source content identities. A unique match can be proposed for association;
ambiguous matches remain pending explicit confirmation. Renames require explicit source/target evidence.
For split commits, associate only matched references and retain the remaining references for later
commits. Partial-file commits require hunk/content identities beyond this path-level schema; do not
silently attach the entire file or layer. Concurrent layer revisions must never rewrite an existing
commit snapshot. Amend/rebase produces distinct OIDs and requires new association evidence; retain old
records rather than silently moving them. Merge commits require an agreed parent interpretation.

Agreement is still needed on automatic versus confirmed matching, hunk identity, ambiguous/external
commit recovery, and retention. None of this association, Git discovery, UI, MCP, or agent execution is
implemented by this metadata slice.
