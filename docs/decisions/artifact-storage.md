# Authenticated inert artifact storage

Status: accepted bounded storage slice. Rendering and sharing require later design.

HTML artifacts are stored outside Git in the environment SQLite database. A separate `artifacts`
table holds both metadata and content in one row. IDs are server-generated UUIDs; display names are
opaque text, never filenames, storage paths, response headers, or markup. There is no filesystem asset
service, executable HTML response, rendering endpoint, public URL, sharing, or client scaffold.

## Scope and retention

Every operation requires a worktree ID currently present in registered inventory. An unavailable
registered worktree may still access its stored artifacts: storage does not inspect its checkout.
An artifact ID is always matched together with its worktree ID. The configured bearer token grants
access to all registered worktrees; these are context boundaries, not separate user permissions.

Inventory refresh deletes and reinserts worktree rows. Artifact rows therefore deliberately do not
reference those transient rows with a cascading foreign key. Refresh, moves that retain inventory
identity, and server restarts preserve artifacts. Rows for identities removed from inventory remain
stored and count toward quotas, but are inaccessible through these routes. Automatic reclamation,
reassignment, and recovery of such retained artifacts are deferred product decisions; this slice must
not infer destructive cleanup from inventory disappearance.

## Bounds and consistency

One artifact contains 1 byte through 1 MiB of valid UTF-8 text. An environment permits at most 16 MiB
of total content and 256 artifacts, including retained rows. Display names contain 1 through 256
UTF-16 code units and must be well-formed Unicode. Names and HTML may contain path-like strings,
markup, or NUL; they remain data. External references inside HTML are neither fetched nor processed.
The count cap bounds metadata overhead. Content quotas bound logical stored content, not SQLite
file size, journal size, backups, or request memory; deletion makes capacity reusable without promising
filesystem shrinkage. Limits currently live in the server model and are not configurable.

The scoped JSON parser rejects malformed UTF-8 bytes instead of replacing them. Upload validation
also rejects unpaired surrogates, including JSON-escaped ones. The raw request limit is six times the
content limit plus 4096 bytes, allowing worst-case JSON escaping and the bounded name/envelope.
Excessive whitespace or additional envelope overhead may exceed that transport limit.

Quota accounting and insertion occur in one immediate SQLite transaction. Metadata and content
cannot commit separately. Deletion is one atomic SQL statement, so an interrupted or aborted write
cannot leave committed metadata referencing missing content. Existing SQLite recovery handles process
interruption; there is no multi-file recovery protocol. Normal application operations remain serialized
and subject to the application lifecycle. A disconnected client may have an accepted upload committed;
upload retries create new IDs and are not deduplicated. Deletion is safe to retry.

## HTTP contract

All routes authenticate before parsing and use the existing bearer-token trust model. All responses
are non-cacheable. Artifact responses include `X-Content-Type-Options: nosniff`.
Schemas are exported through `@porcelain/contracts/artifacts`; persistence models remain private.

| Method and path | Request | Success |
| --- | --- | --- |
| POST /worktrees/:worktreeId/artifacts | JSON `{ name, content }` | 201 metadata |
| GET /worktrees/:worktreeId/artifacts | None | 200 metadata array, oldest first with ID tie-break |
| GET /worktrees/:worktreeId/artifacts/:artifactId | None | 200 metadata plus content as JSON string |
| DELETE /worktrees/:worktreeId/artifacts/:artifactId | None | 200 `{ deleted: boolean }` |

Retrieval always uses `application/json`, including when the client requests `text/html`. Consumers
must continue to treat `name` and `content` as untrusted data. Rendering isolation, sandbox policy,
assets, public hosting, sharing audience and lifetime remain explicit later design work.

Missing registered worktrees return 404 `WORKTREE_NOT_FOUND`; missing artifact retrieval targets return 404 `NOT_FOUND`. Deleting a missing
artifact within an existing registered worktree returns `{ deleted: false }`, including an ID belonging
to another worktree. A successful deletion returns `{ deleted: true }`; repeated calls converge on the
same absent state. Invalid input or oversized individual content returns 400 `INVALID_REQUEST`;
environment quota exhaustion returns 409 `ARTIFACT_QUOTA_EXCEEDED`. Existing authentication,
application availability, and sanitized unexpected-error responses apply.

Focused evidence covers typed use-case substitutes, disposable SQLite quota/abort/reopen cases,
authenticated HTTP with real Git inventory, a loopback upload, invalid encodings, inert malicious
names/content, worktree isolation, and restart/refresh retention. SQLite statement-abort tests exercise
atomic rollback; they do not simulate power loss or claim platform runtime or rendering proof.

[Explicit project removal](project-removal.md) defines the user-requested deletion exception to retention,
including associated review data and operation recovery constraints.
