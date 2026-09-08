# Checkout-bound Git actions

Status: proposed; each approval below is independent. This document specifies future behavior;
none of these actions, routes, schemas, or persistence tables exist yet.

## Foundation and approval boundaries

The baseline is `c3c5a85ba3b6140042a667dbd8e2b4235013a97f`. The owning boundaries are
[architecture](../architecture.md), [product scope](../product.md), and
[inventory HTTP](0004-inventory-http.md). `Git` binds to one checkout. Inventory owns stable
project/worktree identity, while Git owns repository truth. No generic command runner API,
terminal, staging UI, credential service, or additional Git operation is proposed.

Approve these separately, in order of dependency:

| Decision | Recommended scope | Required user choice |
| --- | --- | --- |
| Shared write safety | Durable request receipts, explicit preparation, conservative uncertainty, existing application serialization | Accept receipt persistence and the external-writer limitation below |
| Fetch | One configured remote and one branch; explicit tracking-ref destination | Choose remote/branch; accept bounded fetch without tags, pruning, or forced ref updates |
| Push | One captured local branch tip to one remote branch, ordinary fast-forward rules | Choose destination and explicitly approve branch creation when absent |
| Commit | Existing index only, normal repository hooks and signing | Supply message; accept hooks may change the index/message and working files |
| Stash creation | All tracked staged and unstaged changes in this checkout | Choose whether to include untracked files; default false |
| Stash application | Apply one existing stash by object ID, retain it | Choose whether to restore index state; default false |

A selected upstream can prefill a form but never replaces explicit destination display. No origin
fallback or automatic remote discovery over the network. Empty/multiple candidates require selection.
Stash pop/drop, force push (including leases), tag push, pruning, staging, discard, amend, merge
completion, selective commits/stashes, and stash conflict resolution remain external workflows.
Review-layer association with externally or internally created commits remains a proposal for the
Changes/History owners; a commit result must not imply that association has been implemented.

## Public contracts

Add Zod schemas in `packages/contracts/src/git-actions.ts`, with one explicit package subpath.
Use strict objects, bounded strings, and inferred wire types. The following names describe schema
shapes, not new hand-maintained TypeScript DTOs. Server models and metadata identities stay private.

All paths are relative to the environment server. Each action has separate named preparation and
execution routes under `/projects/:projectId/worktrees/:worktreeId/git`:

| Action | Preparation path (POST) | Body beyond identity | Execution path (POST) |
| --- | --- | --- | --- |
| Fetch | `/fetch/prepare` | `{ remoteName, sourceRef }` | `/fetch` |
| Push | `/push/prepare` | `{ remoteName, destinationRef, allowCreate: boolean }` | `/push` |
| Commit | `/commit/prepare` | `{ message }` | `/commit` |
| Stash creation | `/stash/create/prepare` | `{ message, includeUntracked: boolean }` | `/stash/create` |
| Stash application | `/stash/apply/prepare` | `{ stashOid, restoreIndex: boolean }` | `/stash/apply` |

Execution body is `{ requestId, preparationId }`. UUIDs are validated; the IDs are scoped to this
environment and the route's project, worktree, and action. Unknown fields, raw paths, URLs, shell
arguments, refspecs, arbitrary revisions, and credential values are rejected. Ref names must be full
`refs/heads/...` names and pass Git's ref validation. The server derives tracking destinations under
`refs/remotes/<remoteName>/...`; unsupported remote-name/ref combinations are rejected rather than
normalized. Object IDs must match the repository's object format, not assume SHA-1.
Message limit: 16 KiB UTF-8, nonempty after whitespace checking, no NUL. Commit passes the accepted
message through stdin to `git commit --file=- --cleanup=verbatim`; no shell interpolation or editor.
Stash message is one bounded argument. Hooks can still change a commit message.

Preparation is local inspection only: no fetch, remote credential lookup, or `ls-remote`. It persists
a random preparation ID with a five-minute expiry, requested action input, and private state evidence.
Return `{ preparationId, expiresAt, action, preview }`, where each action has a distinct preview:

- Fetch: configured remote name, source ref, derived tracking ref, currently observed tracking OID.
- Push: current branch, captured source OID, destination ref, creation permission, and sanitized
  destination display. Remote existence/ancestry is explicitly unknown until execution.
- Commit: branch, nullable HEAD OID (unborn branch), staged summary/tree identity, message, and
  a reminder that configured hooks/signing run. No implicit file selection.
- Stash creation: HEAD OID, tracked/untracked counts, requested inclusion and message.
- Stash application: selected stash OID, descriptive label, HEAD OID, index restoration choice,
  and the fact that the stash will remain after application.

Do not expose URLs containing passwords, query credentials, private metadata paths, or raw config.
Destination display may use a sanitized host/path label; keep the full effective configuration private.
There is no remote-ref listing feature in this slice. A user may enter a valid full destination ref.

Immediately before launch, resolve IDs from inventory again and verify both common-directory and
checkout metadata identities against disk. Availability flags alone are insufficient. Reject removed,
replaced, moved-but-not-reregistered, or mismatched checkouts. Revalidate preparation evidence after
queue wait: HEAD/ref, index, relevant worktree/untracked content, and effective action configuration.
Evidence must include content hashes where content matters, not only file size/mtime or status text.
Bound inspection size and reject unsupported/oversized snapshots rather than silently weakening checks.
Configuration evidence includes effective URLs and rewrites, push URLs, refspec/mirror settings,
hooks, signing and identity; do not put secrets in receipts or responses. Expired or stale preparation
requires a new preview and new explicit execution request.

Execution returns an action-specific receipt:

```text
{ requestId, action, state, reason?, result?, refreshRequired }
state = running | succeeded | no-change | rejected | conflicted | indeterminate
```

`rejected` means the selected Git mutation was not launched, or an authoritative action-specific
rejection was observed; it does not promise hooks/helpers made no side effects. `conflicted` is a
known stash-application conflict requiring external resolution. `indeterminate` means completion or
side effects cannot be established. Every launched operation requires authoritative UI refresh,
including failure. Results report observations, not ownership of externally produced changes:
fetch tracking OIDs; push acknowledged source/destination; commit resulting HEAD/tree; stash creation
new stash OID; application selected OID plus observed conflicts. Unknown fields are omitted rather
than inferred from exit status alone.

Use 200 for known completed success/no-change, 202 for running receipts, 409 for stale preparation,
request mismatch, busy state, known rejection or conflict, and 503 for an indeterminate receipt.
Preserve 400/401/404/422/500 for validation/authentication/missing identity/unavailability/unexpected
pre-launch failures through safe named error mapping. Auth runs before parsing or Git access;
all responses disable caching. A safe reason enum includes `STALE_PREPARATION`, `REQUEST_MISMATCH`,
`CHECKOUT_BUSY`, `UNSUPPORTED_CONFIGURATION`, `NON_FAST_FORWARD`, `GIT_REJECTED`,
`DEADLINE_EXCEEDED`, and `OUTCOME_UNKNOWN`. Do not guess credential/hook/signing failures by
matching localized stderr. Retain bounded private diagnostics with redaction; no raw process output
in wire errors. Clients must never automatically retry write routes, including a 503.

## Receipts, cancellation, and concurrency

Propose a small action-specific receipt repository and Drizzle migration, not a generic jobs framework.
Store request UUID, action/identity, preparation binding, accepted/start/finish timestamps, state and
safe result. Unique request IDs are environment-wide. Atomically consume a preparation and insert
its receipt before spawn; the same preparation cannot execute under another request ID. Same request
and preparation returns the stored receipt; changed binding returns 409. A failed storage write before
spawn must prevent Git execution. A failure to persist completion after Git ran is indeterminate.

`GET /git-action-requests/:requestId` returns the receipt using the same bearer authentication.
This is recovery for these five named actions, not a scheduler. A missing receipt is not permission
to invent a new request and repeat an uncertain mutation. Retain receipts and consumed preparation
IDs without automatic eviction in the first slice; a bounded retention policy needs its own decision.
On restart, accepted/running receipts become indeterminate and never resume automatically. Receipts
reduce duplicate execution; they cannot transact SQLite and Git or guarantee exactly-once effects.

Keep the current application-wide queue initially, which also serializes actions on linked worktrees
sharing refs/remotes/stashes. Reads of receipts must remain possible while a mutation runs. Admission
returns 202 after receipt persistence; execution stays owned by the application after HTTP disconnect.
The runner currently rejects callers as soon as its signal aborts: a write-specific lifecycle path
must retain ownership until the child and descendants finish/are terminated, then reconcile and persist
an outcome before allowing another mutation. Do not reuse the inventory 503 mapping as a write result.

Recommend a fixed 120-second action deadline including queue wait, with a separately bounded 5-second
local reconciliation phase after process termination. These are proposed write settings, not changes
to inventory's 30-second deadline or its executor's 10-second cap. No public cancellation endpoint is
needed initially. Shutdown and caller cancellation before spawn yield a rejected receipt; after spawn,
terminate the process tree and report indeterminate unless complete evidence proves a narrower outcome.
If descendants cannot be confirmed stopped, block subsequent mutations for that repository in the
running server and require external inspection. Restart does not prove an orphan remote/helper stopped.
Do not remove Git lock files or reset repositories to recover. Remote completion cannot be undone by
killing a local process; no automatic retry, compensating rollback, or promise of atomic cancellation.

Porcelain's queue cannot exclude an editor, agent, another Git process, or another server. Git's locks
protect individual updates, not the preparation-to-execution interval or arbitrary working files.
Pre/post checks detect many races but are not an atomic snapshot. Commit/stash are only appropriate
when the user has paused external writers; the execution preview must say this. Hooks are also writers.
The user must approve this limitation. If exact reviewed-byte atomicity under active writers is required,
stop and design that separately; do not claim index fingerprints or a Porcelain mutex solve it.

## Action semantics and Git adapter behavior

Keep named methods on checkout-bound `Git`, small command modules in `git/commands`, private DTOs
and narrow capability interfaces. Named use-case classes receive explicit Git factory, inventory,
receipt store, and lifecycle dependencies. Routes call named `Application` methods and map results.
No DI framework, command bus, barrels, new dependencies, or production const-gate exceptions.

### Fetch

Fetch exactly one configured remote branch, then update only its derived remote-tracking ref.
Fetch first into a unique task-owned temporary ref under `refs/porcelain/fetch/<requestId>` with
`--no-tags --no-prune --no-prune-tags --no-recurse-submodules --no-write-fetch-head`, automatic
maintenance disabled, and an empty refmap override to prevent configured opportunistic mappings.
Do not rely on absence of `+` to enforce ancestry in the remote-tracking namespace. Verify the fetched
object is a commit and the prepared tracking OID is its ancestor (or the destination was absent),
then use `update-ref` with the expected old OID, including the repository-format zero OID for absence.
An ancestry failure or compare-and-swap mismatch leaves the final tracking ref unchanged. Remove only
the task-owned temporary ref using its expected OID; record its ownership for safe startup cleanup.
A crash between final update and receipt persistence still yields an indeterminate receipt. Reject
shallow repositories when ancestry cannot be established; never interpret missing history as proof.
No merge, checkout, local branch update, submodule fetch or pruning. A dirty checkout is allowed.
Rewinds require separate approval. Downloaded objects may remain after failure. Git's namespace and
explicit refmap rules are documented in [git-fetch](https://git-scm.com/docs/git-fetch).

### Push

Push the prepared source OID to one full branch destination, with porcelain output and explicit
non-force refspec. Disable follow-tags, recursive submodule pushes and automatic upstream setup.
Reject mirror remotes, multiple effective push destinations, remote groups and unsupported transport
configuration before launch. Do not silently change remote config or add `--set-upstream`.
Normal receive-side fast-forward checks decide acceptance; a preparation tracking ref is not proof
of remote state. For `allowCreate: false`, execution checks remote existence first and rejects absence;
a remote deletion between that check and push can still race. Approving this slice accepts that
limitation; a strict never-create guarantee requires a separately designed conditional remote update.
For `allowCreate: true`, creation is allowed but a non-fast-forward replacement still is not.
Dirty files/index do not affect the captured commit being sent. Reject detached/unborn source HEAD.
Preserve pre-push hooks and configured push signing. Git supports these explicit destination and
porcelain-result controls; see [git-push](https://git-scm.com/docs/git-push).

### Commit

Commit only the current index: no `-a`, paths, `git add`, alternate index, amend, allow-empty, identity
invention, hook bypass or signing bypass. Permit unrelated unstaged and untracked files, including
partial staging. Reject detached HEAD, unmerged entries, sequencer/merge/rebase operations, sparse
checkout and dirty submodules for this first slice. Permit an unborn branch with a nonempty index.
Empty index relative to HEAD returns no-change without running hooks. Honor configured author/committer
and signing; missing identity or unavailable signer fails without disabling policy. Hooks can alter
staging, messages and files; return the actual resulting commit and refresh Changes/History. Do not
attempt to undo hook effects or retry on failure. These ordinary commit/index and hook semantics are
described in [git-commit](https://git-scm.com/docs/git-commit).

### Stash creation and application

Creation stashes all tracked staged/unstaged changes; `includeUntracked: true` explicitly adds `-u`.
Never `--all`, `--keep-index`, `--staged`, or path selection. Ignored files are excluded. Reject unborn
HEAD, unmerged entries, ongoing Git integration operations, sparse checkout, dirty submodules and
nested repositories whose contents would make the scope misleading. Empty selected scope returns
no-change. Creation can both write refs/stash and remove working files; failure is not rollback.

Application targets an OID verified as an existing entry of this project's current stash reflog,
not a shifting `stash@{n}` index or arbitrary commit. Revalidate membership before launch. Stashes
are shared across linked worktrees; show project scope and do not claim an entry belongs exclusively
to the selected worktree. Require clean index and tracked/untracked worktree before application;
ignored-file collisions still need a real fixture and must never be cleaned automatically. Default
ordinary `stash apply`; opt-in `--index` restores staging when possible. Retain the stash on success
and conflict. A conflict refreshes status and blocks subsequent commit/stash until resolved externally.
No pop, drop, auto-resolution, reset or cleanup. See [git-stash](https://git-scm.com/docs/git-stash).

### Environment and process policy

Use argv execution and closed stdin except commit message input. The existing executor clears only
some Git environment overrides; write support must also prevent inherited alternate index/object,
namespace, injected configuration and repository-redirection variables from retargeting commands.
Keep repository/user policy for hooks, signing and credentials; do not blank global configuration in
production as the disposable tests do. Pin locale for machine-readable parsing; prefer NUL/porcelain
formats and explicit numeric exit/signal evidence over translated messages.

No interactive terminal or credential invention: disable terminal/askpass prompts and require SSH
batch behavior with existing host trust, without replacing established routing/identity settings.
Permit already configured noninteractive helpers/agents. Do not create keys, log tokens, accept host
keys automatically, open browser login, or disable signing. Arbitrary helpers/signers may still launch
UI or hang; repository-configured executable behavior is not sandboxed. Before enabling remote actions,
prove a supported HTTPS/SSH execution profile can enforce this policy without overriding user routing;
reject unsupported custom helpers/transports rather than promise universal prompt suppression.
Bound output while continuing to drain pipes, supervise descendants on macOS/Linux, and reconcile
termination. The read executor's `execFile` buffer cap/SIGKILL alone does not establish those guarantees.

## Implementation and proof gates

Implement only approved actions after the shared safety decision. Each slice adds its own contracts,
use case, Git method/command, route, typed-substitute specs and real process/HTTP fixtures. Shared edits
are limited to `application.ts`, `app.ts`, server route registration, contracts exports and the receipt
migration; coordinate these with startup and other feature owners before integration. No other worker's
worktree or feature implementation is part of this proposal.

| Test boundary | Required observable scenario |
| --- | --- |
| Typed use-case substitutes | Missing/unavailable/replaced identity rejects before spawn; expired/stale preparation rejects; HEAD/index/config change while queued rejects; a storage failure prevents launch |
| Receipt persistence | Duplicate simultaneous requests launch once; changed request binding rejects; another request cannot reuse preparation; restart never replays accepted work; failure after Git success remains indeterminate |
| Real process: isolation | Poison inherited index/worktree/config variables and verify only disposable target changes; linked worktree uses its own index but shared refs/stash; option-like names cannot inject flags |
| Real process: fetch | Dirty checkout unchanged; only selected tracking ref updated; missing ref/rewind rejected with final tracking OID unchanged; conditional-update race rejects; temporary refs cleaned only by ownership; tags/pruning/configured extra refmaps/submodules remain untouched; failed fetch may leave objects |
| Real process: push | Bare local remote fast-forward, divergence rejection, explicit new-branch permission, captured source despite external branch advancement; multiple push URLs/mirror rejected; no tags/upstream side effects |
| Real process: commit | Partially staged file commits staged content only; untracked file stays out; empty/unborn cases; rejecting and index-mutating hooks; configured failing signer does not fall back unsigned |
| Real process: stash | Tracked round trip preserves staged/unstaged content; opt-in untracked; ignored/nested/submodule cases rejected or preserved; shared reflog entry shifts do not change OID target; apply conflict retains stash and exposes unmerged paths |
| Real process: races | Barrier-controlled external HEAD/index/file/config writer between preview and spawn; writer/hook after precheck demonstrates documented non-atomic limitation; occupied Git lock is never deleted |
| Real process: cancellation | Abort in queue, before spawn, during hook/helper, after ref update before reply; descendant outlives parent; shutdown holds next mutation until unwind; partial effect never yields retryable no-change |
| Real HTTP + SQLite + Git | Authenticate before launch; strict input/secret-safe serialization; preparation and 202/status recovery across socket loss; duplicate/restart behavior; cancellation receipt mapping; GET status available during long action |
| Recovery | Successful remote update followed by lost acknowledgement gives indeterminate; a read-only inspection can show current remote state but must not retroactively prove request causality or retry automatically |

Use fresh temporary repositories and bare filesystem remotes, isolated HOME/config and fixture
identity. Hooks/helpers/signers are task-owned fixture programs; no real network, credentials, or
production data. Drive race/cancellation fixtures with barriers rather than sleep-based assumptions.
Transport-level SSH/HTTPS behavior still needs local simulated services before enabling those profiles;
filesystem remotes alone do not prove credentials, TLS, remote cancellation or server-side policy.

Format/lint changed files, typecheck affected packages/contracts consumers, and run the focused specs.
Run one fresh read-only correctness/architecture/test-value review after checks; resolve actionable
findings before a local commit. Linux/macOS CI and UI smoke belong to implementation delivery and
must be observed before claimed. This proposal does not establish running feature behavior.
