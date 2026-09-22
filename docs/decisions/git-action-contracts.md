# Checkout-bound Git actions

Status: implemented server and browser boundary. The [architecture](../architecture.md) and
[inventory HTTP boundary](0004-inventory-http.md) own dependency direction, authentication and
environment/worktree identity.

## Scope

The server supports preparation and execution of fetch, pull, push, commit, stash creation, stash application
and stash pop. Preparation never contacts a remote. The developer reviews the selected action and
pauses external writers before execution. There is no standalone staging, amend, force push, pruning, drop-only,
conflict resolution, automatic retry, terminal, credential provisioning or generic command API.

| Operation | Supported behavior |
| --- | --- |
| Fetch | One configured remote branch into its derived remote-tracking ref; no tags, pruning, submodule recursion, FETCH_HEAD update or checkout changes |
| Push | Captured current branch tip to one explicit remote branch, ordinary fast-forward rules; creation permission is explicit |
| Commit | Existing index, or explicit selected paths using current file contents; normal hooks/signing and unrelated staged content are preserved |
| Pull | Fetch the selected remote branch, then merge or rebase a clean checkout; requests without a strategy remain fast-forward-only |
| Stash creation | All tracked staged/unstaged changes, with explicit `includeUntracked`; ignored files remain excluded |
| Stash application | Apply a verified stash OID, with explicit `restoreIndex`; retain the stash |
| Stash pop | Apply a verified stash OID, then remove its revalidated reflog entry only after successful application |

Push requires attached, born HEAD. Commit supports an unborn branch and returns no-change for an
empty staged scope. Detached commit, integration operations, unmerged entries and occupied index locks
are rejected. Configured conversion filters, sparse checkout, partial clones and submodule index entries
are unsupported in this slice. Unused system/global conversion-filter definitions also reject;
production does not disable that configuration policy. Fetch/push allow dirty files; they send/read Git commits, not working files.
Local mutations do not associate review layers with commits; that remains the Changes/History contract.

The browser stores an explicit Merge/Rebase preference, defaulting to Merge. Rebase rewrites local
commit IDs. A stopped integration remains on disk and blocks new actions; the pull dialog directs
the developer to Git's continue/abort workflow in that worktree. Porcelain does not resolve conflicts
or automatically discard an unfinished integration.

Selected-path commits hold the real index lock and use a temporary index for Git's
`commit --only`. New files enter that temporary index first. Rejected hooks leave the
real index unchanged; a completed commit publishes the resulting index, including
unrelated staged entries. Interrupted outcomes remain receipt-driven and are never retried.

Stash application/pop require a clean tracked/untracked checkout, an existing stash entry in the
project's shared reflog, and no ignored-file collision with the selected stash. Stashes belong to the
project and are shared across linked worktrees. Creation excludes nested directories reported as
untracked repositories rather than silently misrepresenting their contents. No files or Git locks are
cleaned automatically after conflicts or failures.

## HTTP contracts

Schemas live in `@porcelain/contracts/git-actions`; internal models and preparation evidence remain
server-private. Every route authenticates the paired device before parsing and disables response caching.
Unknown fields, arbitrary arguments, raw URLs/checkout paths, short ref names, and NUL messages are
rejected. IDs use UUIDs; object IDs support SHA-1 and SHA-256. Messages have a 16 KiB UTF-8 limit.

The prefix is `/projects/:projectId/worktrees/:worktreeId/git`:

| POST preparation route | Body | POST execution route |
| --- | --- | --- |
| `/fetch/prepare` | `{ remoteName, sourceRef }` | `/fetch` |
| `/push/prepare` | `{ remoteName, destinationRef, allowCreate }` | `/push` |
| `/commit/prepare` | `{ message }` | `/commit` |
| `/stash/create/prepare` | `{ message, includeUntracked }` | `/stash/create` |
| `/stash/apply/prepare` | `{ stashOid, restoreIndex }` | `/stash/apply` |
| `/stash/pop/prepare` | `{ stashOid, restoreIndex }` | `/stash/pop` |

Preparation returns `{ preparationId, expiresAt, action, preview }`. Preview includes local HEAD,
branch, staged/dirty counts, and applicable safe destination/tracking/stash information. Remote state
is unknown until execution. The caller retains the submitted message/options for its confirmation UI;
preparation IDs bind those options immutably. Local destinations use a generic label to avoid exposing
server paths; HTTPS URLs exclude credentials and queries. No raw configuration or process stderr is returned.

All execution routes take `{ requestId, preparationId }`. Acceptance durably consumes the preparation
and inserts a receipt before scheduling work. It normally returns 202. A duplicate request returns the
same receipt without executing again, including after restart; a changed binding or reused preparation
under another request ID returns 409. Preparations expire after five minutes, including queue wait.

`GET /git-action-requests/:requestId` returns a receipt with 200 independently of the mutation queue.
A missing receipt returns 404 and is not authorization to retry a possibly accepted write with a new ID.
Execution responses use 200 for success/no-change, 409 for rejection/conflict, and 503 for indeterminate
outcomes. Pre-execution failures use safe API errors. Receipt states are `running`, `succeeded`,
`no-change`, `rejected`, `conflicted`, and `indeterminate`; `refreshRequired` tells clients to reread
Git state after potential effects. A rejection does not promise that a hook made no side effects.

## Persistence and lifecycle

Dedicated tables store preparations, receipts and project quarantine markers without
coupling receipt retention to inventory row deletion. Records are retained without automatic eviction.
They contain action input, hashed state evidence, timestamps and safe outcomes, not credentials.
SQLite and Git cannot share a transaction; the receipts prevent duplicate admission, not exactly-once
effects. Storage failure before launch prevents mutation. Completion-storage failure is exposed as an
indeterminate receipt for the running application and is never replayed.

Writes share the existing application queue, including linked worktrees. Their 120-second deadline
includes queue wait. The owned callback persists its final receipt before unwinding; shutdown waits
for queued/active callbacks before closing SQLite. HTTP disconnect does not cancel accepted work.
There is no public cancellation endpoint. Cancellation before launch rejects; cancellation after launch
is conservative uncertainty and never triggers rollback or retry.

Git runs in its own process group with closed stdin except commit message input, bounded/drained
output and a five-second group-cleanup budget. Cancellation kills the owned group; the implementation
waits for its disappearance. After Git exits, the group gets 250 ms to empty on its own, because Git can
exit just before a child it has signalled, such as `ssh` after a failed transport. Anything still
running then is killed and makes the outcome uncertain. An unconfirmed group blocks further project mutations, including queued
work. Preparation failures also persist this block even before a request receipt exists. Failed block/receipt
persistence additionally blocks the project in memory before the queue advances. On restart, unfinished launched receipts similarly block the project because restart does not
prove an orphan stopped; unfinished unlaunched receipts become indeterminate without replay. There
is no automated unblock API: external inspection and a separately designed recovery workflow are needed.
Receipts are still readable while blocked.

This is process-group supervision, not a sandbox. Trusted hooks, signing agents and SSH routing
commands can escape a group or affect external state. The server does not claim universal descendant
containment, atomic cancellation, or rollback of a completed remote update.

## State validation and external writers

Preparation and prelaunch inspection verify both checkout and common-directory identities, HEAD,
index bytes, Git configuration, hook entry files, stash reflog and applicable remote destination.
Working-file fingerprints include content and symlink targets, with 10,000 path and 32 MiB content
bounds. Unsupported paths/limits reject rather than weakening evidence. Symlink ancestors outside the
checkout are rejected. Configuration and working state are checked again after queue wait.

These checks are not atomic with Git. Another process can change files, refs, hook dependencies,
credentials or SSH configuration after inspection. Normal Git locks protect individual Git updates,
not a cross-operation transaction. External writers must remain paused; trusted hooks can still alter
staged content or the resulting message. Commit results report the observed resulting HEAD.

Fetch first downloads into an operation-specific temporary ref, checks commit ancestry and conditionally
updates the final tracking ref against its prepared old OID. Rewinds and changed expectations do not
replace that ref. Known temporary refs are removed conditionally; interrupted fetches can leave objects
or temporary refs for external inspection. No uncertain ref is deleted automatically on restart.

Push disables tag following, submodule pushes and upstream auto-setup. It rejects mirror/group/multiple
push destinations. With `allowCreate: false`, execution checks that the ref exists at the inspected push destination (which can differ from the fetch URL); deletion
between that read and push can still race. No strict atomic never-create guarantee is claimed. Remote
failure without complete acknowledgement is indeterminate, even if it may be an ordinary rejection.

Pop never enters removal after application failure/conflict. After successful apply it compares the
complete observed reflog and resolves the selected OID to one entry immediately before `git stash drop`.
A shift or ambiguous duplicate retains the stash and returns indeterminate. A failed/unverifiable drop
also returns indeterminate without claiming retention. A writer can still race between revalidation
and Git's ordinal deletion: this is ordinary Git-supported behavior under the paused-writer assumption,
not atomic deletion by OID. No raw reflog editing or compensating cleanup is performed.

## Remote and executable profiles

Supported destinations are configured absolute filesystem remotes, HTTPS URLs without embedded
credentials/query strings, and ordinary SSH URLs/scp syntax. Effective URL rewrites are inspected;
ambiguous successive push URL rewrites and custom remote upload/receive commands are rejected. Every
rejection names the setting or path that caused it and says what the owner can do, usually removing
the setting or running the action from a terminal.

HTTPS permits exact `cache` and `store` credential helpers, respecting explicit empty chain resets.
Unknown helper commands, helper arguments, shell helpers and `osxkeychain` are rejected before transport.
Keychain access controls can prompt, so it is not classified as noninteractive. Matching is conservative
across credential contexts; an unsupported unrelated context can also reject preparation. Existing
Git TLS and proxy policy remains in force. No certificate/host-key acceptance or credential creation occurs.

SSH follows the owner's own setup, as other Git clients do: a repository's `core.sshCommand` when set,
otherwise system `ssh` with `~/.ssh/config`. A repository's `.git/config` is local configuration that a
clone never copies, so choosing an account there with `ssh -i <key>` has the same trust as
`~/.ssh/config`, and ProxyCommand/Match executables likewise. Porcelain adds no SSH flags. Instead,
prompts are unavailable: Git runs in its own session with no controlling terminal, and askpass is
disabled (`SSH_ASKPASS_REQUIRE=never`). An unknown host key therefore fails host-key verification,
and a refused key fails authentication instead of waiting. Without BatchMode, OpenSSH may still offer
up to three empty passwords to a server that accepts password authentication, which counts toward a
server's failed-login limit (for example fail2ban) before it gives up. These executables
are not contained or prevented from showing their own UI. Askpass/editor variables cannot open interactive
prompts through Git's standard paths. Hooks/signing policy is preserved; failed signing never falls back
to unsigned commits. Arbitrary configured signers/hooks remain subject to the same trusted-executable limit.

## Proof boundary

Colocated specs cover real disposable Git, SQLite and loopback HTTP: index-only commits, hook/signing
failures, stash scope/application/pop conflicts and reflog shifts, explicit fetch/push, content/config
changes, duplicate/restart receipts, socket loss/shutdown, and owned process-group cancellation.
HTTPS proof uses a disposable TLS service and fixture credential store. SSH proof runs the repository
command from a server holding a pseudo-terminal and shows that the command cannot open it. Real `ssh`,
talking to a disposable `sshd` over a ProxyCommand, shows that an unknown host key and a refused key both
fail rather than wait. That spec is skipped where `sshd` cannot run.
No production credentials, projects or network remotes are fixtures. UI/native workflows, real remote
interoperability and Linux execution require their own observed proof before those claims are made.

[Explicit project removal](project-removal.md) defines the user-requested deletion exception to retention,
including associated review data and operation recovery constraints.
