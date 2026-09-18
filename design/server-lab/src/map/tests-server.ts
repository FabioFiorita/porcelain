import type { AreaTestSummary, SpecAudit } from './types';

// Audit of server specs under apps/server/src/http, apps/server/src/use-cases and
// the spec files directly in apps/server/src, as of the uncommitted evidence cache.
//
// Process counts quoted below were measured (not taken from a spec) with a PATH
// wrapper that logs every git invocation, against a disposable fixture repository
// on this working tree. 50 changed files / 4 checkouts: status 13, cold evidence 84,
// warm evidence 13, one diff 35, one text read 20, directory 20, file tree 22,
// commits 15, refresh 10. 200 changed files / 11 checkouts: cold evidence 258, warm
// evidence 13, one diff 35, one text read 48, directory 48, file tree 50, refresh 24.
// Editing any changed file made every evidence call cold for the next ~2 seconds.

export const serverSpecAudits: SpecAudit[] = [
  {
    file: 'apps/server/src/use-cases/read-worktree-evidence.spec.ts',
    areas: ['changes'],
    kind: 'unit',
    real: [
      'sha256 fingerprinting',
      'grouping, ordering and byte bounding logic',
    ],
    fakes: [
      'InspectionFactory (readStatus returns a fixed observation; readDiffs is Promise.all over a fake readDiff)',
      'FileReader for untracked files',
      'FileStamps (returns an empty or test-controlled string instead of real lstat stamps)',
      'InventoryStore and GitFactory',
    ],
    tests: [
      {
        name: 'returns exact staged, unstaged, untracked and omitted evidence grouped by logical path',
        asserts:
          'Path order, staged-before-unstaged comparisons, exact diff content, a fingerprint recomputed in the test with the same sha256/JSON recipe, null fingerprints for binary, submodule and conflict entries.',
      },
      {
        name: 'does not include a status token in the evidence fingerprint',
        asserts:
          'Two instances with different status tokens and the same patch produce the same fingerprint.',
      },
      {
        name: 'localizes unreadable untracked files and rejects a moving worktree',
        asserts:
          'UNSUPPORTED_TEXT maps to omitted/unsupported-encoding with null fingerprint; a status token that differs between the before and after reads throws WorktreeChangedError.',
      },
      {
        name: 'bounds aggregate UTF-8 evidence content while retaining affected paths',
        asserts:
          'Two 30%-of-limit multibyte patches: first kept, second omitted as size-limit, serialized result below limit + 1 MB.',
      },
      {
        name: 'bounds concurrent file reads and drains them before reporting a failure',
        asserts:
          'Only 4 untracked reads start at once; a rejection does not settle the operation until the in-flight reads finish.',
      },
      {
        name: 'reuses evidence until the status or a working file changes',
        asserts:
          'With a fake stamp function: second call returns the same object (toBe), path-filtered hits read no diffs, a changed stamp or status token re-reads both diffs (read counter 2 -> 4 -> 6).',
      },
      {
        name: 'selects logical paths without reading unrelated changes or dropping comparison scopes',
        asserts:
          'A path subset reads only that path (both scopes), no untracked reads, and an unknown path reads nothing.',
      },
    ],
    strengths: [
      'Pins the fingerprint contract (status token excluded, null for unfingerprintable content), which reviewed marks depend on.',
      'Checks drift detection between the before and after status reads and the aggregate byte bound with multibyte text.',
      'The cache test counts diff reads, so a regression that disables the cache for full or partial requests would fail.',
      'The concurrency test for untracked reads is precise (exact started set, drain before rejection).',
    ],
    gaps: [
      'Git is fully faked, so nothing here can observe process count. The real cost is 13 git processes per status read and one git diff per changed file: 84 processes for 50 files and 258 for 200 files on a cold call (measured). A cache hit still costs 13.',
      'The cache test injects stamps. The real readFileStamps returns a unique "recent:<hrtime>" stamp for any file modified in the last 2 s, so while an agent is editing, every call misses and re-reads every diff. No spec covers that; the HTTP spec avoids it by backdating files 60 s with utimes.',
      'The fake readDiffs maps over readDiff, so the 64-change grouping and the single readDiffs call per group are not asserted; a return to per-change adapter calls would still pass.',
      'LRU eviction (MAX_CACHED_WORKTREES = 16) and concurrent callers for the same worktree (two cold misses computed twice) are untested.',
      'The cache hands the same object to every caller (the test asserts toBe); nothing guards against a consumer mutating it.',
      'No cancellation test: an aborted signal between groups or during readDiffs is never exercised.',
      'Renames, deletions (newPath null) and FILE_TOO_LARGE / CONTENT_CHANGED mappings for untracked files are not covered.',
      'The first test recomputes the fingerprint with the same recipe as the code, so it pins the format rather than independently checking it.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/use-cases/read-worktree-inspection.spec.ts',
    areas: ['changes'],
    kind: 'unit',
    real: ['ReadWorktreeStatus and ReadWorktreeDiff logic'],
    fakes: ['InspectionFactory (fixed observations)', 'InventoryStore'],
    tests: [
      {
        name: 'returns status using the registered checkout and identity with typed adapters',
        asserts:
          'The adapter factory receives path, metadata identity and repository identity from inventory; result is passed through.',
      },
      {
        name: 'rejects missing and unavailable worktrees before inspecting them',
        asserts:
          'Unknown id -> WorktreeNotFoundError; unavailable -> RepositoryIdentityMismatchError; the factory is never called.',
      },
      {
        name: 'rejects stale observations and paths not present in the selected comparison',
        asserts:
          'Stale token, wrong scope and an escaping path all throw WorktreeChangedError without reading a diff.',
      },
      {
        name: 'rejects detected drift after generating a diff instead of returning mismatched content',
        asserts:
          'A status change during the diff read throws WorktreeChangedError.',
      },
      {
        name: 'returns a selected result when observations agree and honors cancellation after adapter reads',
        asserts:
          'Happy-path diff result shape; an abort during readStatus rejects with AbortError.',
      },
    ],
    strengths: [
      'Covers the stale-token and drift guards that keep the diff pane from showing mismatched content.',
      'Checks that invalid selections never reach the diff adapter.',
    ],
    gaps: [
      'One diff click runs two full status reads plus the diff: 35 git processes in the measured fixture. Nothing pins or bounds that.',
      'No test of a large status (thousands of entries) or of the 2000-change InspectionLimitError from a real parse.',
      'Cancellation is only tested for status, not for a diff that is already running.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/git-inspection.spec.ts',
    areas: ['changes', 'connection'],
    kind: 'http',
    real: [
      'git (init/add, status, diff)',
      'sqlite',
      'fastify inject and a real loopback listener with fetch',
      'filesystem',
    ],
    fakes: ['InspectionFactory in the error-mapping test only'],
    tests: [
      {
        name: 'serves status and selected diffs over authenticated loopback HTTP and rejects stale or invalid selections',
        asserts:
          'Status 200 + no-store + schema; staged diff contains "+staged"; 401/400/404 on auth, bad ids and payloads; a new untracked file makes the diff 409 WORKTREE_CHANGED; a moved checkout gives 422 REPOSITORY_UNAVAILABLE.',
      },
      {
        name: 'maps inspection limits, unsupported paths and infrastructure failures without exposing diagnostics',
        asserts:
          'Injected errors map to 413/422/503/500 with the right code and no "private" text in the body.',
      },
    ],
    strengths: [
      'Real Git end to end, including a concurrent change producing 409 and a moved checkout producing 422.',
      'Error mapping table checks status, code and diagnostic leakage for each error type.',
    ],
    gaps: [
      'The status body is only checked with toMatchObject on worktreeId/consistency/headOid; the changes list is not asserted.',
      'INSPECTION_LIMIT is only injected; no real repository with more than 2000 changes goes through the route.',
      'The route does not pass the request abort signal to the application, and no test checks what happens when the browser drops a status or diff request (the git work keeps running in the queue).',
      'No process-count or latency assertion for status (13 git processes) or diff (35).',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/reviewed-files.spec.ts',
    areas: ['changes'],
    kind: 'http',
    real: [
      'sqlite (reviewed marks)',
      'fastify inject',
      'git for registration only',
    ],
    fakes: [
      'InspectionFactory: a constant status observation and a constant patch for every diff',
    ],
    tests: [
      {
        name: 'serves exact evidence, persists worktree marks, rejects stale fingerprints, and removes idempotently',
        asserts:
          'Evidence echoes the fake patch with a 64-hex fingerprint; reviewed:false is 400; a mark is stored; a wrong fingerprint is 409 REVIEWED_MARK_STALE; GET lists the mark; DELETE twice returns empty marks.',
      },
    ],
    strengths: [
      'Covers the mark contract end to end through SQLite, including the stale-fingerprint conflict and idempotent removal.',
    ],
    gaps: [
      'Evidence comes from a fake, so "exact evidence" only proves the fake is echoed back. Real evidence and real staleness after an edit are covered in git-actions.spec.ts, not here.',
      'Because the fake status never changes, a mark can never become stale through a file edit in this spec.',
      'The review-summary endpoint, which the web polls per worktree, is not exercised here.',
      'Marks are never pruned or checked for paths that are no longer changed.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/git-actions.spec.ts',
    areas: [
      'git-actions',
      'changes',
      'inventory',
      'comments',
      'review-layers',
      'lifecycle',
    ],
    kind: 'http',
    real: [
      'git (commit, pull merge/rebase against a bare remote, stash create/pop, pre-commit hook)',
      'sqlite',
      'fastify inject and real loopback HTTP including a dropped socket',
      'filesystem',
      'server restart on the same data directory',
    ],
    fakes: [
      'vi.spyOn on InspectionGit.prototype.readDiffs and readStatus (counting calls or gating them)',
      'An isolated git wrapper on PATH with HOME and XDG_CONFIG_HOME stubbed',
    ],
    tests: [
      {
        name: 'carries the %s pull strategy through preparation and execution',
        asserts:
          'merge produces a two-parent HEAD, rebase a one-parent HEAD; receipt succeeded.',
      },
      {
        name: 'counts unreviewed paths without loading their diffs',
        asserts:
          'With no marks, review-summary reports pendingFiles 2 and readDiffs is never called.',
      },
      {
        name: 'serves foreground reads while a background summary is blocked',
        asserts:
          'A git/status request completes while the summary runner is blocked inside readStatus.',
      },
      {
        name: 'reads comments without waiting for slow review evidence',
        asserts:
          'GET comments returns while an evidence request is blocked inside readDiffs.',
      },
      {
        name: 'validates only the marked file, including both comparisons, and preserves badge counts',
        asserts:
          'With files backdated 60 s: marking hits the cache (no readDiffs), summary is 1 pending; after an edit the mark is 409 and exactly one readDiffs call covered file staged+unstaged; summary becomes 2.',
      },
      {
        name: 'counts current unreviewed files and unresolved comments in the review summary',
        asserts:
          'pendingFiles 1 -> 0 after marking -> 1 after an edit; openThreads counts a new comment.',
      },
      {
        name: 'archives committed layer notes and preserves remaining review work (selected: %s)',
        asserts:
          'Commit snapshot holds the committed layer files and notes, the live layer keeps the rest at revision 2, later live edits do not change the snapshot.',
      },
      {
        name: 'authenticates and validates before preparing or launching Git actions',
        asserts:
          '401 without token, 400 on extra args, 404 + no-store for an unknown receipt.',
      },
      {
        name: 'accepts a commit once, returns its receipt after restart, and rejects preparation reuse',
        asserts:
          'Duplicate submit is idempotent, replay returns the receipt, reuse with a new request id is 409, exactly one commit exists after restart.',
      },
      {
        name: 'rejects changed content after preparation without committing it',
        asserts:
          'An edit after prepare yields rejected/STALE_PREPARATION, replay is 409, no commit.',
      },
      {
        name: 'supports the new-file stash and pop workflow through real loopback HTTP',
        asserts:
          'Untracked file stashed and popped with content restored and stash not retained.',
      },
      {
        name: 'keeps accepted work after socket loss, serves receipts during it, and finalizes before shutdown',
        asserts:
          'A hanging pre-commit hook keeps state running after the client disconnects, receipts are served meanwhile, shutdown records indeterminate and no commit is made.',
      },
    ],
    strengths: [
      'The strongest spec in scope: real Git, real HTTP, restarts, a hanging hook and a dropped socket, with idempotency and staleness checked on disk.',
      'Contains the only tests that look at work done per request (readDiffs call counts) and at queue independence between the summary runner, comments and operations.',
      'Commit-to-review-layer archiving is checked with both whole and selected commits.',
    ],
    gaps: [
      'Spies count calls to readDiffs, not processes. "Counts unreviewed paths without loading their diffs" still costs 13 git processes per worktree per summary, and a summary with any mark computes full evidence (84-258 processes cold, measured).',
      'The cache-hit test only works because files are backdated 60 s. The realistic case (an agent edited a file a moment ago) makes every evidence and summary call cold; nothing asserts that.',
      'Every fixture has 1-3 changed files and one worktree; there is no sidebar-shaped test (summaries for many worktrees).',
      'No test that a long pre-commit hook (up to 120 s on the shared operations queue) delays or times out status, evidence and file reads for other worktrees and projects.',
      'Fetch, push and stash apply are not exercised over HTTP here; failed pull (conflict) receipts are not checked.',
      'The file name hides that it is also the main review-summary and evidence-cache spec, which makes those tests hard to find.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/execute-git-action.spec.ts',
    areas: ['git-actions', 'lifecycle'],
    kind: 'unit',
    real: [
      'ExecuteGitAction, PrepareGitAction, AcceptGitAction',
      'GitActionCoordinator',
      'OperationRunner',
    ],
    fakes: [
      'GitActionStore (in-memory with failure switches)',
      'InventoryStore',
      'GitActionWriter (inspect/execute stubs)',
    ],
    tests: [
      {
        name: 'does not launch a %s mutation',
        asserts:
          'stale, expired, missing and pre-aborted preparations never call execute and end rejected without refresh.',
      },
      {
        name: 'does not launch when the durable prelaunch write fails',
        asserts:
          'A storage failure before launch rejects and execute is never called.',
      },
      {
        name: 'records indeterminate effects after lost acknowledgement, without retrying',
        asserts:
          'An error after launch is recorded as indeterminate/OUTCOME_UNKNOWN with one launch.',
      },
      {
        name: 'blocks already queued work in memory when persisting quarantine fails',
        asserts:
          'After PROCESS_GROUP_UNCONFIRMED with a failing block write, the queued second action is not launched and a third submit throws.',
      },
      {
        name: 'blocks a queued preparation after failed quarantine persistence using the captured scope',
        asserts:
          'One inspection only; a caller mutating scope after submit cannot redirect or bypass the block.',
      },
    ],
    strengths: [
      'Pins the "never launch twice, never launch after uncertainty" invariants with the real coordinator and queue.',
      'Covers failure of the persistence layer itself, which is easy to overlook.',
    ],
    gaps: [
      'The success path with CompleteCommitReview (layer archiving) and its failure (reviewLayersUpdated false) is not covered here.',
      'Timeouts (DEADLINE_EXCEEDED from the 120 s owned run) are not exercised.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/git-action-quarantine.spec.ts',
    areas: ['git-actions', 'lifecycle'],
    kind: 'integration',
    real: [
      'openApplication with sqlite',
      'git init and registration',
      'restart on the same data directory',
    ],
    fakes: ['GitActionWriter (inspect/execute stubs)'],
    tests: [
      {
        name: 'persists unconfirmed cleanup before a second accepted action can launch',
        asserts:
          'A second accepted commit never launches, both receipts are indeterminate/PROCESS_GROUP_UNCONFIRMED, and preparation stays blocked after restart.',
      },
      {
        name: 'persists an inspection quarantine even though preparation has no request receipt',
        asserts:
          'An unconfirmed inspection blocks later preparations across restart with one inspection total.',
      },
    ],
    strengths: ['Proves the quarantine survives restart through real SQLite.'],
    gaps: [
      'No path to clear a quarantine is tested (operator recovery), so a regression that makes it permanent would not be noticed.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/project-removal.spec.ts',
    areas: ['inventory', 'git-actions', 'lifecycle'],
    kind: 'integration',
    real: [
      'openApplication with sqlite',
      'git init',
      'SQLite trigger to force a write failure',
    ],
    fakes: ['GitActionWriter (gated execute)'],
    tests: [
      {
        name: 'preserves an action accepted behind queued removal, then invalidates preparations after successful removal',
        asserts:
          'Removal during a running action is rejected, the second queued commit still succeeds, removal then succeeds and an unused preparation becomes STALE_PREPARATION.',
      },
      {
        name: 'keeps the in-memory recovery block effective when its database write fails',
        asserts:
          'With the block insert failing, removal is still refused and inventory unchanged.',
      },
    ],
    strengths: [
      'Real ordering on the shared queue between removal and accepted actions, including a forced SQLite failure.',
    ],
    gaps: [
      'Removal while evidence or file reads are queued for the same project is not tested.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/commit-drafts.spec.ts',
    areas: ['git-actions', 'changes'],
    kind: 'integration',
    real: [
      'openApplication with sqlite',
      'git (status, evidence, action inspection)',
      'filesystem',
    ],
    fakes: [
      'CommitGenerator (vi.fn generate, empty models)',
      'HOME and XDG_CONFIG_HOME stubbed',
    ],
    tests: [
      {
        name: 'returns guarded drafts and rejects content changed after generation before preparing a commit',
        asserts:
          'A draft is returned; editing the file afterwards makes prepareCommit with expectedFiles reject STALE_PREPARATION.',
      },
      {
        name: 'keeps ordinary reads available while generation waits and rejects changed evidence at completion',
        asserts:
          'readTextFile completes while generation is pending; an edit during generation rejects with WorktreeChangedError.',
      },
      {
        name: 'rejects invented paths and duplicate assignments from a model',
        asserts:
          'Unknown or duplicated paths from the model throw "did not cover".',
      },
      {
        name: 'rejects groups that split the source and destination of a rename',
        asserts: 'A rename split across groups is rejected.',
      },
    ],
    strengths: [
      'Uses real Git to prove the stale guards around a slow model call and that ordinary reads are not blocked by generation.',
      'Checks model output validation against invented paths and rename splits.',
    ],
    gaps: [
      'capture() reads full-worktree evidence even when one file is selected, and prepareCommit with expectedFiles does the same; on 200 changes that is ~258 git processes per draft (twice with prepare). Not tested.',
      'Cancellation of generation when the browser disconnects is implemented in the route but not tested.',
      'The 1 MiB prompt limit and the 20-group limit are not covered.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/app.spec.ts',
    areas: [
      'inventory',
      'lifecycle',
      'changes',
      'history',
      'files',
      'artifacts',
    ],
    kind: 'integration',
    real: [
      'git (init, worktree add/move/remove/lock/repair, clone, bare clone)',
      'sqlite',
      'filesystem renames',
      'restart',
    ],
    fakes: [
      'GitFactory wrappers in a few tests (to fail, gate or detect unrelated inspection)',
    ],
    tests: [
      {
        name: 'registers from any checkout, groups worktrees main-first, and keeps separate clones distinct',
        asserts:
          'Linked registration yields main-first worktrees, same project id from either checkout, a clone is a separate project.',
      },
      {
        name: 'persists identities and refreshes Git on restart, with independent environment IDs',
        asserts:
          'Ids stable across restart, branch refreshed, a new data directory gets a new environment id.',
      },
      {
        name: 'rejects non-repositories and bare repositories without persisting a project',
        asserts:
          'GitCommandError with checkout and cause; UnsupportedRepositoryError for bare; inventory empty.',
      },
      {
        name: 'preserves a project after moving its main checkout and registering the new path',
        asserts: 'Same project and worktree ids after move + worktree repair.',
      },
      {
        name: 'serializes duplicate registrations and handles checkout paths containing newlines',
        asserts:
          'Concurrent registrations resolve to one project; a newline path is available.',
      },
      {
        name: 'registration does not inspect unrelated projects',
        asserts: 'Registering a second project never calls git for the first.',
      },
      {
        name: 'preserves a moved linked checkout and removes disposed entries without reusing their IDs',
        asserts: 'Move keeps id, removal drops it, re-adding gets a new id.',
      },
      {
        name: 'does not reuse identity when a checkout is replaced between refreshes',
        asserts: 'Remove + add at the same path gets a new id.',
      },
      {
        name: 'syncs deleted checkout folders out of persisted inventory without pruning Git metadata',
        asserts:
          'Deleted folder leaves inventory, Git worktree list unchanged, persists across reopen.',
      },
      {
        name: 'retains unreachable repositories and missing locked worktrees as unavailable',
        asserts:
          'Locked-missing worktree and hidden main become unavailable with issues, then recover with the same ids.',
      },
      {
        name: 'does not inspect a different repository substituted at a linked checkout path',
        asserts: 'A clone placed at the linked path is marked unavailable.',
      },
      {
        name: 'marks the old project unavailable when registering a replacement at its former path',
        asserts:
          'Replacement gets a new id, identity mismatch issue, old project unavailable.',
      },
      {
        name: 'retains a registered checkout replaced by a bare repository as unavailable',
        asserts: 'Project unavailable with UnsupportedRepositoryError issue.',
      },
      {
        name: 'propagates system discovery failures without marking healthy inventory unavailable',
        asserts:
          'ENOENT-style Git failure rejects refresh and leaves inventory unchanged.',
      },
      {
        name: 'cancellation prevents a late discovery result from being persisted',
        asserts:
          'Aborted registration persists nothing; closed app rejects further calls.',
      },
      {
        name: 'does not create persistent state when startup is already cancelled',
        asserts: 'Pre-aborted open creates no data directory.',
      },
      {
        name: 'returns diagnostics with their operation without changing earlier results',
        asserts: 'Issues are per refresh result and not mutated later.',
      },
      {
        name: 'inspects the submitted read request when caller objects change before queued execution',
        asserts:
          'Queued commits page, commit changes and diff use the values captured at call time.',
      },
      {
        name: 'snapshots preference intent before queued execution',
        asserts:
          'Mutating the change object after the call does not change the stored preference.',
      },
      {
        name: 'persists submitted artifact values when callers mutate input behind a blocked queue',
        asserts:
          'Upload stores the submitted name and content, not the later mutation.',
      },
    ],
    strengths: [
      'Thorough identity and availability semantics against real Git worktree operations, including odd paths and substitutions.',
      'Queued-input snapshot tests protect a subtle class of bugs in the shared queue.',
    ],
    gaps: [
      'Refresh walks every project and runs listWorktrees (2 + 2 per worktree git processes) serially on the shared queue; no test with many projects or worktrees, and none that it blocks foreground reads while it runs.',
      'All fixtures have one or two worktrees.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/reconciliation/reconcile-project.spec.ts',
    areas: ['inventory'],
    kind: 'property',
    real: [
      'reconcileProject pure function',
      'fast-check generated worktree sets (1-20)',
    ],
    fakes: [],
    tests: [
      {
        name: 'preserves worktree identity through moves, branch changes, and discovery reorder',
        asserts:
          'Any reorder, move and branch change keeps project and worktree ids by metadata identity.',
      },
      {
        name: 'assigns distinct fresh IDs when new metadata replaces checkouts at the same paths',
        asserts: 'Replacement metadata never reuses an id.',
      },
      {
        name: 'retains unavailable worktree identity so a later move can reconnect it',
        asserts: 'Offline worktrees keep ids and reconnect after a move.',
      },
    ],
    strengths: [
      'Property-based coverage of the identity rules is exactly the right tool for this pure function.',
    ],
    gaps: [
      'Mixed cases (some worktrees moved, some replaced, some offline in one refresh) are not generated.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/find-projects.spec.ts',
    areas: ['inventory'],
    kind: 'unit',
    real: ['FindProjects traversal logic'],
    fakes: [
      'ProjectFolders.read (synthetic 20-wide tree)',
      'GitFactory (vi.fn)',
      'InventoryStore',
    ],
    tests: [
      {
        name: 'bounds breadth and depth when discovering repositories',
        asserts:
          'At most 500 folder reads, depth at most 5, limited:true, git never called.',
      },
      {
        name: 'stops scanning on cancellation instead of returning incomplete success',
        asserts: 'Abort after the first read rejects with the abort reason.',
      },
    ],
    strengths: [
      'One of the few specs that asserts a resource bound (folder reads) rather than behavior only.',
    ],
    gaps: [
      'No git markers are generated in the bound test, so the number of listWorktrees calls when a home folder contains many repositories is not bounded by any test.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/inventory.spec.ts',
    areas: ['inventory', 'connection'],
    kind: 'http',
    real: [
      'git init',
      'sqlite',
      'fastify inject and loopback fetch',
      'restart',
      'filesystem rename',
    ],
    fakes: ['GitFactory that throws, in the sanitization test'],
    tests: [
      {
        name: 'registers, refreshes and persists inventory through authenticated HTTP',
        asserts:
          'Exact schema round trip, duplicate registration returns the same project, no-store, restart equality, moved checkout becomes unavailable on refresh.',
      },
      {
        name: 'rejects unauthenticated operations before validation or discovery and sanitizes failures',
        asserts:
          '401 for three bad tokens on each route, 400 for invalid payloads, no git calls before auth, 500 without private text.',
      },
      {
        name: 'reports an uninspectable checkout without returning Git diagnostics',
        asserts:
          'Non-repository path gives 422 REPOSITORY_UNAVAILABLE and nothing is persisted.',
      },
    ],
    strengths: [
      'Asserts exact bodies (toEqual) rather than shapes, and checks that auth runs before any Git work.',
    ],
    gaps: [
      'Refresh cost is not bounded (10 git processes for one project with 4 checkouts, 24 with 11, measured).',
      'GET /inventory is cheap (no git), but nothing pins that, so a regression that refreshes on read would pass.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/project-locations.spec.ts',
    areas: ['inventory', 'connection'],
    kind: 'http',
    real: [
      'git (isolated wrapper) including a linked worktree',
      'filesystem with symlinks, a loop, node_modules and a bad marker',
      'sqlite',
      'loopback fetch with AbortController',
    ],
    fakes: ['ProjectFolders in the auth and disconnect tests'],
    tests: [
      {
        name: 'finds unregistered repositories and browses folders without changing inventory or repositories',
        asserts:
          'Folder listing contents, one discovered project for main + linked checkouts, repository flags, inventory still empty, repository status unchanged, 400/404/422 without leaking the home path.',
      },
      {
        name: 'authenticates and validates before reading any server folders',
        asserts:
          '401 and 400 with zero folder reads; failure is a sanitized 500.',
      },
      {
        name: 'bounds directory listings and honors cancellation',
        asserts:
          '2001 folders are truncated to 2000; a pre-aborted read rejects.',
      },
      {
        name: 'cancels discovery when its browser request disconnects',
        asserts: 'Aborting the fetch aborts the server-side folder read.',
      },
    ],
    strengths: [
      'Real messy home-folder shapes (symlink loop, node_modules, hidden folders) and a real listing bound.',
      'The only HTTP spec that proves a browser disconnect cancels server work; the pattern exists but is applied to two routes only.',
    ],
    gaps: [
      'Discovery time and git process count with many repositories under home are not bounded.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/project-locations.spec.ts',
    areas: ['inventory', 'lifecycle'],
    kind: 'integration',
    real: [
      'openApplication with sqlite and its separate discovery, browsing and operations runners',
    ],
    fakes: ['ProjectFolders (hangs on the home folder until aborted)'],
    tests: [
      {
        name: 'keeps browsing and inventory refresh responsive during discovery and cancels the scan on shutdown',
        asserts:
          'Browse and refresh complete while discovery hangs; close aborts the scan with ApplicationClosedError.',
      },
    ],
    strengths: [
      'Directly tests runner separation, the design choice that keeps a slow scan from blocking the app.',
    ],
    gaps: [
      'There is no equivalent test for the operations runner, where status, evidence, file reads and Git actions for every worktree share one queue.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/http/routes/remove-project.spec.ts',
    areas: [
      'inventory',
      'review-layers',
      'comments',
      'artifacts',
      'files',
      'git-actions',
    ],
    kind: 'http',
    real: [
      'git (commit, worktree add/remove)',
      'sqlite inspected directly with node:sqlite',
      'loopback fetch',
      'restart',
    ],
    fakes: ['Receipt and preparation rows inserted directly into SQLite'],
    tests: [
      {
        name: 'erases current and disappeared worktree data, preserves other projects and leaves Git untouched across restart',
        asserts:
          'Per-table rows for the removed project are gone (including a disappeared worktree), the other project keeps its rows, foreign keys are consistent, HEAD/index/worktrees/files unchanged, re-registration starts empty.',
      },
      {
        name: 'authenticates before validation and rejects removal of a recovery-blocked project',
        asserts:
          '401, 400, then 409 PROJECT_REMOVAL_BLOCKED with inventory unchanged.',
      },
    ],
    strengths: [
      'Checks the database table by table and the repository byte for byte; very little could slip through.',
    ],
    gaps: [
      'Reviewed marks and commit review-layer snapshots are not in the per-table check list.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/http/routes/review-layers.spec.ts',
    areas: ['review-layers'],
    kind: 'http',
    real: [
      'git init',
      'sqlite',
      'fastify inject and loopback fetch',
      'restart',
    ],
    fakes: [],
    tests: [
      {
        name: 'stores ordered metadata with atomic revision conflicts, refresh retention and restart durability over HTTP',
        asserts:
          'Two concurrent PUTs at revision 0 give exactly one 200 and one 409; reorder round-trips; eight bad paths and duplicates are 400; refresh and restart keep exact bodies; unknown worktree 404.',
      },
    ],
    strengths: [
      'Real optimistic-concurrency race and exact body equality across refresh and restart.',
    ],
    gaps: [
      'Size limits (number of layers, files, note length) are not exercised.',
      'Layers that reference files no longer in the change set are neither reported nor tested.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/replace-review-layers.spec.ts',
    areas: ['review-layers'],
    kind: 'unit',
    real: ['ReplaceReviewLayers'],
    fakes: ['ReviewLayerStore that throws on read and on replace'],
    tests: [
      {
        name: 'keeps conflict handling with the atomic storage owner without retrying stale intent',
        asserts:
          'No preflight read, one replace attempt at the submitted revision, the conflict propagates.',
      },
    ],
    strengths: [
      'Pins a deliberate design choice (no read-then-write race, no retry).',
    ],
    gaps: [
      'The use case is a thin delegate, so this spec protects little on its own; real behavior is in the route spec.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/commit-review-layers.spec.ts',
    areas: ['review-layers', 'history'],
    kind: 'http',
    real: [
      'git (linked worktree, external commits, clone, merge, rename, delete)',
      'sqlite',
      'loopback fetch',
      'restart',
      'project removal',
    ],
    fakes: [],
    tests: [
      {
        name: 'preserves ordered subsets for external split commits across live edits, worktree removal, restart and project removal',
        asserts:
          'Exact snapshots per commit, 409 on revision conflict and on changed association, 400 on invalid references, per-project isolation, snapshots survive worktree removal and restart, project removal erases them.',
      },
      {
        name: 'authenticates before validating association identities and rejects ambiguous path selections',
        asserts:
          '401 before 400; empty, escaping or scope-ambiguous references are 400; unknown project 404.',
      },
      {
        name: 'binds review order to the chosen merge parent and uses committed rename and deletion paths',
        asserts:
          'Merge requires parent 2, rename/delete paths come from the commit, unknown commit is 422 on PUT and null on GET.',
      },
    ],
    strengths: [
      'Real merge, rename and deletion commits with exact snapshot bodies; strong state-machine coverage.',
    ],
    gaps: [
      'Association cost on a large commit (thousands of paths) is not covered.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/http/routes/comments.spec.ts',
    areas: ['comments'],
    kind: 'http',
    real: [
      'git init',
      'sqlite',
      'loopback fetch and inject',
      'restart',
      'filesystem rename',
    ],
    fakes: ['Clock injected in the authorship test'],
    tests: [
      {
        name: 'persists authenticated discussion across refresh, unavailability and restart over real HTTP',
        asserts:
          'Exact thread after restart, 100-thread capacity then 409 COMMENT_LIMIT_EXCEEDED, concurrent replies both stored in order, idempotent resolve, script text kept literal.',
      },
      {
        name: 'authenticates every operation and rejects malformed anchors, bodies and cross-scope targets safely',
        asserts:
          '401 on every route, 404 for unknown worktree, 400 for 20+ malformed inputs, 404 NOT_FOUND for missing threads.',
      },
      {
        name: 'assigns reviewer authorship and the application clock without trusting public author or timestamp fields',
        asserts:
          'author/createdAt in the payload are 400; server assigns reviewer and the injected time.',
      },
    ],
    strengths: [
      'Capacity, authorship and anchor validation are pinned with exact bodies over real persistence.',
    ],
    gaps: [
      'Create, reply and resolve go through the shared operations queue (only list bypasses it); a comment posted during a slow evidence read or a commit hook is not tested.',
      'Every mutation returns the full thread list; response size at capacity is not checked.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/comment-threads.spec.ts',
    areas: ['comments'],
    kind: 'unit',
    real: ['CommentThreads', 'commentStorageSize'],
    fakes: [
      'In-memory CommentStore whose usage() sums commentStorageSize',
      'In-memory InventoryStore',
    ],
    tests: [
      {
        name: 'preserves literal anchors and reply order, isolates scope, and sets resolution idempotently',
        asserts:
          'Anchor snapshot, message order and ids, idempotent resolve, retention after the worktree leaves inventory, cross-scope errors.',
      },
      {
        name: 'bounds thread and message additions without blocking resolution at capacity or reading all threads',
        asserts:
          '100 threads / 100 messages caps, no list() during mutations, resolve still allowed at capacity.',
      },
      {
        name: 'enforces the UTF-8 serialized aggregate budget and allows resolution at exactly one MiB',
        asserts:
          'At exactly 1 MiB, replies and new threads are rejected and resolution toggles without changing size.',
      },
      {
        name: 'preserves comparison targets through storage and rejects mutable commit anchors',
        asserts:
          'Commit comparison anchors round-trip; a symbolic revision is rejected.',
      },
    ],
    strengths: [
      'Precise boundary tests (exact byte budget, capacity with resolution allowed) and a guard against loading all threads on writes.',
    ],
    gaps: [
      'The 1 MiB boundary is proven against the in-memory usage(); the SQLite query computes usage differently, and parity is left to the repository spec outside this audit.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/comment-application.spec.ts',
    areas: ['comments'],
    kind: 'integration',
    real: ['openApplication with sqlite', 'git init'],
    fakes: [],
    tests: [
      {
        name: 'rejects invalid application input without persistence and captures command intent before queueing',
        asserts:
          'Mutation after the call does not change the stored thread; 14 invalid commands throw InvalidCommentError and leave the list unchanged.',
      },
    ],
    strengths: [
      'Validates at the application boundary, not only in HTTP schemas, which protects the MCP path too.',
    ],
    gaps: [
      'Overlaps heavily with the route spec; nothing about queueing behind other work.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/artifacts.spec.ts',
    areas: ['artifacts'],
    kind: 'http',
    real: [
      'git',
      'sqlite (also opened directly with ArtifactRepository)',
      'loopback fetch and inject',
      'restart',
    ],
    fakes: [],
    tests: [
      {
        name: 'uploads and retrieves inert HTML over real authenticated JSON, preserving content through refresh and restart outside Git',
        asserts:
          'Nothing written to the checkout, JSON content type with nosniff and no-store, exact content after restart, cross-worktree isolation, idempotent delete.',
      },
      {
        name: 'authenticates all artifact routes before parsing and rejects unknown scope and caller path fields',
        asserts:
          '401 before JSON parsing, 404 for unknown worktree, 400 for a path field and an encoded traversal id.',
      },
      {
        name: 'rejects malformed UTF-8 and Unicode, bounds request bytes, and accepts exact content limit with escaped JSON',
        asserts:
          'Invalid UTF-8, lone surrogate, over-limit and oversized bodies are 400; exactly the byte limit is accepted.',
      },
      {
        name: 'reports aggregate quota exhaustion safely through HTTP and permits recovery by deletion',
        asserts:
          '16 full artifacts then 409 ARTIFACT_QUOTA_EXCEEDED; deletion frees quota.',
      },
      {
        name: 'retains removed worktree storage while denying access through its absent inventory identity',
        asserts:
          'After worktree removal every route is 404 while the row still exists in SQLite.',
      },
    ],
    strengths: [
      'Byte-exact limits, quota recovery and XSS-inert delivery are all checked over real HTTP.',
    ],
    gaps: [
      'Uploads use the shared operations queue; an agent publishing during a slow evidence read or commit hook is not tested.',
      'Listing with 16 x 1 MiB artifacts is not checked to stay metadata-only (the repository selects metadata columns, but nothing pins it).',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/artifacts.spec.ts',
    areas: ['artifacts'],
    kind: 'unit',
    real: ['Upload/List/Get/DeleteArtifact validation'],
    fakes: ['ArtifactStore (vi.fn)', 'InventoryStore'],
    tests: [
      {
        name: 'accepts inert display names and counts UTF-8 bytes for unavailable registered worktrees',
        asserts:
          'Emoji counted as 4 bytes; upload allowed while the worktree is unavailable.',
      },
      {
        name: 'rejects invalid Unicode, empty content, excessive names and the byte limit before persistence',
        asserts:
          'Six invalid inputs never reach the store; exactly the limit is accepted.',
      },
      {
        name: 'requires registered scope for every operation without touching artifact storage',
        asserts: 'Unknown worktree throws before any store call.',
      },
      {
        name: 'returns scoped metadata, reports missing content and makes repeated deletion harmless',
        asserts: 'Pass-through list/get, ArtifactNotFoundError, deleted:false.',
      },
    ],
    strengths: ['Validation-before-persistence is asserted with call spies.'],
    gaps: [
      'Mostly duplicated by the route spec; quota logic lives in the repository and is not reached here.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/files.spec.ts',
    areas: ['files'],
    kind: 'http',
    real: [
      'git init and linked worktree',
      'filesystem (symlinks, encoded names, 10 MiB file, .gitignore)',
      'sqlite',
      'loopback fetch and inject',
    ],
    fakes: ['FileReader in the auth and error-mapping tests'],
    tests: [
      {
        name: 'serves bounded preview assets while rejecting unauthenticated, escaping and symlink reads',
        asserts:
          'Exact base64 PNG body, 401, traversal/symlink/.git rejected (status >= 400), 10 MiB + 1 is FILE_TOO_LARGE.',
      },
      {
        name: 'lists and reads through real authenticated loopback HTTP with exact public schemas',
        asserts:
          'Exact listing and text body including CRLF, byte length and sha256 fingerprint; no-store.',
      },
      {
        name: 'authenticates before validation and file access; rejects traversal and unknown fields',
        asserts:
          '401 before validation, 400 for six bad queries, 404 unknown worktree, zero file reads.',
      },
      {
        name: 'excludes metadata, refuses symlinks and decodes path queries only once',
        asserts:
          'A file literally named %2e%2e is readable; symlink and .git reads are 422 PATH_NOT_READABLE without the root path; .git hidden from listing.',
      },
      {
        name: 'rejects missing or replaced checkouts and known unavailable inventory',
        asserts:
          'Moved, replaced and refreshed-away checkouts all give REPOSITORY_UNAVAILABLE.',
      },
      {
        name: 'maps every file failure safely without exposing causes or paths',
        asserts:
          'Ten error codes map to exact statuses with only code and message; unknown errors are 500.',
      },
      {
        name: 'reads a linked worktree by its own identity rather than the main checkout',
        asserts: 'Main and linked ids return their own file content.',
      },
      {
        name: 'writes only the expected text version and lists searchable paths including ignored and linked entries',
        asserts:
          'File tree includes ignored dir and symlink target; write with the right fingerprint succeeds, stale write is 409 and leaves disk unchanged; creates outside the root are rejected (>= 400).',
      },
    ],
    strengths: [
      'Excellent path-safety coverage over real HTTP and a real filesystem, including double decoding and replaced checkouts.',
    ],
    gaps: [
      'Every text read, directory listing, asset read and file tree calls listWorktrees twice, which costs 2 + 2 git processes per checkout in the repository: 20 per read with 4 checkouts and 48 with 11 (measured). No spec has more than two checkouts or counts processes.',
      'Two rejection checks use toBeGreaterThanOrEqual(400), which also accepts a 500 crash.',
      'Move and trash edits are not exercised over HTTP; create is only tested for invalid paths.',
      'DIRECTORY_TOO_LARGE and large file trees (node_modules-sized ignored folders, 10k+ tracked files) are only injected, never produced by a real tree.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/use-cases/read-files.spec.ts',
    areas: ['files'],
    kind: 'unit',
    real: [
      'ListDirectory, ReadTextFile, path validation, resolveReadableWorktree',
    ],
    fakes: [
      'GitFactory.listWorktrees (vi.fn returning a mutable discovery)',
      'FileReader (vi.fn)',
      'InventoryStore',
    ],
    tests: [
      {
        name: 'reads only the selected registered worktree and preserves result data',
        asserts:
          'Exact result with sha256 fingerprint; reader receives the registered root.',
      },
      {
        name: 'rejects invalid path %s before filesystem access',
        asserts:
          'Ten invalid paths reject INVALID_REQUEST with no git or file calls.',
      },
      {
        name: 'allows the directory root but rejects empty file paths and Git metadata components',
        asserts:
          'Empty file path is INVALID_REQUEST; .git components are PATH_NOT_READABLE.',
      },
      {
        name: 'rejects unknown or unavailable inventory before inspection',
        asserts:
          'WORKTREE_NOT_FOUND / REPOSITORY_UNAVAILABLE without calling git.',
      },
      {
        name: 'rejects replaced repository and worktree identities without returning content',
        asserts:
          'Identity mismatch on either level is REPOSITORY_UNAVAILABLE before reading.',
      },
      {
        name: 'withholds a result if the registered checkout changes during reading',
        asserts:
          'A checkout that disappears during the read withholds content.',
      },
      {
        name: 'preserves unexpected failures and cancellation',
        asserts:
          'Unknown errors propagate; abort wins over a concurrent error.',
      },
    ],
    strengths: [
      'The before/after identity check around the read is tested explicitly.',
    ],
    gaps: [
      'The discover spy is never counted. The before/after check is exactly what doubles the git cost per read, and a cheaper identity check (or a regression making it worse) would not be visible.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/file-preferences.spec.ts',
    areas: ['files'],
    kind: 'http',
    real: [
      'git init',
      'sqlite (also seeded directly with 2000 rows)',
      'loopback fetch',
      'restart',
    ],
    fakes: [],
    tests: [
      {
        name: 'persists independent file and folder intent through retry, refresh, unavailable checkout and restart over HTTP',
        asserts:
          'Exact sorted preference lists through each step, idempotent clears, colon and 4096-char paths accepted.',
      },
      {
        name: 'isolates projects and rejects unauthenticated, noncanonical, unknown identity and bulk requests safely',
        asserts:
          'Per-project isolation, 401, 14 bad paths and 4 bad bodies are 400, unknown project 404.',
      },
      {
        name: 'returns a safe capacity conflict and permits clearing then adding through HTTP',
        asserts: 'At 2000 rows a new pin is 409; clearing one allows the next.',
      },
    ],
    strengths: ['Includes a real scale case (2000 rows) and exact bodies.'],
    gaps: [
      'Every PUT returns the whole list; response time and size at 2000 rows are not checked.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/set-file-preference.spec.ts',
    areas: ['files'],
    kind: 'unit',
    real: ['SetFilePreference and ListFilePreferences validation'],
    fakes: [
      'FilePreferenceStore whose set() appends rows instead of merging flags',
      'InventoryStore',
    ],
    tests: [
      {
        name: 'requires known identity but permits unavailable inventory and missing paths without Git or filesystem access',
        asserts:
          'Unknown project throws, 13 invalid paths throw without writes, absent and colon paths are accepted.',
      },
    ],
    strengths: ['Shows preferences need no Git or filesystem access.'],
    gaps: [
      'The fake store does not merge flags, so the final list comparison says nothing about merge behavior; that lives in the route spec.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/commit-history.spec.ts',
    areas: ['history'],
    kind: 'http',
    real: [
      'git (commits including a 1 MiB file)',
      'sqlite',
      'loopback fetch and inject',
      'filesystem removal + refresh',
    ],
    fakes: [],
    tests: [
      {
        name: 'lists and inspects registered history through authenticated loopback HTTP with bounded safe failures',
        asserts:
          'limit=1 paging with a cursor to the older commit, empty-tree comparison for the root, 400 for tampered cursor and bad params, 401, 404, 422 snapshot unavailable, 422 READ_LIMIT_EXCEEDED without the path, 422 after checkout removal.',
      },
    ],
    strengths: [
      'Real cursor round trip, tamper rejection and read-limit mapping.',
    ],
    gaps: [
      'A page costs 15 git processes (measured); no test on a deep or wide history for time or process count.',
      'No test of a cursor after the branch tip moves (commit or rebase between pages).',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/use-cases/commit-history.spec.ts',
    areas: ['history'],
    kind: 'unit',
    real: ['ListCommits and InspectCommitChanges guards'],
    fakes: ['CommitReader and factory (vi.fn)', 'InventoryStore'],
    tests: [
      {
        name: 'binds reads to inventory identity and carries the selected comparison and cancellation signal',
        asserts:
          'Factory receives path, identities and scope; the request and signal are forwarded.',
      },
      {
        name: 'rejects unavailable worktrees before invoking Git',
        asserts:
          'Three unavailable shapes throw HistoryWorktreeUnavailableError without a factory call.',
      },
      {
        name: 'does not start Git after cancellation',
        asserts: 'A pre-aborted signal rejects before the factory is called.',
      },
      {
        name: 'reports an unknown worktree separately from unavailable inventory',
        asserts: 'WorktreeNotFoundError for unknown ids.',
      },
    ],
    strengths: ['Guards and signal forwarding are pinned cheaply.'],
    gaps: [
      'Wiring only; history behavior is in the route spec and packages/git.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/mappers/history-response.spec.ts',
    areas: ['history'],
    kind: 'unit',
    real: ['toCommitPageResponse'],
    fakes: [],
    tests: [
      {
        name: 'maps body metadata and keeps full ref names in the HTTP contract',
        asserts:
          'One attached-head page maps to an identical commit and parses with the schema.',
      },
    ],
    strengths: ['Keeps full ref names in the contract.'],
    gaps: [
      'Detached and unborn heads, nextCursor and boundary are not covered.',
      'toCommitChangesResponse (binary vs text patches, parent comparison) has no test here.',
    ],
    verdict: 'weak',
  },
  {
    file: 'apps/server/src/http/routes/mcp.spec.ts',
    areas: ['mcp', 'comments', 'review-layers', 'artifacts'],
    kind: 'http',
    real: [
      'MCP SDK client over StreamableHTTP to a real listener',
      'sqlite',
      'git init',
    ],
    fakes: [],
    tests: [
      {
        name: 'serves MCP tools with agent attribution, revision checks and explicit bearer authentication',
        asserts:
          '401 without bearer, 403 with an Origin header; create_comment is authored by agent; reply/resolve/list work (list checked by string contains); spoofed author is an error; replace_layers conflicts on a stale revision; publish_artifact is not an error.',
      },
    ],
    strengths: [
      'Uses the real MCP client and transport, and checks that browser-origin requests and author spoofing are refused.',
    ],
    gaps: [
      'inventory, git_status, review_evidence, read_file and read_layers are never called. review_evidence loads every diff (84-258 git processes cold, measured) only to return fingerprints and change identities.',
      'Error results are only checked with isError; the mapped error code inside the tool result is never asserted.',
      'publish_artifact success is not verified by reading the artifact back.',
      'No test that a disconnecting agent cancels its tool call.',
    ],
    verdict: 'weak',
  },
  {
    file: 'apps/server/src/http/server.spec.ts',
    areas: ['connection', 'lifecycle'],
    kind: 'http',
    real: ['fastify with a real listener', 'sqlite', 'fetch'],
    fakes: ['GitFactory that never resolves until aborted (shutdown test)'],
    tests: [
      {
        name: 'cancels in-flight discovery before waiting for HTTP requests to finish on shutdown',
        asserts:
          'Closing during a hanging registration returns 503 to the client.',
      },
      {
        name: 'serves a validated health response without unauthenticated inventory access or opening a listener',
        asserts:
          'Health 200 via inject, inventory 401, the data directory can be reopened after close.',
      },
      {
        name: 'responds over a task-owned loopback listener and shuts it down',
        asserts: 'Health over fetch, listener closed afterwards.',
      },
      {
        name: 'keeps the browser API under /api while retaining root API compatibility',
        asserts:
          'Cookie Path=/api, session works with the cookie, root routes still accept bearer tokens.',
      },
      {
        name: 'uses the Zod response serializer to remove undeclared fields',
        asserts: 'An undeclared privatePath field is stripped.',
      },
      {
        name: 'sanitizes failures outside the inventory plugin without treating arbitrary 4xx errors as validation',
        asserts:
          'A thrown 401-like error becomes 500 INTERNAL_ERROR; real 401 carries WWW-Authenticate.',
      },
      {
        name: 'maps malformed authenticated JSON to a safe invalid request',
        asserts: 'Broken JSON is 400 INVALID_REQUEST.',
      },
    ],
    strengths: [
      'Shutdown ordering and response sanitization are tested at the framework level where they are easy to break.',
    ],
    gaps: [
      'Shutdown with a queue full of pending reads (not just one discovery) is not tested.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/http/server-workflow.spec.ts',
    areas: [
      'connection',
      'inventory',
      'files',
      'changes',
      'history',
      'review-layers',
      'comments',
      'artifacts',
    ],
    kind: 'http',
    real: ['git with a linked worktree', 'sqlite', 'loopback fetch', 'restart'],
    fakes: [],
    tests: [
      {
        name: 'keeps review metadata together across Git inspection, refresh and a server restart',
        asserts:
          'Directory, text, status and commits respond; preferences resolve to one project from either checkout; layers, comments, preferences and artifact content are equal after restart.',
      },
    ],
    strengths: [
      'A cross-area smoke test through real HTTP that catches wiring regressions between routes.',
    ],
    gaps: [
      'Mostly shape checks (toMatchObject, arrayContaining) for the Git reads; one changed file.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/routes/browser-session.spec.ts',
    areas: ['connection'],
    kind: 'http',
    real: ['fastify inject', 'sqlite', 'restart'],
    fakes: ['Date.now mocked to expire the session'],
    tests: [
      {
        name: 'persists browser authentication across restart, requires CSRF headers, and expires sessions',
        asserts:
          'HttpOnly/SameSite=Strict/30-day cookie without the token; cookie alone is 401 without the browser header; a tampered cookie is 401; DELETE /session needs the header and clears the cookie; the same cookie still works after restart; expiry after 31 days.',
      },
    ],
    strengths: [
      'Covers CSRF header, tampering and expiry for the HMAC cookie.',
    ],
    gaps: [
      'The test reuses the cookie after DELETE /session and expects 200 after restart: logout only clears the browser copy, and a copied cookie stays valid for 30 days. The spec encodes that rather than questioning it.',
      'Token rotation (restart with a different token must invalidate old cookies) is not tested.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/http/static-files.spec.ts',
    areas: ['connection'],
    kind: 'http',
    real: ['fastify inject', 'filesystem with a symlink out of the root'],
    fakes: [],
    tests: [
      {
        name: 'rejects traversal and malformed URL paths before filesystem access',
        asserts:
          'Encoded and backslash traversal and malformed escapes resolve to null.',
      },
      {
        name: 'serves assets, client routes and safe cache policies without shadowing the API',
        asserts:
          'Shell for client routes with no-cache, immutable for hashed assets, HEAD length, 404 for missing asset and unknown API, POST 404.',
      },
      {
        name: 'does not follow a symlink out of the configured web root',
        asserts: 'Symlinked secret is 404 without content.',
      },
      { name: 'maps %s to %s', asserts: 'Content types for seven extensions.' },
    ],
    strengths: ['Security and cache headers pinned exactly.'],
    gaps: ['None significant for its scope.'],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/main.spec.ts',
    areas: ['lifecycle', 'connection'],
    kind: 'process',
    real: [
      'node child process running main.ts',
      'signals (SIGTERM, SIGINT, SIGKILL)',
      'git',
      'sqlite',
      'fetch',
      'data directory lock file',
    ],
    fakes: [],
    tests: [
      {
        name: 'runs registration and refresh, survives restart, and exits cleanly on both shutdown signals',
        asserts:
          'Loopback address, 401 without token, a second process on the same data directory exits 1 with an ownership message, clean exit 0 on SIGTERM and SIGINT, no token in output.',
      },
      {
        name: 'serves the configured SPA and the /api namespace from one process',
        asserts:
          'Shell, client route, immutable asset, /api/health, API 404 not shadowed.',
      },
      {
        name: 'retains a crash ownership file until explicit operator recovery',
        asserts:
          'After SIGKILL the lock remains and blocks start until removed.',
      },
      {
        name: 'exits unsuccessfully on invalid configuration without leaking its token or creating state',
        asserts:
          'Port -1 exits 1, no stdout, no token in stderr, no database created.',
      },
    ],
    strengths: [
      'Real process lifecycle, including crash recovery and single ownership of the data directory.',
    ],
    gaps: [
      'Shutdown while a Git action hook or a long evidence read is running is not exercised at process level.',
    ],
    verdict: 'strong',
  },
];

export const serverAreaSummaries: AreaTestSummary[] = [
  {
    area: 'changes',
    verdict: 'weak',
    summary:
      'Correctness is well covered: stale status tokens, drift during a diff, fingerprints, byte bounds and stale reviewed marks are all pinned, partly with real Git. Cost is not covered at all: Git is faked in the evidence unit spec, spies count readDiffs calls rather than processes, and every real-Git fixture has one to three changed files, so nothing could have caught evidence spawning 84 processes for 50 files or 258 for 200 (measured). The new cache is tested with fake stamps or files backdated 60 s, which hides that any edit in the last 2 s makes every call a full miss.',
    missing: [
      'Cold GET /evidence for 200 changed files spawns at most N git processes (count with a PATH wrapper like createIsolatedGit; today 258).',
      'A warm GET /evidence spawns at most 13 git processes and reads no diffs, using the real readFileStamps.',
      'While one file keeps changing (agent editing), evidence re-reads only that file instead of every changed file.',
      'A single POST /git/diff spawns at most N processes (today 35: two full status reads plus the diff).',
      'Aborting the browser request for /evidence or /git/diff aborts the queued or running Git work (routes do not pass the request signal today).',
      'Two concurrent cold /evidence requests for one worktree compute it once.',
      'A real repository with more than 2000 changes returns 413 INSPECTION_LIMIT over HTTP.',
      'readFileStamps: the 2-second "recent" rule and missing files, with a real filesystem.',
    ],
  },
  {
    area: 'inventory',
    verdict: 'adequate',
    summary:
      'Identity and availability are among the best-tested parts of the server: real worktree moves, removals, substitutions, restarts and property tests for reconciliation. The per-worktree review summary is tested only for counts on a one-worktree fixture, and refresh and discovery have no bound on Git work as projects and worktrees grow.',
    missing: [
      'Review summaries for 20 worktrees (the sidebar) spawn at most N git processes in total and finish within a time budget.',
      'A summary for a worktree with one reviewed mark does not read every diff in that worktree.',
      'GET /review-summary is cancelled when the browser drops the request.',
      'Refresh of 10 projects with 5 worktrees each has bounded process count and does not hold foreground reads for its whole duration.',
      'Discovery under a home folder with 50 repositories bounds listWorktrees calls.',
    ],
  },
  {
    area: 'files',
    verdict: 'adequate',
    summary:
      'Path safety is excellent: traversal, symlinks, .git, double decoding, replaced checkouts and error sanitization are all checked over real HTTP. Every read verifies the checkout by listing all worktrees twice, which scales with the number of worktrees (48 git processes for one text read with 11 checkouts, measured), and no spec uses more than two checkouts or counts processes.',
    missing: [
      'Opening one file in a repository with 10 linked worktrees spawns at most N git processes (today 48).',
      'File tree and directory listing on a 20k-file tree with a large ignored folder stay within size and time bounds.',
      'Traversal and symlink rejections assert the exact 4xx code instead of >= 400.',
      'Move and trash edits over HTTP, including destinations outside the root and stale fingerprints.',
    ],
  },
  {
    area: 'git-actions',
    verdict: 'strong',
    summary:
      'Safety invariants are tested thoroughly: one launch per preparation, staleness after prepare, quarantine that survives restart and storage failures, idempotent receipts, and a dropped socket during a hanging hook. The gaps are about interaction with the rest of the server: actions share one queue with every read, and drafting or preparing a commit reads evidence for the whole worktree.',
    missing: [
      'A commit with a 60 s pre-commit hook does not make status or evidence for another project wait or time out at 30 s.',
      'Drafting a commit for 1 of 200 changed files reads evidence only for that file.',
      'prepareCommit with expectedFiles reads evidence only for the expected paths.',
      'Fetch and push over HTTP, including a rejected push receipt, and stash apply.',
    ],
  },
  {
    area: 'review-layers',
    verdict: 'strong',
    summary:
      'Live layers and commit snapshots are tested with real concurrency (one 200 and one 409), real merge, rename and delete commits, restart and project removal, all with exact bodies. What is missing is size limits and what happens to layers whose files are no longer changed.',
    missing: [
      'Maximum layers, files per layer and note length are enforced over HTTP.',
      'Layers referencing files that are no longer in the change set are reported or handled deliberately.',
    ],
  },
  {
    area: 'comments',
    verdict: 'strong',
    summary:
      'Capacity, byte budget, authorship and anchor validation are pinned at the boundary values, and listing is proven not to wait for slow evidence. Creating, replying and resolving still go through the shared operations queue, which is untested under load.',
    missing: [
      'Posting a comment while a cold evidence read or a commit hook is running completes promptly.',
      'At the 1 MiB budget, the SQLite usage query and commentStorageSize agree through HTTP.',
    ],
  },
  {
    area: 'artifacts',
    verdict: 'strong',
    summary:
      'Byte-exact limits, quota and recovery, inert delivery headers and retention after worktree removal are all covered over real HTTP and SQLite. Only queueing behind other work and listing cost at quota are open.',
    missing: [
      'publish_artifact or POST /artifacts during a running commit hook completes or fails fast.',
      'Listing a worktree at full quota (16 x 1 MiB) does not read content.',
    ],
  },
  {
    area: 'history',
    verdict: 'adequate',
    summary:
      'The route spec uses real commits for cursor paging, tamper rejection, the read limit and unavailable checkouts, and review-layer snapshots cover merges. The mapper spec covers only one attached-head page, and nothing checks deep histories or a cursor after the tip moves.',
    missing: [
      'A page from a 50k-commit repository spawns at most N git processes and returns within a time budget.',
      'A cursor taken before a new commit or rebase gives a defined result (stable page or HISTORY_SNAPSHOT_UNAVAILABLE).',
      'Mapper tests for detached and unborn heads and for toCommitChangesResponse.',
    ],
  },
  {
    area: 'mcp',
    verdict: 'weak',
    summary:
      'One test drives the real MCP client and proves bearer-only access, agent attribution and revision conflicts. Five of eleven tools are never called, including review_evidence, which reads every diff only to return fingerprints, and errors are checked only with isError.',
    missing: [
      'review_evidence on a 200-change worktree: bounded git processes and a payload without diff content.',
      'git_status, read_file, read_layers and inventory tool calls with value assertions.',
      'Tool errors carry the mapped code (for example WORKTREE_NOT_FOUND, REVISION_CONFLICT).',
      'An agent disconnect cancels its running tool call.',
    ],
  },
  {
    area: 'connection',
    verdict: 'strong',
    summary:
      'Bearer and cookie authentication, CSRF headers, sanitized errors, the /api prefix and static file safety are pinned with exact bodies and headers. The session spec accepts that logout does not revoke a copied cookie, and token rotation is not tested.',
    missing: [
      'Restarting with a different token rejects cookies issued under the old token.',
      'A decision test for logout: either server-side revocation, or an explicit spec that documents the 30-day copied-cookie window.',
    ],
  },
  {
    area: 'lifecycle',
    verdict: 'adequate',
    summary:
      'Startup, shutdown, crash-lock recovery and cancellation of discovery are tested at process and HTTP level, and discovery, browsing and summaries are proven to run on separate queues. The main operations queue, shared by every worktree for status, evidence, files and Git actions, has no load test: HTTP routes except discovery and commit drafts do not pass the request abort signal, and queued work times out after 30 s including wait time.',
    missing: [
      'Twenty queued reads whose browser requests are aborted are cancelled and spawn no git processes.',
      'A slow operation in one worktree does not starve reads for another worktree beyond a stated bound.',
      'Queued reads behind a 120 s Git action return a defined error rather than an unexplained 503 at 30 s.',
      'Shutdown with a full operations queue completes within a time budget.',
    ],
  },
];
