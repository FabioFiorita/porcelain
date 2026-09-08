# Read-only Git working-tree inspection

Status: accepted.

Authenticated `GET /worktrees/:worktreeId/git/status` reads the registered checkout.
`POST /worktrees/:worktreeId/git/diff` reads one ordinary staged or unstaged change selected
by its comparison and old/new relative paths. POST carries a structured read request and
does not mutate Git. Contracts are exported from `@porcelain/contracts/git-status` and
`@porcelain/contracts/git-diff`.

Staged compares HEAD to the index, including additions before the first commit. Unstaged
compares the index to the working tree. A path can occur in both. Rename detection uses
50% similarity, without copy detection; Git's exhaustive rename candidate limit is 2000.
Untracked paths are listed individually, excluding ignored files. Conflicts are listed
separately with their Git conflict category. Neither supports diff retrieval in this slice.
Submodule changes are marked unsupported and their selected diff is explicitly omitted.

Status returns at most 2000 entries. Exceeding that budget or the 8 MiB status command-output
guard returns `413 INSPECTION_LIMIT`, never an incomplete success. A selected patch is limited
to 1 MiB of Git output; an oversized patch returns `omitted: size-limit`. Binary results
contain no binary payload. Unsupported text encoding returns `omitted: unsupported-encoding`.
Metadata-only patches preserve mode and rename information. These limits bound output and
transport, not Git's internal memory use; the existing operation deadline also applies.

Paths must be representable losslessly as UTF-8. Invalid path encoding returns
`422 UNSUPPORTED_PATH_ENCODING`; replacement characters must not change a file's identity.
Paths retain Git's spelling, including spaces, tabs, newlines and literal pathspec characters.
Diffs disable external helpers, text conversion and replacement objects. Inspection uses no
optional Git locks and verifies both registered checkout and common repository metadata
identities before and after reads. Exact endpoint pathspecs exclude unrelated descendants
when a file is replaced by a directory.

Reads are best-effort observations, not snapshots. The opaque status token hashes the
porcelain status observation, including HEAD and index information. It is not a file-content
digest or a durable revision. Diff requests require that token and a selection present in
fresh status. A different observation before or after diff generation returns
`409 WORKTREE_CHANGED`; the caller refreshes status before retrying. External edits can
preserve status output, race individual Git reads, or change and revert between checks.
Matching tokens do not establish immutable content or atomicity.

Missing registered identities return `404 WORKTREE_NOT_FOUND`. Unavailable checkouts retain
the existing repository error mapping. Authentication, no-cache responses, operation
serialization/deadlines and safe error responses follow the inventory HTTP boundary.
No polling, live events, client UI, review layers, staging or commit operations are introduced.
