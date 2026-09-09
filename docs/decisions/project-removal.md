# Explicit project removal

Status: accepted.

Removing a project permanently forgets its inventory and private Porcelain review data in
that environment. It never removes a checkout, changes Git state, or inspects repository files.
Unavailable projects can be removed. Registering the checkout again creates fresh identities
and empty review state; removal is not an archive or undo operation.

The authenticated inventory route is defined in
[the HTTP handler](../../apps/server/src/http/routes/remove-project.ts) and generated API documentation.
Deletion is safe to retry: the response reports whether a registered project was deleted.
Malformed identities are rejected before application access. Existing authentication, non-cacheable
responses, operation deadlines, cancellation, and sanitized failures apply.

## Data ownership and atomicity

A durable worktree-to-project association survives inventory refresh and worktree disappearance.
The [inventory repository](../../apps/server/src/repositories/inventory-repository.ts) records that
association in the same transaction as inventory updates. This is cleanup ownership, not active
inventory or a promise to restore disappeared worktree identities.

The [removal repository](../../apps/server/src/repositories/project-removal-repository.ts) deletes
owned review layers, comments, artifacts, project preferences, Git preparations and completed receipts,
then inventory and ownership records in one SQLite transaction. Other projects and the environment
identity survive. Artifact deletion releases logical quota; SQLite file shrinkage and secure
physical erasure are not promised.

This explicit removal overrides retention on inventory disappearance in the
[file preference](file-preferences.md), [artifact](artifact-storage.md), and
[Git action](git-action-contracts.md) decisions. Ordinary refresh still preserves retained data.
The migration backfills ownership for currently registered worktrees. Older orphan rows whose
worktrees disappeared before ownership was recorded cannot be assigned safely and remain untouched;
there is no inference from paths or deletion of another project's data to reclaim them.

## Git operation coordination

Removal shares the application queue. An active operation must unwind before removal can run.
Because action acceptance happens outside that queue, the removal transaction also rejects running
receipts, including actions accepted behind an already queued removal. Indeterminate receipts and
persisted or in-memory recovery blocks also reject removal with `PROJECT_REMOVAL_BLOCKED`.
Removal must not become a way to discard recovery evidence and bypass an unconfirmed process group.
There is no new recovery/unblock workflow. Successful removal invalidates old preparations and deletes
completed receipts; receipt retries after removal no longer recover the deleted operation.

## Evidence

Disposable loopback HTTP coverage exercises registration, stored review data, external worktree
removal, refresh, project removal, restart, and fresh registration. It checks other-project isolation
and unchanged checkout content, Git HEAD, index, and worktree listing. Focused persistence and
application specs cover migration backfill, transaction rollback, unresolved operations, queued
acceptance, and a recovery-block persistence failure. These checks do not establish client UI behavior.
