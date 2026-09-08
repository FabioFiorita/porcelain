# Worktree comment threads

Status: initial server/API scope implemented; anchor evolution remains deferred.

Comments belong to an environment-owned worktree ID. Each thread has a stable generated ID,
an explicit anchor, an initial message, ordered flat replies, and a resolved boolean. Message IDs
are stable. All authenticated callers act as the existing trusted principal; messages make no
human, agent, account, or authorship claims. Bodies are plain text, preserved verbatim, with
1–16,000 characters, non-whitespace content, and no NUL. Clients must render them as text.
There are no edit, delete, nested-reply, or audit-history workflows.

Anchors use a normalized relative file path (forward slashes, no empty, dot, parent, backslash,
`.git` (case-insensitive) or NUL components, and no drive prefix). Colons within names such as `notes:today.txt` are allowed. File paths are limited to 4,096 characters. Whole-file anchors have
`kind: file`; `kind: codeRange` adds inclusive, one-based `startLine` and `endLine` with end at
or after start. Lines are positive signed 32-bit integers. Optional `revision` and
`contentFingerprint` strings are opaque caller-supplied evidence, limited to 256 characters each.
Callers should supply immutable revision identifiers; the server neither resolves nor verifies
that claim. Anchor fields and text are retained as submitted, without filesystem access or
existence checks. There is no rebasing, content matching, column coordinate, edit tracking,
or promise that a range still identifies the same code. Diff-side anchoring remains a proposal
until the diff contract defines its identities and coordinate system.

## Persistence and availability

The independent `comment_threads` table deliberately has no inventory worktree foreign key:
inventory refresh may delete worktree rows. Threads and their messages persist through refresh,
temporary unavailability, disappearance from active inventory, and application restart. Creation
requires a worktree in the current inventory, including an unavailable entry. Existing threads
remain readable and writable by their original scope ID after inventory removal. Listing a worktree absent from inventory with no retained discussions returns 404
`WORKTREE_NOT_FOUND`; a known worktree with no discussions returns an empty array. Discovering retained discussions in a future client is
not implemented; a recreated worktree with a new identity does not inherit them.

Threads are listed in creation order using a database sequence. Messages are stored in ordered
thread data and appended in the application's serialized operation order. Resolution does not
change that order. PUT sets the requested resolved state idempotently; repeating it has no
additional effect. Replies do not reopen resolved threads. Creation and replies are not
idempotent: retrying after an uncertain response can create duplicates. Request keys and
cross-process concurrent writing remain deferred; the existing single application owner and
operation queue apply.

The initial limits are 100 threads per worktree, 100 messages per thread (including the initial
message), and 1 MiB of serialized UTF-8 thread data per worktree. Byte accounting includes IDs,
anchors and JSON overhead, reserving the longer `resolved: false` representation so reopening
remains possible at capacity. Additions exceeding a limit return 409 `COMMENT_LIMIT_EXCEEDED`
without changing stored data. Resolution is permitted at capacity. Mutations fetch their scoped
target directly; an aggregate database query supplies thread count and byte usage without
loading every thread. Application input is copied before queueing, and domain validation rejects
invalid bodies and anchors before persistence with a named error (safe 400 `INVALID_REQUEST`).


## Authenticated HTTP

| Method and path | Body | Result |
| --- | --- | --- |
| GET /worktrees/:worktreeId/comments | None | All scoped threads |
| POST /worktrees/:worktreeId/comments | anchor, body | One created thread |
| POST /worktrees/:worktreeId/comments/:threadId/replies | body | One updated thread |
| PUT /worktrees/:worktreeId/comments/:threadId/resolution | resolved | One updated thread |

All successes return 200 and an array (one item for writes). UUID route parameters and strict
request objects are validated by shared contracts. Unknown write targets return safe 404
`NOT_FOUND`; a thread in another worktree also returns 404. Authentication runs before request
validation. Existing safe errors, no-store caching policy, deadlines and shutdown ordering apply.

MCP, notifications, accounts, rendering, agent execution, pagination and anchor evolution are
outside this slice. The broader comments product is not complete. Typed use-case substitutes
and disposable real SQLite/HTTP tests own the evidence for this initial API.
