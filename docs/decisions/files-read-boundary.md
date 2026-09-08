# Files: bounded worktree reads

Status: accepted.

Authenticated `GET /worktrees/:worktreeId/directory?path=` lists one directory;
`GET /worktrees/:worktreeId/text?path=src/app.ts` reads one UTF-8 regular file.
The environment owns registration and filesystem access. Clients supply a worktree ID and a relative
slash-separated path, never a root. An empty path selects the root only for directory listing.
Unknown fields, traversal components, absolute paths, backslashes and NUL are invalid requests.

Use cases check inventory availability and current Git repository/worktree metadata identity before
and after reading. Missing or replaced checkouts require an inventory refresh; reads do not update
inventory. The filesystem adapter rejects symlink traversal, including in-root and dangling links.
Operations exclude `.git` components case-insensitively. Listings identify links without exposing targets.
Dotfiles and ignored files otherwise remain visible. Sockets, devices and pipes cannot be read as text.

The server assumes trusted local writers. Component checks, canonical path checks, no-follow file
opening, handle-based reads and before/after identity/metadata checks reject observed changes.
These checks do not establish containment against hostile concurrent ancestor swaps, hard-link
provenance, mounts, or arbitrary filesystem restoration. Results are observations, not atomic snapshots.
`CONTENT_CHANGED` asks the client to retry; concurrent modifications may also produce a missing-path
or unreadable-path response before a stable observation has been established.

Text reads accept valid UTF-8 without NUL and preserve BOM and line endings. Both raw file bytes and
serialized successful responses are limited to 1 MiB; escaping or response metadata can make a file
below 1 MiB exceed the response limit. Directory listings contain at most 2,000 entries, sorted by
name using JavaScript string ordering, and never recurse. An oversized listing fails completely;
there are no partial results, cursors or pagination in this slice.

All responses disable caching. Errors contain fixed public codes and messages, never diagnostic
paths, symlink targets, causes or stacks. Authentication runs before validation and application access.
The existing application operation queue and deadline apply; startup, locking and HTTP disconnect
behavior remain governed by their owning decisions.

This slice introduces no preferences, edits, indexing, events or UI. Contracts live at
`@porcelain/contracts/files`; filesystem operations remain a server adapter with explicit injectable
interfaces. Disposable integration specs own filesystem and HTTP proof on supported server platforms.
