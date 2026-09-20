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

Inspection disables lazy fetching and terminal prompts. Missing promised objects fail locally;
inspection does not fetch objects or run remote/credential helpers. Before status or a working-tree
diff, effective Git configuration is inspected without converting files. Tracked paths assigned any named
filter driver cause `422 UNSUPPORTED_GIT_FILTERS`, even if its command is not configured yet.
Unused configured drivers do not prevent inspection. Discovered driver commands are disabled for the read, and assignments are checked again
afterward; inspection never silently reports unconverted content as Git-normalized content. Submodule working directories
are not inspected (`--ignore-submodules=dirty`); staged gitlinks and changed submodule commits remain
explicitly unsupported, while dirty files inside a submodule are outside this slice.

Configuration checks assume trusted local writers and remain best-effort. Known driver overrides
prevent an attributes-only edit from launching a discovered helper. They do not isolate Git
configuration: a hostile concurrent writer introducing both a new driver command and its attribute
assignment between checks can bypass that protection. Inspection is not a sandbox for adversarial
repository/configuration writers and does not claim race-proof helper suppression.

Reads are best-effort observations, not snapshots. The opaque status token hashes the
porcelain status observation, including HEAD and index information. It is not a file-content
digest or a durable revision. Diff requests require that token and selections present in
fresh status, so a diff keyed only by path cannot answer about a file that has since been
renamed. A different observation returns `409 WORKTREE_CHANGED`; the caller refreshes the
change list before retrying. External edits can preserve status output, race individual Git
reads, or change and revert between checks. Matching tokens do not establish immutable content
or atomicity.

A change-list response is one observation. The status is read once and the token it returns is
what a later diff or mark must present; nothing re-reads the status to prove that list was still
true as it was sent, because that proves nothing about the moment the reader acts on it. A diff
response is different, and re-reads deliberately: it carries content Git captured at some instant,
so it is bound to what was read rather than merely preceded by a check. What every response
confirms before it leaves is the checkout's identity, re-read from the filesystem at no Git cost.

Reading what changed carries no content, so its cost does not grow with the size of the change:
one status, and no Git at all for the working side. A working file is digested from its bytes
through the filesystem boundary, which follows no link and costs no process; hashing through Git
was tried and broke on the first filename containing a newline. Only a moved submodule pointer
asks Git, because a submodule is a directory and the status prints the same gitlink on both sides.

The hunks are a separate request for the files a reader has opened, and that request is one
`git diff` per scope however many files it names. `--raw -z` is asked for alongside the patch, so
the same process states which files it is about to print and in what order with unquoted paths,
and sections are taken by position rather than by matching a header Git may have had to quote. A
scope larger than one response may carry answers with bounded omissions rather than a process per
file. Binary changes are recognized from Git's `Binary files ... differ` patch line.

That request also carries the fingerprint the caller holds for every path it asks about. The
status token cannot stand in for them: it hashes what porcelain status prints, which says nothing
about the bytes of a file that was already modified, so editing such a file again leaves the token
identical while the patch changes. The fingerprints are established again before the diff is read
and once more afterwards, against a fresh observation, so the hunks returned are bound to the
fingerprint returned with them rather than merely preceded by it.

Equal content on both sides of that read is not enough on its own. A file written to something
else, captured by Git, and written back reads the same and fingerprints the same, while the hunks
describe a state that no longer exists. So everything the read looked at — each working path and
the checkout's index, which a staged diff reads the same way — is also stamped by identity, size
and change time, and the answer is refused when a stamp moves. Change time is the part that
matters: an ordinary write always moves it, and the owner of a file cannot set it backwards the
way they can set a modification time.

A fingerprint is per logical path and covers every comparison of it, because a file can be
staged and then edited again: a fingerprint over one side would let the other be marked unseen.
It includes both modes, a symlink's literal target rather than what it points at, and a
submodule's recorded commit — what changed inside a submodule is outside the parent's review.
A binary file has an object id like anything else and stays markable; `null` means only that a
side could not be established at all, and a `null` fingerprint can never be marked.

Missing registered identities return `404 WORKTREE_NOT_FOUND`. Unavailable checkouts retain
the existing repository error mapping. Authentication, no-cache responses, operation
serialization/deadlines and safe error responses follow the inventory HTTP boundary.
No polling, live events, client UI, review layers, staging or commit operations are introduced.
