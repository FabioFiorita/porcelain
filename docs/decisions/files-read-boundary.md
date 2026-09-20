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
name using JavaScript string ordering, and never recurse. Names are read as raw bytes and
decoded with fatal UTF-8 validation; an unsupported name fails the complete listing with
`UNSUPPORTED_PATH`, rather than returning replacement characters or ambiguous paths. An oversized listing fails completely;
there are no partial results, cursors or pagination in this slice.

All responses disable caching. Errors contain fixed public codes and messages, never diagnostic
paths, symlink targets, causes or stacks. Authentication runs before validation and application access.
The existing application operation queue and deadline apply; startup, locking and HTTP disconnect
behavior remain governed by their owning decisions.

This slice introduces no preferences, edits, indexing, events or UI. Contracts live at
`@porcelain/contracts/files`; filesystem operations remain a server adapter with explicit injectable
interfaces. Disposable integration specs own filesystem and HTTP proof on supported server platforms.

## Folders on demand, and what a mutation can promise (2026-09-20)

Reading a file or a folder costs no Git process: the worktree is established by re-deriving its id
from the administrative directory's filesystem identity, before and after the read. Opening a
folder is one directory read plus one `git check-ignore` over the entries of that folder, inside
the same verified boundary — the directory is checked again after Git answers, so names can never
be paired with a different checkout. Nothing descends into an ignored directory to discover that it
is ignored, so a folder holding a hundred thousand ignored files costs what any other folder costs;
opening that folder itself still enumerates its own children and refuses past the listing limit.
The whole-tree walk is gone. Quick open reads every name in one `ls-files`, bounded at 50,000 paths
and 4 MiB, decoded with fatal UTF-8 validation, and refuses rather than truncating — a truncated
list would quietly stop finding files that are there.

Mutations are bounded by what Node can express. There is no `openat`, `unlinkat` or `renameat2`, so
an operation cannot be anchored to a verified directory handle, and the promise is stated as what
can actually be kept rather than what would be nicer to claim:

- **Create** refuses an existing name (`O_EXCL`, `mkdir`) and never follows a final symlink
  (`O_NOFOLLOW`). An ancestor replaced between the check and the create can still place the entry
  outside the checkout. The ancestors are checked again immediately afterwards and the request is
  always refused, but the cleanup works by name: if the ancestor has been put back before that
  recheck, the name now leads back inside the checkout and the entry created outside cannot be
  found. It is left behind. That is detection, and repair only when the swap is still in place.
- **Moving a file or a symlink** cannot replace anything at the destination: `link` and `symlink`
  refuse an existing name. The source is confirmed against the entry just created immediately
  before it is unlinked, which is as tight as `unlink` allows — it removes a name, not the entry
  that was checked. An entry substituted in that last gap is the entry removed, and the move
  reports success.
- **Moving a directory** reserves the name with `mkdir` and renames onto it. `rename` refuses a
  file and a non-empty directory, so the only thing it can replace is an empty directory that
  appeared where the reservation was.
- **Writing** refuses content that changed since it was opened, checked immediately before the
  replacement. It is not a lock: a write landing between that check and the rename is lost.
- **Trash** hands a pathname to an implementation that works by name. The entry is checked
  immediately before the handoff and nothing happens in between, but an entry replaced *inside* the
  handoff is the entry that gets trashed. Delete stays recoverable: where this machine has no
  trash, the answer is `TRASH_UNAVAILABLE` and the file is left alone, never unlinked.
- A move across filesystems is refused (`CROSS_DEVICE`) rather than copied, because copy-then-delete
  gives up the atomicity the no-replace step exists for.

Worktree identity is confirmed again after every mutation, before its result is reported. That says
which worktree the change happened in; it cannot undo a change that already happened.
