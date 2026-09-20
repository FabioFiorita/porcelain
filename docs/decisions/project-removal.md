# Explicit project removal

Status: accepted.

Removing a project permanently forgets its inventory and private Porcelain review data in
that environment. It never removes a checkout, changes Git state, or inspects repository files.
Unavailable projects can be removed. Registering the checkout again creates fresh identities
and empty review state; removal is not an archive or undo operation.

The authenticated inventory route is defined in
[the HTTP handler](../../apps/server/src/http/routes/remove-project.ts).
Deletion is safe to retry: the response reports whether a registered project was deleted.
Malformed identities are rejected before application access. Existing authentication, non-cacheable
responses, operation deadlines, cancellation, and sanitized failures apply.

## Data ownership and atomicity

A durable worktree-to-project association survives inventory refresh and worktree disappearance.
The [inventory repository](../../apps/server/src/repositories/inventory-repository.ts) records that
association in the same transaction as inventory updates. This is cleanup ownership, not active
inventory or a promise to restore disappeared worktree identities.

The [removal repository](../../apps/server/src/repositories/project-removal-repository.ts) deletes
owned live and commit review layers, comments, artifacts, project preferences, Git preparations and completed receipts,
then inventory and ownership records in one SQLite transaction. Other projects and the environment
identity survive. Artifact deletion releases logical quota; SQLite file shrinkage and secure
physical erasure are not promised.

This explicit removal overrides retention on inventory disappearance in the
[file preference](file-preferences.md), [artifact](artifact-storage.md), and
[Git action](git-action-contracts.md) decisions. Ordinary refresh still preserves retained data.

## Git operation coordination

Removal is a writer on the project's lane, so an action already running unwinds before removal is
admitted. Because action acceptance happens outside that lane, a submit can persist a running
receipt just before removal deletes it; that queued executor then finds its preparation gone, is
recorded as rejected, launches no Git and resurrects nothing. Successful removal invalidates old
preparations and deletes completed receipts; receipt retries after removal no longer recover the
deleted operation. See the 2026-09-20 amendment below for what removal no longer refuses.

## Evidence

Disposable loopback HTTP coverage exercises registration, stored review data, external worktree
removal, refresh, project removal, restart, and fresh registration. It checks other-project isolation
and unchanged checkout content, Git HEAD, index, and worktree listing. Focused persistence and
application specs cover transaction rollback, unresolved operations, queued
acceptance, and a recovery-block persistence failure. These checks do not establish client UI behavior.

Amended, 2026-09-20 (step 4b): removal is always allowed. It touches no disk and the repository can
be registered again at any time, so a Git action that ended without a confirmed outcome no longer
makes a project unremovable — which it did, for ever, because the recovery that recorded the
unknown outcome never cleared it. The only wait is structural: removal is a writer on the project's
lane, so an action already running finishes first. The removal transaction deletes that project's
refusal latch along with its receipts, preparations and review data, and the coordinator forgets it
in memory. `git_action_blocks` itself stays: it is what stops a second action running against a
repository whose previous process group could not be confirmed dead.
