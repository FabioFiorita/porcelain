import type { AreaTestSummary, SpecAudit } from './types.ts';

// Audit of the core server specs: packages/git, packages/contracts,
// packages/client and apps/server/src/{agents,cli,db,development,filesystem,
// lifecycle,repositories}. Working tree as of 2026-09-18, including uncommitted
// changes (readDiffs batching, file stamps, diagnostics channels).
//
// Process counts marked "measured" come from a scratch run that put a counting
// git wrapper on PATH (the technique used by fixtures/isolated-git) around the
// real adapters on a disposable repository: readStatus 13, readDiff (1 file) 9,
// readDiffs (20 files) 28, listWorktrees (1 worktree) 4, listCommits (page of
// 50) 64, inspectCommitChanges 11, ActionGit.inspect 21. On a repository with
// 12,000 tracked files, ActionGit.inspect rejected with UNSUPPORTED_CONFIGURATION;
// one new unignored folder of 2,001 files made readStatus throw
// InspectionLimitError. No spec in this scope counts processes or time.

export const coreSpecAudits: SpecAudit[] = [
  // ---------------------------------------------------------------- packages/git
  {
    file: 'packages/git/src/inspection-git.spec.ts',
    areas: ['changes'],
    kind: 'integration',
    real: [
      'git (disposable repositories, linked worktrees, partial clones, submodules)',
      'filesystem',
      'child-process (execFile git)',
    ],
    fakes: [
      'none: identities come from real stat of .git; helpers are real scripts that leave marker files',
    ],
    tests: [
      {
        name: 'reads separate staged and unstaged rename changes without modifying the checkout or index',
        asserts:
          'Exact change array (staged rename + unstaged modify, modes, supported); staged diff is metadata-only with rename header; unstaged diff has +working; index bytes, refs, file content and statusToken unchanged.',
      },
      {
        name: 'handles unborn additions, individual untracked files and literal unusual names',
        asserts:
          'headOid null; untracked file listed individually; ignored file absent; diff of a glob-like name with newline and tab contains +literal and not the neighbouring file.',
      },
      {
        name: 'reports untracked nested repositories without rejecting their directory marker',
        asserts:
          'Exact changes: untracked apps/web (no trailing slash) and notes.txt.',
      },
      {
        name: 'reports deletions, binary files, executable changes and symlink targets without reading target content',
        asserts:
          'Deleted file diff has -remove me; binary is exactly {kind: binary}; mode change is metadata-only; readDiffs of 3 changes deep-equals 3 readDiff calls (new); symlink is type-changed and the target file text never appears.',
      },
      {
        name: 'marks gitlinks unsupported without recursing into their diffs',
        asserts: 'supported false; diff is omitted/unsupported-submodule.',
      },
      {
        name: 'keeps selected file deletions separate from added descendants and preserves renames into a former file directory',
        asserts:
          'Exact-pathspec isolation: deletion of foo excludes foo/bar; rename to foo/bar excludes foo/other content.',
      },
      {
        name: 'selects exact Unicode and glob-like names even when a former file now contains descendants',
        asserts:
          'For 6 unusual names, the staged deletion diff has -original and no descendant content.',
      },
      {
        name: 'lists real merge conflicts separately and refuses to inspect replaced checkout identity',
        asserts:
          'UU conflict record; after .git is replaced, readStatus rejects RepositoryIdentityMismatchError.',
      },
      {
        name: 'bounds status and diff output and reports unsupported text encoding without lossy decoding',
        asserts:
          '1 MB file diff is omitted/size-limit; invalid UTF-8 is omitted/unsupported-encoding; 2,001 untracked files make readStatus reject InspectionLimitError.',
      },
      {
        name: 'rejects linked worktrees redirected to a different common repository without replacing checkout metadata',
        asserts:
          'Rewriting commondir makes both readStatus and readDiff reject RepositoryIdentityMismatchError.',
      },
      {
        name: 'rejects invalid UTF-8 filenames, preserves cancellation and disables configured diff programs',
        asserts:
          'diff.external and textconv helper never run (marker absent); pre-aborted signal rejects AbortError; 0xff index path rejects UnsupportedPathEncodingError.',
      },
      {
        name: 'ignores replacement objects when comparing HEAD with staged content',
        asserts:
          'Staged diff is against the real HEAD blob, not the replace ref.',
      },
      {
        name: 'rejects configured conversion drivers before status or working-tree diff can execute helpers',
        asserts:
          'For clean, process and smudge: status and diff reject UnsupportedGitFiltersError, helper marker absent, index/refs/file unchanged.',
      },
      {
        name: 'does not lazily fetch promised blobs during status or selected diff inspection',
        asserts:
          'Missing-object list unchanged and fetch marker absent after status and a failing diff.',
      },
      {
        name: 'allows unused configured filters without invoking them',
        asserts: 'Diff succeeds; unused filter marker absent.',
      },
      {
        name: 'rejects literal driver names that also spell Git attribute-state markers',
        asserts:
          'filter=set/unset/unspecified with a configured driver is rejected; marker absent.',
      },
      {
        name: 'does not inspect submodule working files or run their conversion drivers',
        asserts:
          'Status empty; submodule filter marker absent; parent index and module file unchanged.',
      },
    ],
    strengths: [
      'Real git on disposable repositories, with exact expected values (whole change arrays, specific error classes) rather than shape checks.',
      'Adversarial isolation coverage (filter drivers, textconv, external diff, replace objects, lazy fetch, commondir redirection, symlink targets) proven by side-effect marker files that show a helper never ran.',
      'Read-only guarantee checked by comparing index bytes, refs and working content before and after.',
      'Exact pathspec selection tested with glob-like, newline, tab and Unicode names and file-to-directory transitions.',
    ],
    gaps: [
      'No process-count or duration assertion anywhere. Measured: readStatus spawns 13 git processes (identity verified before and after = 4; conversion-filter check run twice, each config + full ls-files + check-attr over every tracked file = 6; status, for-each-ref, stash list). readDiff of one file = 9.',
      'The new readDiffs test only asserts that batch results equal per-file readDiff results. Reimplementing readDiffs as a loop over readDiff, i.e. the ~10-processes-per-file behaviour the change exists to remove, would still pass. Filters checked once per batch and identity once per call are unprotected.',
      'Batch test has 3 unstaged changes: it never crosses the 8-wide chunk, never mixes staged and unstaged, and never includes a submodule, a size-limit item, a failing item or mid-batch cancellation; order preservation across chunks is untested.',
      'readDiffs([]) still spawns 4 rev-parse processes for identity; the evidence use case calls it for every group of 64 even when the group is all untracked. Untested.',
      'The 2,001-untracked test enshrines that one new unignored folder (build output, virtualenv) makes status, evidence and the Changes view fail outright (measured); nothing checks graceful degradation.',
      'No real-repo shapes: largest fixture is about 2,000 files. checkConversionFilters lists every tracked file twice per status (8 MB ls-files cap, 16 MB check-attr cap), so a ~100k-file repo would fail status with InspectionLimitError. (Measured 372 ms for readStatus on 12k tracked + 10k ignored files, so ignored trees are fine today, but nothing guards it.)',
      'status.branch (upstream, ahead/behind, detached, remoteName, sourceRef, stashes) is never asserted, here or in parse-git-status.spec; the 1 MB for-each-ref cap with thousands of branches is untested.',
      'The 10 s execFile timeout (GitInspectionTimeoutError) is never exercised; cancellation is only tested with an already-aborted signal.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/git/src/mappers/parse-git-status.spec.ts',
    areas: ['changes'],
    kind: 'unit',
    real: ['parseGitStatus on Buffer input'],
    fakes: ['hand-written porcelain v2 records'],
    tests: [
      {
        name: 'preserves unusual path bytes and rejects malformed records instead of producing wrong identities',
        asserts:
          'Path with leading space, tab and newline preserved; missing terminator, unknown record, bad conflict code and truncated rename throw; missing branch.oid throws InvalidGitStatusError; 0xff throws UnsupportedPathEncodingError.',
      },
      {
        name: 'normalizes only the final untracked directory marker and still rejects unsafe paths',
        asserts:
          'apps/web/ becomes apps/web; /, ../web/, apps//web/, apps/web// rejected with UnsupportedPathEncodingError.',
      },
    ],
    strengths: ['Exact values; prefers rejection over lossy parsing.'],
    gaps: [
      'No ordinary (1) or rename (2) tracked records are parsed here at all: staged/unstaged split, modes, the submodule S flag and supported are only covered indirectly through real git in inspection-git.spec.',
      'Branch headers (branch.head, detached, branch.upstream, branch.ab +N -M) are untested anywhere in packages/git, although the Git menu relies on ahead/behind.',
      'The 2,000-change limit and statusToken (sha256 of raw output) are not tested at the parser.',
      'Four malformed cases use bare toThrow(), so a TypeError from a parser bug would also pass.',
      'A natural fit for property tests (fast-check is already a root dependency): generated records round-trip and only typed errors are thrown.',
    ],
    verdict: 'weak',
  },
  {
    file: 'packages/git/src/mappers/parse-commit.spec.ts',
    areas: ['history'],
    kind: 'unit',
    real: ['parseCommit on raw commit text'],
    fakes: ['synthetic raw commit objects'],
    tests: [
      {
        name: 'separates a subject from an absent or empty body',
        asserts:
          'body null for Subject\\n and Subject\\n\\n; bodyTruncated false.',
      },
      {
        name: 'keeps body line breaks and indentation',
        asserts: 'Exact body with blank line and leading spaces.',
      },
      {
        name: 'truncates the body at a valid UTF-8 boundary',
        asserts: '4,095 a + emoji becomes 4,095 a with bodyTruncated true.',
      },
    ],
    strengths: ['Exact values at the UTF-8 truncation boundary.'],
    gaps: [
      'Malformed author line or missing header separator (UnsupportedHistoryDataError) untested.',
      'Parent parsing, leading blank lines before the subject and non-UTF-8 commit encodings untested.',
      'No property tests for arbitrary message bytes.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/git/src/commit-git.spec.ts',
    areas: ['history'],
    kind: 'integration',
    real: [
      'git (sha1 and sha256 repos, shallow and partial clones, merges, octopus, replace refs)',
      'filesystem',
      'child-process',
      'Git.listWorktrees for real identities',
    ],
    fakes: ['none; global and system Git config disabled through env'],
    tests: [
      {
        name: 'maps lightweight and annotated refs once per page without leaking refs from other commits',
        asserts:
          'Exact ref list on the tip (heads, remote, both tags); root commit on page 2 has no refs. Does not check that refs are read once per page despite the name.',
      },
      {
        name: 'keeps all ancestors in topological order across ref movement, reset and deletion',
        asserts:
          'Continuation after reset and branch deletion equals git rev-list --topo-order of the snapshot tip (git as oracle).',
      },
      {
        name: 'rejects tampered, cross-worktree and restarted cursors and honors a cursor page size',
        asserts:
          'InvalidHistoryRequestError for tampered, limit mismatch, other scope and other key; valid cursor yields 1 commit.',
      },
      {
        name: 'marks shallow history and rejects continuation after deepening without treating a boundary as a root',
        asserts:
          'boundary shallow; inspecting the boundary commit and continuing after unshallow reject HistorySnapshotUnavailableError.',
      },
      {
        name: 'distinguishes unborn and detached HEAD and SHA-256 root inspection',
        asserts:
          'Exact unborn page; detached snapshot; empty-tree comparison with +hello; parent 1 on a root rejects.',
      },
      {
        name: 'compares merge commits against the chosen parent and handles empty commits',
        asserts:
          'Exact comparison base per parent; parent 3 rejects; empty commit has no changes.',
      },
      {
        name: 'detects renames at 50 percent, retains literal unusual paths, and distinguishes binary and modes without modifying the checkout',
        asserts:
          'arrayContaining rename/binary/symlink entries; index, refs and untracked file unchanged.',
      },
      {
        name: 'supports octopus parent selection and reports gitlinks, mode changes and copies without recursion',
        asserts:
          'Parent 3 comparison exact; gitlink patch kind submodule; mode change; copy reported as added.',
      },
      {
        name: 'truncates multibyte subjects at a valid UTF-8 boundary and rejects oversized change results',
        asserts:
          'Subject cut at 128 emoji / 511 bytes; 1 MB patch and 501 changed files reject ReadLimitExceededError.',
      },
      {
        name: 'rejects replacement checkout identities, missing snapshot objects and non-UTF-8 paths',
        asserts:
          'Deleted tip object, 0xff tree path and replaced checkout each map to their specific error.',
      },
      {
        name: 'ignores replacement objects and configured external diff and textconv programs',
        asserts:
          'Real root commit inspected; helper marker absent; pre-aborted listCommits rejects AbortError.',
      },
      {
        name: 'does not lazily fetch promised blobs during commit inspection',
        asserts:
          'HistorySnapshotUnavailableError; missing-object list unchanged; fetch marker absent.',
      },
      {
        name: 'preserves both patch sections for %s changes without shifting neighboring patches (x2)',
        asserts:
          'type-changed entry carries both diff sections; neighbours keep their own patches.',
      },
    ],
    strengths: [
      'Unusually broad real-git coverage: sha256, shallow, partial clone, octopus, replace refs, gitlinks, type changes.',
      'Pagination is checked against git rev-list itself instead of a re-implementation.',
      'Cursor integrity (HMAC, scope, key, page size) tested end to end.',
    ],
    gaps: [
      'No cost assertions. Measured: one 50-commit page = 64 git processes (identity + git --version checked before and after = 8, HEAD 3, rev-list, one cat-file per commit, for-each-ref, is-shallow); inspectCommitChanges = 11. The per-commit cat-file N+1 is invisible to every test.',
      'Largest history is about 6 commits. rev-list --topo-order --skip=offset re-walks from the tip on every page, so page N of a 50k-commit repo costs O(offset); untested.',
      'for-each-ref over all heads, remotes and tags runs on every page with a 4 MB buffer; hundreds of remote branches or thousands of tags are untested for cost and for the overflow failure.',
      'The 10 s per-command timeout and mid-command cancellation are never exercised.',
      'Several checks use arrayContaining/objectContaining, so an extra or duplicated change entry would pass.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/git/src/commit-cursor.spec.ts',
    areas: ['history'],
    kind: 'unit',
    real: ['CommitCursorCodec with a random HMAC key'],
    fakes: [],
    tests: [
      {
        name: 'never emits an unusable continuation for a long ref',
        asserts:
          'Round trip equals input; a 360-segment ref makes encode throw ReadLimitExceededError.',
      },
    ],
    strengths: [
      'Pins the 4,096-character bound on the encode side so the server never issues a cursor it would reject.',
    ],
    gaps: [
      'Tampering, scope mismatch and key rotation are covered only through commit-git.spec.',
      'Decode of an over-length cursor and offset upper bound untested here.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/git/src/read-history.spec.ts',
    areas: ['history'],
    kind: 'unit',
    real: ['error classification logic'],
    fakes: [
      'vi.spyOn(executeCommand) rejecting with hand-built GitCommandError causes',
    ],
    tests: [
      {
        name: 'preserves timeout diagnostics while classifying a killed read as a service deadline failure',
        asserts: 'Rejects with name TimeoutError and the original cause.',
      },
      {
        name: 'reports subprocess output overflow as a limit failure rather than a missing snapshot',
        asserts:
          'Rejects ReadLimitExceededError with cause; overflow wins over killed.',
      },
    ],
    strengths: ['Pins classification precedence, which is easy to break.'],
    gaps: [
      'Error shapes are copies of what Node produces; if a killed execFile reports differently, this passes while production misclassifies. No history spec produces a real timeout or a real 4 MB overflow.',
      'Invalid-encoding and non-zero-exit branches are only covered indirectly via commit-git.spec.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/git/src/run-git.spec.ts',
    areas: ['inventory', 'history'],
    kind: 'process',
    real: ['child-process', 'filesystem', 'git (environment test)'],
    fakes: [
      'a fake git script (sleep 60) on PATH',
      'PATH without git for the ENOENT case',
    ],
    tests: [
      {
        name: 'aborts a running Git subprocess and retains cancellation as the failure',
        asserts:
          'Mid-process abort rejects with AbortError, not GitCommandError.',
      },
      {
        name: 'preserves missing Git executable diagnostics instead of classifying it as missing repository data',
        asserts: 'GitCommandError with cause.code ENOENT.',
      },
      {
        name: 'discovers the selected checkout without inherited command-scoped Git overrides',
        asserts:
          'rev-parse --is-inside-work-tree is true despite GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR and GIT_CONFIG_* stubs.',
      },
    ],
    strengths: [
      'One of the few real mid-process cancellation tests; environment isolation checked against real git.',
    ],
    gaps: [
      'The 10 s timeout and 4 MB maxBuffer are never hit.',
      'strictRead environment stripping (GIT_NO_LAZY_FETCH, graft file) and fatal UTF-8 decoding not tested here.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/git/src/drain-git-output.spec.ts',
    areas: ['git-actions'],
    kind: 'unit',
    real: ['Node streams'],
    fakes: [
      'PassThrough streams in place of pipes',
      'manual AbortController as cleanup deadline',
    ],
    tests: [
      {
        name: 'waits for both output streams to end after their producer exits',
        asserts:
          'Not complete until both streams end; queued tail retained exactly.',
      },
      {
        name: 'reports incomplete output when an inherited pipe outlives the cleanup deadline',
        asserts:
          'Returns false when the deadline fires with one stream still open.',
      },
    ],
    strengths: [
      'Covers the exact escaped-descendant case the helper exists for, with ordering checks.',
    ],
    gaps: [
      'Nothing material for a 20-line helper; real pipes are covered by git-action-process.spec.',
    ],
    verdict: 'strong',
  },
  {
    file: 'packages/git/src/run-git-action.spec.ts',
    areas: ['git-actions'],
    kind: 'process',
    real: [
      'child-process with detached process groups',
      'git (aliases, rev-parse)',
      'filesystem',
      'process.kill probes',
    ],
    fakes: [
      'git aliases that run node scripts instead of real git subcommands',
    ],
    tests: [
      {
        name: 'cancels an owned Git process group after its child readiness barrier',
        asserts:
          'started/interrupted/descendantsStopped true and the grandchild pid no longer exists.',
      },
      {
        name: 'rejects inherited repository and index redirection instead of changing another checkout',
        asserts:
          'rev-parse --show-toplevel is the checkout despite GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE/GIT_CONFIG_* stubs.',
      },
      {
        name: 'returns all large stdout bytes and the final tail after the Git process exits',
        asserts:
          'About 3 MB of stdout returned byte-for-byte including the tail.',
      },
    ],
    strengths: [
      'Proves grandchildren are actually killed by probing the pid, not by trusting a flag.',
      'Byte-exact output check at a realistic size.',
    ],
    gaps: [
      'The 4 MB overflow interrupt is never reached (fixture writes about 3.3 MB including stderr).',
      'The sticky unconfirmed latch (later calls rejecting PROCESS_GROUP_UNCONFIRMED) is not tested here.',
      'No own timeout: a hung git with a never-aborting signal would wait forever; untested.',
    ],
    verdict: 'strong',
  },
  {
    file: 'packages/git/src/fixtures/isolated-git.spec.ts',
    areas: ['git-actions'],
    kind: 'process',
    real: ['git', 'child-process', 'filesystem'],
    fakes: [
      'an external git wrapper that injects a system config with a filter',
    ],
    tests: [
      {
        name: 'isolates runner system filters without changing production configuration rejection',
        asserts:
          'Production inspectActionConfig rejects the system filter; with the isolated wrapper it resolves and the filter is gone from config.',
      },
    ],
    strengths: [
      'Guards the fixture itself, so CI runner configuration cannot make action specs pass or fail for the wrong reason.',
    ],
    gaps: [
      'None for its purpose. The same PATH-wrapper technique would make counting git invocations per operation trivial, and no spec uses it.',
    ],
    verdict: 'strong',
  },
  {
    file: 'packages/git/src/action-git.spec.ts',
    areas: ['git-actions'],
    kind: 'integration',
    real: [
      'git (commits, hooks, stash, merge/rebase pulls, bare remotes)',
      'filesystem',
      'child-process',
      'HTTPS server with self-signed certificate and credential store',
    ],
    fakes: [
      'ssh replaced by a script that records arguments and runs git-*-pack locally',
      'gpg.program=/usr/bin/false for signer failure',
      'system Git config isolated by a PATH wrapper',
    ],
    tests: [
      {
        name: 'commits the existing index while retaining unstaged and new files',
        asserts:
          'HEAD:file is staged content; working file and untracked file untouched.',
      },
      {
        name: 'commits selected working files including new files while retaining unrelated staged content',
        asserts:
          'Only the selected new file committed; unrelated staged and working content preserved.',
      },
      {
        name: 'leaves the actual index unchanged when a selected commit hook rejects it',
        asserts: 'State rejected; index bytes and HEAD unchanged.',
      },
      {
        name: 'commits selected deletions and both sides of a rename (staged: %s) (x2)',
        asserts: 'Clean status and tree contains only renamed.',
      },
      {
        name: 'does not bypass a rejecting hook or its side effects',
        asserts:
          'rejected with refreshRequired; HEAD unchanged; hook side effect present.',
      },
      {
        name: 'honors a failing configured signer without unsigned fallback',
        asserts: 'rejected; HEAD unchanged.',
      },
      {
        name: 'does not repeat or roll back a commit when cancellation occurs in its post-commit hook',
        asserts:
          'indeterminate; exactly one new commit with the selected content.',
      },
      {
        name: 'stash creation includes new files only when requested: %s (x2)',
        asserts:
          'Tracked change stashed; ignored file kept; untracked file removed only when requested.',
      },
      {
        name: '%s restores staging and retains or removes only the selected stash (x2)',
        asserts:
          'Index and working content restored; stash kept for apply, dropped for pop.',
      },
      {
        name: 'pop removes a selected middle stash while preserving newer and older entries',
        asserts: 'Exact remaining stash oids and their contents.',
      },
      {
        name: 'pop retains the selected stash on application conflicts',
        asserts: 'conflicted, stash retained, unmerged entries present.',
      },
      {
        name: 'pop retains a successfully applied stash when its reflog order changed',
        asserts:
          'indeterminate with stashRetained; exact reflog order after an external stash store.',
      },
      {
        name: 'rejects ignored-file collisions before stash application',
        asserts: 'CHECKOUT_BUSY; ignored file and stash untouched.',
      },
      {
        name: 'fetch changes only the selected tracking ref and push sends only the captured branch',
        asserts:
          'push succeeded; fetch no-change; dirty file kept; no temporary refs left.',
      },
      {
        name: 'pulls a clean branch by fast-forward and rejects divergence or local changes',
        asserts:
          'Fast-forward to tip; CHECKOUT_BUSY with local change; NON_FAST_FORWARD leaves HEAD.',
      },
      {
        name: 'pulls divergent commits with %s and leaves an ahead branch unchanged (x2)',
        asserts:
          'Merge parents or rebased parent exact; second pull is no-change.',
      },
      {
        name: 'reports %s conflicts, blocks new actions, and permits recovery after abort (x2)',
        asserts:
          'conflicted; next prepare CHECKOUT_BUSY; after abort, prepare resolves.',
      },
      {
        name: 'commits selected new files before the first commit',
        asserts: 'Orphan branch commit contains the file.',
      },
      {
        name: 'uses SSH batch and existing host-key policy with a disposable transport substitute',
        asserts:
          'Recorded ssh arguments include BatchMode, StrictHostKeyChecking and zero password prompts.',
      },
      {
        name: 'rejects hidden credential-helper chains, interactive keychain and multiple push targets before transport',
        asserts: 'UNSUPPORTED_CONFIGURATION for each configuration.',
      },
      {
        name: 'fetches over disposable HTTPS with existing stored credentials and configured TLS trust',
        asserts:
          'Server saw a 401 challenge then accepted credentials; tracking ref equals HEAD.',
      },
      {
        name: 'rejects fetch rewinds and divergent pushes without replacing their target refs',
        asserts:
          'Fetch NON_FAST_FORWARD keeps tracking ref; divergent push indeterminate and remote ref unchanged.',
      },
      {
        name: 'checks branch existence on the actual push destination: present=%s (x2)',
        asserts:
          'Push URL, not fetch URL, decides allowCreate; no ref created when absent.',
      },
      {
        name: 'rejects a second URL rewrite instead of checking a third repository for push creation',
        asserts: 'UNSUPPORTED_CONFIGURATION; destination untouched.',
      },
      {
        name: 'fingerprints same-size working changes, configuration changes and index changes',
        asserts: 'Fingerprint changes after each kind of change.',
      },
      {
        name: 'continues to reject configured conversion filters before mutation',
        asserts: 'UNSUPPORTED_CONFIGURATION; commit count unchanged.',
      },
    ],
    strengths: [
      'Every action runs against real git and outcomes are verified in the repository afterwards (HEAD, index bytes, refs, stash list, remote refs), not from the adapter return value alone.',
      'Failure semantics are specific and adversarial: hook rejection with side effects, signer failure, cancellation in post-commit, stash conflicts, reflog reordering, non-fast-forward, divergent push.',
      'Transport policy tested with a real HTTPS auth challenge and an SSH argument recorder, with no network access.',
    ],
    gaps: [
      'Fixtures have 1 to 3 files. hashActionFiles rejects any checkout with more than 10,000 tracked+untracked files or more than 32 MB of content with UNSUPPORTED_CONFIGURATION. Measured: a 12,000-file repository cannot prepare a commit. No spec asserts or documents this, so git actions silently failing on medium-sized repos passes the suite.',
      'Cost: inspect() spawns 21 git processes on a tiny repo (measured) and reads the full content of every tracked and untracked file to fingerprint it; prepare and execute each re-run inspect. No process, bytes-read or duration assertion.',
      'Remotes with hundreds of branches, large packs, and cancellation or timeout during network transfer are untested (only a post-commit hook is cancelled).',
      'The 4 MB output cap and the 2,000-path commit limit are never reached.',
      'Two actions racing on one checkout are not tested here (serialization is assumed from the application queue).',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/git/src/commands/commit-paths.spec.ts',
    areas: ['git-actions'],
    kind: 'unit',
    real: ['filesystem (temporary index and lock files)'],
    fakes: ['GitProcessRunner stub that answers by substring of the arguments'],
    tests: [
      {
        name: 'keeps the real index lock and temporary index when commit process ownership is lost',
        asserts:
          'Rejects PROCESS_GROUP_UNCONFIRMED; index content unchanged; index.lock and porcelain-index-* kept.',
      },
    ],
    strengths: [
      'Pins a quarantine path that is very hard to reach with real git.',
    ],
    gaps: [
      'The stub matches by args.includes(...), so argument regressions (dropping --literal-pathspecs or --only) are invisible.',
      'Path validation (.., .git, more than 2,000 paths) untested; the normal publish path is only covered by action-git.spec.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/git/src/commands/git-action-quarantine.spec.ts',
    areas: ['git-actions'],
    kind: 'unit',
    real: ['readActionCommand, removeAppliedStash, fetchBranch logic'],
    fakes: [
      'GitProcessRunner stubs returning descendantsStopped false at chosen steps',
    ],
    tests: [
      {
        name: 'preserves unconfirmed ownership from inspection even when caller cancellation races',
        asserts: 'Rejects PROCESS_GROUP_UNCONFIRMED rather than AbortError.',
      },
      {
        name: 'preserves unconfirmed ownership after the stash was applied and drop cannot finish',
        asserts: 'indeterminate / PROCESS_GROUP_UNCONFIRMED / refreshRequired.',
      },
      {
        name: 'quarantines unconfirmed fetch %s instead of reporting success or ordinary rejection (x2)',
        asserts:
          'indeterminate / PROCESS_GROUP_UNCONFIRMED and no later git command issued.',
      },
    ],
    strengths: [
      'Asserts that no further git command runs after ownership is lost, a strong behavioural property.',
    ],
    gaps: [
      'Pull, push, commitIndex and createStash quarantine paths not covered.',
      'Stubs return canned stdout regardless of arguments, so ordering bugs could pass.',
    ],
    verdict: 'adequate',
  },

  // ------------------------------------------------------------ packages/contracts
  {
    file: 'packages/contracts/src/comments.spec.ts',
    areas: ['comments'],
    kind: 'unit',
    real: ['zod schemas'],
    fakes: [],
    tests: [
      {
        name: 'accepts literal colon names and the maximum path length for both anchor kinds',
        asserts:
          '4,096-character path accepted, 4,097 rejected, for file and codeRange anchors.',
      },
      {
        name: 'requires message authors, keeps legacy timestamps optional, and accepts diff sides',
        asserts:
          'Author required; client input cannot carry author or createdAt; deletions side accepted.',
      },
      {
        name: 'keeps comparison identity and requires immutable revisions for commit comments',
        asserts:
          'Commit comparisons need a 40-hex revision and parent 1..1000; worktree scopes accepted.',
      },
    ],
    strengths: [
      'Boundaries tested at exact limits; rejects client-supplied authorship.',
    ],
    gaps: [
      'Body length, message count and reply/resolve schemas untested.',
      'Whether real server responses satisfy these schemas is left to HTTP specs.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/contracts/src/evidence.spec.ts',
    areas: ['changes'],
    kind: 'unit',
    real: ['zod schema'],
    fakes: [],
    tests: [
      {
        name: 'accepts grouped evidence with null fingerprints for unsafe comparisons',
        asserts: 'One valid sample parses and its fingerprint is null.',
      },
    ],
    strengths: ['Documents the null-fingerprint meaning.'],
    gaps: [
      'Single positive example; no rejection cases (non-hex fingerprint, empty comparisons, more than 2,000 entries, unknown omission reason, extra keys).',
      'No test of parse cost for a realistic multi-MB evidence response (server allows 16 MB of content), which the client validates on every load.',
    ],
    verdict: 'weak',
  },
  {
    file: 'packages/contracts/src/git-diff.spec.ts',
    areas: ['changes'],
    kind: 'unit',
    real: ['zod schema'],
    fakes: [],
    tests: [
      {
        name: 'accepts literal relative Git paths and rejects traversal, lossy strings and extra fields',
        asserts:
          'Glob/newline/emoji path accepted; empty, absolute, .., //, NUL, lone surrogate, extra field, null newPath and unmerged scope rejected.',
      },
    ],
    strengths: ['Many exact negative cases for the shared path policy.'],
    gaps: ['Response schema untested; rename oldPath rules untested.'],
    verdict: 'adequate',
  },
  {
    file: 'packages/contracts/src/reviewed-files.spec.ts',
    areas: ['changes'],
    kind: 'unit',
    real: ['zod schemas'],
    fakes: [],
    tests: [
      {
        name: 'limits reviewed marks to canonical paths and SHA-256 fingerprints',
        asserts:
          'Fingerprint must be 64 lowercase hex; response parses; set request with an extra statusToken is rejected.',
      },
    ],
    strengths: ['Pins the strict request shape (no status token smuggled in).'],
    gaps: [
      'Despite the name, no path and no count limit (2,000 marks) is exercised here; path policy is covered via git-diff.spec.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/contracts/src/review-layers.spec.ts',
    areas: ['review-layers'],
    kind: 'unit',
    real: ['zod schema'],
    fakes: [],
    tests: [
      {
        name: 'bounds metadata and rejects duplicate identities and references without normalizing paths',
        asserts:
          'Same path under two scopes allowed; duplicate ids/refs, blank or long title, long summary/note/path, 501 files, 101 layers, 2,500 total refs, bad revisions and unknown scope rejected.',
      },
    ],
    strengths: [
      'Every documented bound, including the aggregate reference cap, tested at its edge.',
    ],
    gaps: ['Response schema untested (minor).'],
    verdict: 'strong',
  },

  // --------------------------------------------------------------- packages/client
  {
    file: 'packages/client/src/comments.spec.ts',
    areas: ['comments'],
    kind: 'unit',
    real: ['createCommentsClient', 'zod validation'],
    fakes: ['fetch replaced by inline functions returning hand-written JSON'],
    tests: [
      {
        name: 'posts a literal file anchor and validates the returned discussion',
        asserts:
          'Exact URL, method, JSON body, credentials omit, redirect error; body text preserved.',
      },
      {
        name: 'rejects malformed data and reports uncertain writes without retrying or exposing diagnostics',
        asserts:
          'Sanitized messages; exactly one transport call on a lost write.',
      },
      {
        name: 'reports a timed-out write as uncertain rather than inviting an immediate retry',
        asserts: 'Message says the comment may have been saved.',
      },
      {
        name: 'posts replies and resolution changes to the encoded thread routes',
        asserts: 'Exact URLs, methods and bodies for reply and resolution.',
      },
    ],
    strengths: [
      'Checks the no-retry rule for uncertain writes by counting calls.',
    ],
    gaps: [
      'Fixtures are hand-written, so server/contract drift is invisible here.',
      'No 401 or typed RequestError path for comments.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/client/src/inventory.spec.ts',
    areas: ['connection', 'inventory'],
    kind: 'unit',
    real: ['inventory client functions', 'zod validation'],
    fakes: ['vi.fn fetch with canned Responses'],
    tests: [
      {
        name: 'authenticates inventory reads and refreshes without caching or redirects',
        asserts:
          'Exact URL, method, bearer header, no-store, omit, redirect error; refresh uses POST.',
      },
      {
        name: 'reports a safe error for status %i and incompatible responses (x3)',
        asserts: '401, 500 and malformed 200 map to specific safe messages.',
      },
      {
        name: 'preserves transport causes and aborts without exposing response bodies',
        asserts:
          'Cause preserved; aborted request rethrows the original error.',
      },
      {
        name: 'registers an absolute server-side project without caching or redirects',
        asserts: 'Exact request and parsed project.',
      },
      {
        name: 'reports an actionable registration error for status %i (x4)',
        asserts: 'Status-specific messages for 401/400/422/500.',
      },
      {
        name: 'browses encoded server paths with private, cancellable requests',
        asserts: 'Encoded query and parsed folder/discovery responses.',
      },
      {
        name: 'reports folder failures without exposing server diagnostics and preserves cancellation',
        asserts:
          'No diagnostics leaked for five statuses; cancellation reason rethrown.',
      },
      {
        name: 'removes a project using the authenticated idempotent DELETE endpoint',
        asserts:
          'deleted true/false parsed; 409 message; malformed body rejected.',
      },
    ],
    strengths: [
      'Every status maps to an actionable, sanitized message; exact request options.',
    ],
    gaps: [
      'Hand-written JSON; no large inventory (many projects and worktrees).',
      'Nothing about how often refresh is called, although each refresh re-runs listWorktrees for every project on the server.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'packages/client/src/review.spec.ts',
    areas: ['changes', 'files', 'history', 'artifacts', 'git-actions'],
    kind: 'unit',
    real: ['createReviewClient and createGitActionsClient', 'zod validation'],
    fakes: ['fetch replaced by inline functions returning hand-written JSON'],
    tests: [
      {
        name: 'encodes literal file paths and validates text without treating it as HTML',
        asserts:
          'Exact encoded URL, auth header, omit and redirect error; text returned verbatim.',
      },
      {
        name: 'rejects malformed successful responses and sanitizes server diagnostics',
        asserts: 'Generic messages for malformed 200 and plain-text 500.',
      },
      {
        name: 'loads artifact content through the scoped artifact endpoint',
        asserts: 'Exact URL, GET, content parsed.',
      },
      {
        name: 'adds a selected merge parent to the commit changes request',
        asserts: 'parent query parameter present and response parsed.',
      },
      {
        name: 'validates commit body truncation metadata and full refs from history',
        asserts: 'limit=50 URL; body and refs parsed.',
      },
      {
        name: 'loads complete review evidence and durable reviewed marks through scoped routes',
        asserts:
          'Exact call sequence evidence, reviewed, PUT reviewed, DELETE reviewed?path.',
      },
      {
        name: 'preserves a conflict receipt and its request identity instead of treating it as a retryable write failure',
        asserts: '409 receipt returned as conflicted with the same requestId.',
      },
      {
        name: 'preserves typed file refusal codes without accepting malformed errors',
        asserts: 'RequestError with code UNSUPPORTED_TEXT and status 422.',
      },
      {
        name: 'reads image assets through the authenticated private transport',
        asserts: 'Encoded asset URL, no-store, omit; mediaType parsed.',
      },
    ],
    strengths: [
      'Per-call transport options and exact call sequences asserted.',
    ],
    gaps: [
      'Evidence fixture is empty, so parse time and memory for a realistic evidence response are untested.',
      'changes() always issues two requests (status + layers); request counts per UI action are the web query layer concern and untested here.',
      'Git-actions client prepare, receipt, models and draft untested; history cursor path untested.',
    ],
    verdict: 'adequate',
  },

  // ------------------------------------------------------------ apps/server/agents
  {
    file: 'apps/server/src/agents/cli-commit-generator.spec.ts',
    areas: ['git-actions'],
    kind: 'process',
    real: [
      'child-process spawn of CLI executables',
      'filesystem temp directories',
      'JSON schema generation',
    ],
    fakes: [
      'codex and claude replaced by one node script that records args/stdin and returns a fixed proposal',
      'CODEX_HOME models cache fixture',
    ],
    tests: [
      {
        name: 'discovers local models and invokes an isolated, tool-disabled CLI using stdin and structured output',
        asserts:
          'Model list from cache plus claude aliases; proposal parsed for both providers; unsupported ids rejected; prompt passed on stdin; isolation flags present; cwd is a temp dir; empty list without CLIs.',
      },
    ],
    strengths: [
      'Verifies the prompt goes over stdin, not argv, and that sandbox and tool-disabling flags are passed (flags confirmed present on the currently installed CLIs).',
    ],
    gaps: [
      'The fake CLI always succeeds instantly: the 120 s kill timer, abort-driven process-group kill, 1 MB stdout overflow, non-zero exit, invalid JSON and schema-violating proposals are all untested.',
      'The fake accepts any flags, so a future CLI flag rename still passes.',
      'No check that temp directories are removed on failure.',
    ],
    verdict: 'weak',
  },

  // --------------------------------------------------------------- apps/server/cli
  {
    file: 'apps/server/src/cli/arguments.spec.ts',
    areas: ['connection', 'lifecycle'],
    kind: 'unit',
    real: ['parseServeSettings'],
    fakes: ['environment object and home directory passed in'],
    tests: [
      {
        name: 'parses the installed command and keeps all state paths absolute',
        asserts:
          'Exact settings for --lan, --port=, --data-directory, --token-file; help; PORCELAIN_PORT from env with default host.',
      },
      {
        name: 'rejects conflicting or unknown installed command arguments',
        asserts: '--lan with --host, unknown option and unknown command throw.',
      },
    ],
    strengths: ['Exact values for the main flag combinations.'],
    gaps: [
      'Invalid port strings, relative paths, missing option values and flag-over-env precedence untested.',
      'runCli, runLocalServer and installShutdownSignals have no spec in this directory; token-file creation and permissions are covered by scripts/serve.spec.ts (not audited here).',
    ],
    verdict: 'adequate',
  },

  // ---------------------------------------------------------------- apps/server/db
  {
    file: 'apps/server/src/db/comment-migration.spec.ts',
    areas: ['comments', 'lifecycle'],
    kind: 'integration',
    real: [
      'sqlite (node:sqlite for the legacy database, better-sqlite3 via openDatabase)',
      'shipped drizzle migration files',
      'filesystem',
    ],
    fakes: [],
    tests: [
      {
        name: 'backfills legacy authors, preserves evidence/order/content and reopens safely',
        asserts:
          'Exact threads after migration (author added only where missing, no invented createdAt); 3 migrations recorded; reopen is idempotent.',
      },
      {
        name: 'rolls back the author backfill when a legacy write is interrupted',
        asserts:
          'A trigger aborts the backfill; data and migration count unchanged.',
      },
    ],
    strengths: [
      'Uses the shipped SQL and real hashes; proves the migration is transactional.',
    ],
    gaps: ['Single thread; migration time on a large comment table untested.'],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/db/connection.spec.ts',
    areas: ['lifecycle'],
    kind: 'integration',
    real: ['sqlite', 'diagnostics_channel'],
    fakes: [],
    tests: [
      {
        name: 'publishes executed statements only to active subscribers',
        asserts: 'Only the statement run while subscribed is recorded.',
      },
    ],
    strengths: [
      'Confirms the new instrumentation is inert without a subscriber.',
    ],
    gaps: [
      'New, untracked and in flight. Nothing yet uses the channel to bound statements per request.',
      'WAL and busy_timeout pragmas are not asserted.',
    ],
    verdict: 'adequate',
  },

  // ------------------------------------------------------- apps/server/development
  {
    file: 'apps/server/src/development/create-playground.spec.ts',
    areas: ['lifecycle'],
    kind: 'process',
    real: [
      'git',
      'filesystem',
      'child-process (node --test, sample server)',
      'http fetch',
    ],
    fakes: ['isolated HOME and PATH wrapper for git'],
    tests: [
      {
        name: 'seeds linked worktrees, review changes and a local remote without using personal Git configuration',
        asserts:
          'Worktrees, MM/??/R/D/A statuses, remote URL, log, stash apply, sample tests passing and token file content.',
      },
      {
        name: 'runs the sample application with real task data and browser assets',
        asserts: 'Sample server serves board, tasks JSON, assets and 404.',
      },
    ],
    strengths: ['Guards the data set that pnpm dev and smoke depend on.'],
    gaps: [
      'The playground is a few dozen files and a handful of commits. It is the repository everyone uses in pnpm dev, which is why 13 processes per status and 64 per history page felt instant. There is no large or slow playground variant (20k files, 50k commits, 200 remote branches, several worktrees).',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/development/playground.spec.ts',
    areas: [
      'lifecycle',
      'connection',
      'inventory',
      'comments',
      'review-layers',
      'artifacts',
    ],
    kind: 'process',
    real: [
      'child process running playground.ts',
      'HTTP server',
      'sqlite',
      'git',
      'filesystem',
      'token file',
    ],
    fakes: [
      'commit generator stub',
      'trash replaced by rename into the playground',
    ],
    tests: [
      {
        name: 'starts a review server, accepts a file comment and removes its data on %s (x2: SIGINT, SIGTERM)',
        asserts:
          'Inventory has 2 worktrees; seeded comments, layers, commit layers, preferences and artifacts served; 401 without token; comment created and listed; exit 0; playground directory removed.',
      },
    ],
    strengths: [
      'True end-to-end process test across auth, persistence, layers, artifacts and shutdown cleanup for both signals.',
    ],
    gaps: [
      'Tiny data only; no timing or request-cost checks; status, evidence and history endpoints are not called.',
    ],
    verdict: 'strong',
  },

  // -------------------------------------------------------- apps/server/filesystem
  {
    file: 'apps/server/src/filesystem/decode-directory-name.spec.ts',
    areas: ['files'],
    kind: 'unit',
    real: ['decodeDirectoryName'],
    fakes: [],
    tests: [
      {
        name: 'rejects invalid filename bytes instead of collapsing names to replacement characters (x4)',
        asserts:
          'UNSUPPORTED_PATH for 0xff, 0xfe, truncated and overlong sequences.',
      },
      {
        name: 'preserves valid filename %s byte-for-byte (x4)',
        asserts:
          'Round trip is byte-identical, including a literal U+FFFD and a BOM.',
      },
    ],
    strengths: [
      'Exact byte-level checks, including the tricky literal replacement character.',
    ],
    gaps: ['None material.'],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/filesystem/file-reader.spec.ts',
    areas: ['files', 'changes'],
    kind: 'integration',
    real: ['filesystem (files, directories, symlinks, fifo)'],
    fakes: [
      'node:fs/promises open/lstat/opendir wrapped with vi.fn(actual) to inject races and errors at exact points',
    ],
    tests: [
      {
        name: 'lists one directory in deterministic order, including ignored/dot files but excluding Git metadata',
        asserts:
          'Exact sorted entries with kinds; fifo read rejects PATH_NOT_READABLE.',
      },
      {
        name: 'preserves UTF-8 bytes, BOM, CRLF and empty text',
        asserts: 'Exact TextContent including byteLength.',
      },
      {
        name: 'rejects invalid UTF-8, NUL, oversized files and oversized JSON escaping',
        asserts:
          'UNSUPPORTED_TEXT and FILE_TOO_LARGE at the 1 MB and escaped-JSON bounds; 1 MB - 200 accepted.',
      },
      {
        name: 'rejects traversal and all symlink traversal, including dangling and in-root links',
        asserts: 'PATH_NOT_READABLE for 6 paths; PATH_NOT_FOUND for missing.',
      },
      {
        name: 'returns complete bounded directories or an explicit error',
        asserts: '2,000 entries listed; 2,001 rejects DIRECTORY_TOO_LARGE.',
      },
      {
        name: 'rejects detected file, parent and directory changes between observations',
        asserts:
          'CONTENT_CHANGED for file edit, parent swap, new entry and removal.',
      },
      {
        name: 'honors already cancelled reads and listings',
        asserts: 'AbortError for both.',
      },
      {
        name: 'rejects a replacement between path inspection and open, closing the file handle',
        asserts: 'CONTENT_CHANGED and the opened handle is closed (EBADF).',
      },
      {
        name: 'closes opened files on cancellation and when content grows beyond the bound',
        asserts: 'AbortError / FILE_TOO_LARGE, handle closed in both.',
      },
      {
        name: 'bounds serialized directory responses even below the entry count limit',
        asserts: '1,000 escaped names reject DIRECTORY_TOO_LARGE.',
      },
      {
        name: 'preserves unexpected filesystem failures during verification',
        asserts: 'EIO is rethrown unchanged.',
      },
      {
        name: 'rejects invalid raw directory names without partial results and closes the handle',
        asserts: 'UNSUPPORTED_PATH and directory handle closed.',
      },
      {
        name: 'returns addressable Unicode names including a literal replacement character and BOM',
        asserts: 'Each listed name reads back its own content.',
      },
    ],
    strengths: [
      'Races are injected at the exact window the code defends (between inspection and open) using real files.',
      'Resource hygiene checked (handles closed via EBADF / ERR_DIR_CLOSED).',
      'Exact limits at 1 MB and 2,000 entries.',
    ],
    gaps: [
      'Every read allocates a zero-filled 1 MB + 1 buffer regardless of file size; evidence reads of hundreds of small untracked files churn memory. Untested.',
      'Per-path cost (lstat on every ancestor, twice, plus realpath) never measured.',
      'Folders over 2,000 entries (node_modules/.pnpm) cannot be browsed at all; tested as a limit, not as user impact.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/filesystem/file-tree.spec.ts',
    areas: ['files'],
    kind: 'integration',
    real: ['git ls-files via readTreePaths', 'filesystem'],
    fakes: [],
    tests: [
      {
        name: 'lists a large repository whose tree exceeds 20,000 paths and 2 MB without dropping files',
        asserts:
          'Exact sorted set of 20,200 paths; JSON larger than 2 MB; all files not ignored.',
      },
      {
        name: 'still rejects trees beyond the bounded path capacity before inspecting files',
        asserts: '50,001 paths reject DIRECTORY_TOO_LARGE.',
      },
      {
        name: 'keeps entry order and skips paths through symlinked parents in concurrent batches',
        asserts:
          'Exact entries; paths under a symlinked parent skipped; cancellation reason propagated.',
      },
    ],
    strengths: [
      'One of the few specs with a realistic repository shape, and it checks exact completeness.',
    ],
    gaps: [
      'No time or syscall budget; the 20k case takes about 2 s including fixture creation under a 20 s timeout.',
      'Ignored directories collapsed by --directory (node_modules) and submodule detection are never exercised with real git.',
      'readTreePaths 8 MB ls-files cap untested; repositories above 50,000 paths fail the Files view entirely.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/filesystem/file-writer.spec.ts',
    areas: ['files'],
    kind: 'integration',
    real: ['filesystem'],
    fakes: ['moveToTrash injected as vi.fn in one test'],
    tests: [
      {
        name: 'saves text atomically, preserves executable mode, and refuses a stale editor or cancellation',
        asserts:
          'Returned fingerprint; mode 0755 kept; stale fingerprint CONTENT_CHANGED; aborted write leaves content and no temp file.',
      },
      {
        name: 'creates and moves entries without replacing an existing destination',
        asserts:
          'ENTRY_EXISTS on collisions; content kept; directory move works.',
      },
      {
        name: 'refuses symlink traversal and passes the literal symlink itself to trash',
        asserts:
          'PATH_NOT_READABLE for write/create through a link; trash receives the link path; outside file intact.',
      },
    ],
    strengths: [
      'Checks there are no leftover temp files and no overwrite on collisions.',
    ],
    gaps: [
      'The races the code defends against (parent replaced between reservation and rename, source changed during move, reservation cleanup) are not injected, unlike file-reader.spec.',
      'Moving a directory into itself (INVALID_REQUEST) untested.',
      'Editing a file over 1 MB fails because write re-reads through NodeFileReader; untested.',
    ],
    verdict: 'adequate',
  },

  // --------------------------------------------------------- apps/server/lifecycle
  {
    file: 'apps/server/src/lifecycle/operation-runner.spec.ts',
    areas: ['lifecycle'],
    kind: 'unit',
    real: [
      'OperationRunner',
      'AbortSignal timers',
      'diagnostics_channel (new)',
    ],
    fakes: ['operations are promises controlled by the test'],
    tests: [
      {
        name: 'aborts active work, rejects queued and new work, and releases resources once',
        asserts:
          'ApplicationClosedError for active, queued and new work; queued never ran; resources released once.',
      },
      {
        name: 'cancels queued work without executing it or poisoning later operations',
        asserts: 'Queued op aborted by caller never runs; next op runs.',
      },
      {
        name: 'bounds the entire operation and remains usable after a timeout',
        asserts: 'Single op times out with TimeoutError; runner still works.',
      },
      {
        name: 'publishes queue waits and outcomes per named runner while subscribed',
        asserts:
          'New: events queued, queued, queued, started; later work waits behind the first; settled/failed per op.',
      },
      {
        name: 'keeps owned receipt finalization inside shutdown and the shared queue',
        asserts: 'Owned ops run to completion in order before resources close.',
      },
    ],
    strengths: [
      'Close semantics are exact (resources released once, queued work never runs).',
      'The new diagnostics test pins strict FIFO serialization and failure reporting.',
    ],
    gaps: [
      'The deadline starts at enqueue (AbortSignal.timeout is created in run()), so with the default 30 s a request queued behind slow git work times out without ever running. No test queues two operations and checks the second deadline.',
      'app.ts sends status, diff, evidence, file tree, history, comments, artifacts, reviewed marks and preferences (DB-only reads included) through one operations runner; nothing tests that a DB-only read is not stuck behind a multi-second git read, or bounds queue depth.',
      'No deduplication: identical evidence or summary requests run again, serially; untested and unmeasured.',
      'runOwned ignores caller abort while queued (by design) but its timeout while waiting is untested.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/lifecycle/start-local-server.spec.ts',
    areas: ['lifecycle', 'connection'],
    kind: 'http',
    real: [
      'HTTP server on loopback',
      'raw TCP socket',
      'sqlite',
      'filesystem ownership lock',
    ],
    fakes: [],
    tests: [
      {
        name: 'bounds shutdown when a client never finishes its request body',
        asserts:
          'close() completes, the stalled socket is closed and a restart succeeds.',
      },
      {
        name: 'rejects invalid configuration before creating state',
        asserts:
          '8 bad configurations throw; no lock or database created; pre-aborted start rejects.',
      },
      {
        name: 'owns a directory across aliases, serves loopback HTTP, and releases it on close',
        asserts:
          'Binds 127.0.0.1; health ok; symlink alias rejects DataDirectoryOwnedError; double close safe; restart works.',
      },
      {
        name: 'binds an explicitly configured host without changing the default',
        asserts: 'Listens on 127.0.0.2 and serves health.',
      },
      {
        name: 'releases ownership after bind or database failure so startup can be retried',
        asserts:
          'EADDRINUSE and corrupt sqlite both leave no server.lock behind.',
      },
    ],
    strengths: [
      'Real sockets and lock files; the failure cleanup paths are tested, not only the happy path.',
    ],
    gaps: [
      'Startup refreshes inventory (listWorktrees for every registered project, serially, 2 + 2 per worktree git processes) before listening; no test bounds startup time with many or unavailable projects.',
      'Shutdown while a git action or a long evidence read is running is not covered here.',
    ],
    verdict: 'strong',
  },

  // ------------------------------------------------------ apps/server/repositories
  {
    file: 'apps/server/src/repositories/artifact-repository.spec.ts',
    areas: ['artifacts'],
    kind: 'integration',
    real: ['sqlite', 'SQL triggers to abort writes'],
    fakes: [],
    tests: [
      {
        name: 'enforces aggregate byte and record quotas transactionally across worktrees and reclaims deleted capacity',
        asserts:
          'ArtifactQuotaError at byte and count limits; scoped delete; capacity reclaimed.',
      },
      {
        name: 'keeps metadata and content consistent when SQLite aborts writes or deletion, and survives reopening',
        asserts:
          'Aborted insert leaves nothing; aborted delete keeps content; reopen reads the same row.',
      },
    ],
    strengths: [
      'Real transactional failure injection via triggers; both quota dimensions at their limits.',
    ],
    gaps: [
      'Concurrent uploads near the quota from two connections not tested (immediate transactions should hold).',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/repositories/comment-repository.spec.ts',
    areas: ['comments'],
    kind: 'integration',
    real: ['sqlite', 'InventoryRepository'],
    fakes: [],
    tests: [
      {
        name: 'retains creation order and discussions after inventory removes their worktree rows',
        asserts:
          'find scoped by worktree; usage equals commentStorageSize sum; list keeps creation order after update; threads survive worktree row removal.',
      },
    ],
    strengths: ['Exact storage accounting against the model function.'],
    gaps: [
      'comment_threads has no index on worktree_id (only on id), so list, find and usage scan the whole table; no test with thousands of threads.',
      'Each reply rewrites the whole JSON thread; size and time unbounded by tests.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/repositories/commit-review-layer-repository.spec.ts',
    areas: ['review-layers', 'history'],
    kind: 'integration',
    real: [
      'sqlite with two connections to one file',
      'Inventory, ReviewLayer and ProjectRemoval repositories',
    ],
    fakes: [],
    tests: [
      {
        name: 'rejects source changes across connections, preserves immutable snapshots and atomically cleans only the owning project',
        asserts:
          'StaleReviewLayerSourceError, CommitReviewLayerConflictError, WorktreeNotFoundError; idempotent create; snapshot survives inventory rewrite; removal deletes only the owning project.',
      },
    ],
    strengths: [
      'Two real connections; ownership and cleanup checked across projects.',
    ],
    gaps: [
      'complete() (snapshot plus source layer update in one transaction) untested.',
      'Connections interleave synchronously in one thread; no truly concurrent writers.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/repositories/file-preference-repository.spec.ts',
    areas: ['files'],
    kind: 'integration',
    real: ['sqlite'],
    fakes: [],
    tests: [
      {
        name: 'bounds each project to 2000 paths while permitting retries, independent updates, and clearing to free capacity',
        asserts:
          'FilePreferenceLimitError at 2,001; updates and clears allowed at the cap; other project independent.',
      },
    ],
    strengths: [
      'Boundary behaviour exact, including clearing both flags to free capacity.',
    ],
    gaps: ['None material.'],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/repositories/git-action-repository.spec.ts',
    areas: ['git-actions', 'lifecycle'],
    kind: 'integration',
    real: ['sqlite with reopen'],
    fakes: [],
    tests: [
      {
        name: 'consumes preparations once, rejects changed bindings, and never replays after restart',
        asserts:
          'accept created once then idempotent; changed binding and reused preparation throw; after reopen, running receipt becomes indeterminate/OUTCOME_UNKNOWN and nothing replays.',
      },
    ],
    strengths: ['Restart recovery verified with a real reopen.'],
    gaps: [
      'Mismatch and reuse cases use bare toThrow(), so any error (even a SQL error) satisfies them; REQUEST_MISMATCH vs STALE_PREPARATION not distinguished.',
      'isBlocked() scans and JSON-parses every receipt ever stored on each prepare/accept/execute, and preparations and receipts are never pruned (expiresAt unused); growth untested.',
      'recover() branch for refreshRequired true (PROCESS_GROUP_UNCONFIRMED) and blockProject/isBlocked are untested here (exercised only via top-level git-action-quarantine.spec, not audited here).',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/repositories/inventory-repository.spec.ts',
    areas: ['inventory', 'lifecycle'],
    kind: 'integration',
    real: [
      'sqlite (node:sqlite to craft states, better-sqlite3 via openDatabase)',
      'drizzle migrations',
      'filesystem',
    ],
    fakes: [],
    tests: [
      {
        name: 'rejects a newer schema without changing its version or data',
        asserts:
          'UnsupportedDatabaseVersionError; user_version and data preserved.',
      },
      {
        name: 'requires an explicit absolute data directory',
        asserts: 'InvalidDataDirectoryError for a relative path.',
      },
      {
        name: 'creates and reopens inventory preserving worktree order and %s metadata identities (x2)',
        asserts: 'Reopened inventory equals the saved project exactly.',
      },
      {
        name: 'rejects %s migration history without changing the database (x3)',
        asserts:
          'future, divergent and untracked histories rejected; database file byte-identical afterwards.',
      },
      {
        name: 'rolls back the complete project update when worktree identities conflict',
        asserts: 'Failed save leaves the previous project exactly.',
      },
      {
        name: 'enforces worktree ownership through foreign keys',
        asserts: 'Orphan worktree insert throws.',
      },
      {
        name: 'reports missing persisted environment identity instead of returning invalid inventory',
        asserts: 'MissingEnvironmentIdentityError.',
      },
    ],
    strengths: [
      'Migration guard proven by byte comparison of the database file; transactional rollback exact.',
    ],
    gaps: [
      'save() deletes and reinserts every worktree row per project on each refresh; read() filters worktrees per project and runs for per-request worktree resolution; no test with 50 projects x 20 worktrees.',
      'No test that refresh keeps worktree ids stable for review data.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/repositories/project-removal-repository.spec.ts',
    areas: ['inventory', 'git-actions'],
    kind: 'integration',
    real: ['sqlite', 'SQL trigger on inventory_projects'],
    fakes: [],
    tests: [
      {
        name: 'preserves the project and its data when a Git operation is %s (x3: running, indeterminate, block)',
        asserts:
          'ProjectRemovalBlockedError; inventory, artifacts and reviewed files unchanged.',
      },
      {
        name: 'rolls back review-data deletion if deleting inventory fails',
        asserts:
          'Trigger failure keeps everything; after dropping it, removal deletes artifacts and reviewed files.',
      },
    ],
    strengths: [
      'Rollback proven with a real trigger across the whole multi-table delete.',
    ],
    gaps: [
      'Any receipt in state indeterminate blocks removal forever and nothing clears receipts; a divergent push ends indeterminate (action-git.spec) and a crash mid-action becomes indeterminate on restart. The test pins the block but not any way out.',
      'Successful removal asserts only artifacts and reviewed files; comments, layers, preferences, preparations and receipts deletion are not checked here.',
    ],
    verdict: 'adequate',
  },
  {
    file: 'apps/server/src/repositories/reviewed-file-repository.spec.ts',
    areas: ['changes'],
    kind: 'integration',
    real: ['sqlite with reopen'],
    fakes: [],
    tests: [
      {
        name: 'stores one durable mark per worktree and keeps rows across database reopen',
        asserts:
          'Update replaces fingerprint; other worktree separate; marks survive worktree row deletion and reopen.',
      },
      {
        name: 'removes a mark idempotently without affecting another path',
        asserts: 'Repeated and missing removals are no-ops; other path kept.',
      },
      {
        name: 'caps new marks at 2000 by pruning the oldest path, without pruning updates',
        asserts: 'Exact eviction of the oldest path; updates never evict.',
      },
    ],
    strengths: ['Exact eviction order and retention semantics.'],
    gaps: [
      'Marks for files that are no longer changed are never pruned except by the cap, so a long-lived worktree silently evicts real marks once stale ones accumulate; tested as a mechanism, not as user impact.',
    ],
    verdict: 'strong',
  },
  {
    file: 'apps/server/src/repositories/review-layer-repository.spec.ts',
    areas: ['review-layers'],
    kind: 'integration',
    real: ['sqlite with two connections', 'InventoryRepository'],
    fakes: [],
    tests: [
      {
        name: 'protects revisions across SQLite connections and retains metadata after inventory replacement/removal',
        asserts:
          'Revision 0 on both; stale replace rejects ReviewLayerConflictError; layers survive inventory rewrite and removal; unknown worktree rejects.',
      },
    ],
    strengths: ['Optimistic concurrency checked across two real connections.'],
    gaps: [
      'Maximum payload (100 layers, 2,500 refs in one JSON column) not timed.',
    ],
    verdict: 'strong',
  },
];

export const coreAreaSummaries: AreaTestSummary[] = [
  {
    area: 'connection',
    verdict: 'adequate',
    summary:
      'Loopback binding, host override, token-protected routes (401 in the playground e2e) and client-side error mapping are tested with real sockets or exact assertions. Token-file creation and permissions live in scripts/serve.spec.ts, outside this scope. Client fixtures are hand-written, so server response drift is caught only by HTTP specs.',
    missing: [
      'Client contract test: feed each client function responses recorded from the real server (for example the playground) instead of hand-written JSON.',
      'runCli/runLocalServer: SIGINT during startup releases server.lock and never prints the token (apps/server/src/cli only tests argument parsing).',
      'Startup with 20 registered projects, 3 on unavailable paths, is listening within N ms (refresh runs listWorktrees for each project, serially, before listen).',
    ],
  },
  {
    area: 'inventory',
    verdict: 'adequate',
    summary:
      'Persistence is strong: migration history, transactional saves, foreign keys and reopen are verified on real SQLite. The Git side (listWorktrees: 2 processes plus 2 per worktree, sequential) has no dedicated spec in packages/git and no cost check; it is only used as a fixture helper. Project removal can be blocked forever by a historical indeterminate receipt and no test notices.',
    missing: [
      'Git.listWorktrees on a repository with 30 linked worktrees (some prunable, locked or deleted): correct result, at most 2 + 2 per worktree git processes, under N ms.',
      'listWorktrees with a bare repository and a prunable-but-present worktree, asserted directly.',
      'Project removal after a push that ended indeterminate (or after a crash mid-action) eventually succeeds, or an explicit operator path exists and is tested.',
      'InventoryRepository save + read with 50 projects x 20 worktrees keeps worktree ids stable and reads under N ms.',
    ],
  },
  {
    area: 'changes',
    verdict: 'misleading',
    summary:
      'The Git inspection adapter is tested against real repositories and hostile configuration (filter drivers, textconv, replace refs, lazy fetch, identity swaps), and that part is genuinely strong. But nothing here counts processes or time: readStatus spawns 13 git processes and readDiff 9 (measured), and the readDiffs test added with the per-file-cost fix only compares results with per-file reads, so reverting the fix would still pass. The new file-stamps cache key has no spec, and the evidence use-case spec stubs it with a constant.',
    missing: [
      'InspectionGit.readStatus spawns at most N git processes (count with a PATH wrapper like fixtures/isolated-git); conversion filters checked once per call instead of twice with a full ls-files each time.',
      'readDiffs on 50 changes spawns 50 diff processes plus a fixed overhead (identity 4, filters 4), and readDiffs([]) spawns none.',
      'readDiffs with 20 mixed staged and unstaged changes, a submodule, a file over 1 MB and an invalid UTF-8 file: order preserved across 8-wide chunks, per-item omissions do not fail the batch.',
      'readFileStamps: re-editing an already-modified file (same size, same second) changes the stamp; a file modified less than 2 s ago never yields a reusable stamp; future mtime, missing file and symlink cases.',
      'Status on a repository with 20k tracked files and 100k ignored files in node_modules finishes under N ms; 100k tracked files does not fail with InspectionLimitError from ls-files or check-attr.',
      'A new unignored folder with 5,000 files degrades the Changes view (partial list or explicit limit) instead of failing status outright.',
      'status.branch (upstream, ahead/behind, detached HEAD, stashes, remoteName, sourceRef) asserted against real git, including 500 local branches.',
      'parseGitStatus property test with fast-check: generated porcelain v2 records round-trip and only typed errors are thrown.',
    ],
  },
  {
    area: 'review-layers',
    verdict: 'strong',
    summary:
      'Contracts test every bound at its edge, and both repositories use two real SQLite connections to prove optimistic revision checks, immutable commit snapshots and retention across inventory rewrites. The playground e2e confirms seeded layers are served. Remaining gaps are the complete() transaction and payload size.',
    missing: [
      'CommitReviewLayerRepository.complete(): snapshot creation and source layer update commit or roll back together.',
      'Replace and read back the maximum payload (100 layers, 2,500 file references) under N ms.',
    ],
  },
  {
    area: 'comments',
    verdict: 'adequate',
    summary:
      'Schema bounds, the legacy author backfill (including rollback on an interrupted migration), ordering and storage accounting are tested on real SQLite with exact values, and the client proves uncertain writes are never retried. Scale is untested: comment_threads has no worktree_id index, so list and usage scan the whole table.',
    missing: [
      'CommentRepository list/usage with 10,000 threads across 200 worktrees under N ms (would expose the missing worktree_id index).',
      'Reply to a thread at the maximum message count: row rewrite size and time bounded.',
    ],
  },
  {
    area: 'artifacts',
    verdict: 'strong',
    summary:
      'Quotas (bytes and count, global across worktrees), transactional insert and delete via SQLite triggers, and reopen are verified; the client and playground confirm scoped routes. The only open risk is concurrent uploads near the quota.',
    missing: [
      'Two connections creating artifacts concurrently near the byte quota never exceed it.',
    ],
  },
  {
    area: 'files',
    verdict: 'adequate',
    summary:
      'NodeFileReader is one of the best-tested units: real races injected between inspection and open, handle closing, exact 1 MB and 2,000-entry limits. The tree and writer are thinner: the tree has a real 20k-file case but no cost budget, and writer races are not injected. project-folders.ts has no spec in this scope (top-level project-locations specs cover it).',
    missing: [
      'NodeFileTree on 20k paths within a syscall or time budget (each path currently lstats every ancestor and calls realpath).',
      'readTreePaths on a repository whose node_modules holds 1M ignored files: one collapsed ignored entry, 2 git processes, under N ms.',
      'NodeFileReader.read of 500 small files does not allocate 1 MB per read.',
      'NodeFileWriter.move with the destination parent swapped between reservation and rename: CONTENT_CHANGED and the reservation removed.',
      'Editing a 2 MB text file has an explicit, tested outcome (today FILE_TOO_LARGE from the re-read).',
    ],
  },
  {
    area: 'history',
    verdict: 'adequate',
    summary:
      'Correctness is broad and uses git as the oracle: pagination is compared with git rev-list across resets, shallow and partial clones, sha256, octopus merges and cursor tampering. Cost is invisible: a 50-commit page spawns 64 git processes (one cat-file per commit, identity and git --version checked before and after), and deep pages re-walk history via --skip. The largest fixture has about six commits.',
    missing: [
      'listCommits page of 50 spawns at most N git processes (one formatted rev-list or log instead of cat-file per commit).',
      'History on a 50k-commit repository: page 1 and page 200 each under N ms (topo-order with --skip re-walks).',
      'for-each-ref with 300 remote branches and 5,000 tags stays under the 4 MB buffer and N ms, with refs attached correctly.',
      'inspectCommitChanges on a merge touching 400 files with a 900 KB patch stays within limits and N processes.',
    ],
  },
  {
    area: 'git-actions',
    verdict: 'adequate',
    summary:
      'Safety semantics are excellent: every action runs against real git and outcomes are checked in the repository (index bytes, refs, stash list, remote refs), including hooks, signer failure, cancellation in post-commit, reflog races, HTTPS auth and SSH policy. Scale is absent: fixtures have 1 to 3 files, while inspect() rejects any checkout with more than 10,000 files or 32 MB of content (measured: a 12k-file repository cannot prepare a commit) and reads every file to fingerprint it. The commit-draft CLI runner has only a happy-path test.',
    missing: [
      'ActionGit.inspect on a 20k-file, 200 MB repository either succeeds under N ms without reading every file, or the limit is a documented, tested product behaviour shown to the user.',
      'ActionGit.inspect spawns at most N git processes (21 today on a tiny repository) and prepare plus execute do not multiply it.',
      'Fetch from a remote with 500 branches, cancelled mid-transfer: tracking ref unchanged and process group gone.',
      'GitActionProcess output over 4 MB is interrupted and reported, not returned as success.',
      'CliCommitGenerator: a hung CLI is killed with its process group at the deadline; over 1 MB output, non-zero exit and schema-violating JSON become CommitDraftError.',
      'GitActionRepository.isBlocked with 10,000 historical receipts under N ms; expired preparations and old receipts pruned.',
    ],
  },
  {
    area: 'lifecycle',
    verdict: 'adequate',
    summary:
      'Startup and shutdown are tested for real: loopback binding, directory ownership across symlink aliases, lock release after bind or database failure, bounded shutdown with a stalled client, and migration guards that leave the database byte-identical. The weak spot is the OperationRunner behaviour that shapes latency: one shared queue for most requests, deadlines that start at enqueue, and no deduplication are untested. Operation and SQL diagnostics channels are being added in the working tree with minimal tests.',
    missing: [
      'OperationRunner: an operation queued behind 25 s of work with a 30 s deadline still gets its full budget once started, or the enqueue-time deadline is explicit and tested.',
      'Application level: listing comments completes under N ms while an evidence read of 500 files is running (both share the operations queue today).',
      'Identical concurrent evidence or summary requests for one worktree execute once.',
      'Startup with 20 registered projects is listening within N ms, and unavailable repositories do not delay listen.',
      'Shutdown during a running git action finalizes the receipt, releases the lock and leaves no orphan git process.',
    ],
  },
];
