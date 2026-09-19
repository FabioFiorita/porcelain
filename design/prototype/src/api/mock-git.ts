import { structuredPatch } from 'diff';
import type {
  BranchesResponse,
  Receipt,
  RunGitActionRequest,
} from '../contracts/git-actions';
import type { CommitSeed, FileSeed } from './fixtures/types';
import { changedPaths, fileFingerprint, textLines } from './mock-review';
import { type MockStore, newOid, type WorktreeState } from './mock-store';

/** How long each progress line of fetch, pull and push takes to arrive. */
const PROGRESS_MS = 450;

export const shortBranch = (name: string) => name.replace('refs/heads/', '');

/** Only what the action depends on: the branch, the upstream, or the fingerprints of its files. */
function changedSinceLooked(
  worktree: WorktreeState,
  request: RunGitActionRequest,
): string | null {
  const { input, expected } = request;
  if (expected.headOid !== (worktree.commits[0]?.oid ?? null))
    return 'The branch moved since you looked.';
  if (
    (input.action === 'fetch' ||
      input.action === 'pull' ||
      input.action === 'push') &&
    expected.upstreamOid !== undefined
  ) {
    if (expected.upstreamOid !== worktree.branch.upstreamOid)
      return 'The upstream moved since you looked.';
  }
  for (const file of expected.files ?? []) {
    if (fileFingerprint(worktree, file.path) !== file.fingerprint)
      return `${file.path} changed since you looked.`;
  }
  return null;
}

/** HEAD and the branch move to a new commit; remote refs stay where they were. */
export function commitOnHead(
  worktree: WorktreeState,
  commit: {
    oid: string;
    subject: string;
    body?: string;
    author: string;
    files: { path: string; before: string | null; after: string | null }[];
  },
) {
  const branch = shortBranch(worktree.branch.name);
  const previous = worktree.commits[0];
  if (previous != null) {
    const refs = previous.refs?.filter(
      (ref) => ref !== 'HEAD' && ref !== branch,
    );
    worktree.commits[0] = {
      ...previous,
      refs: refs?.length === 0 ? undefined : refs,
    };
  }
  worktree.commits.unshift({
    ...commit,
    minutesAgo: 0,
    parentOids: previous == null ? [] : [previous.oid],
    refs: ['HEAD', branch],
  });
}

/**
 * The commit that ends a merge: it gains the upstream commit as its second parent,
 * History gains that commit, and the branch is no longer behind.
 */
export function finishMerge(worktree: WorktreeState, incoming: CommitSeed) {
  const upstream = worktree.branch.upstream;
  const merge = worktree.commits[0];
  if (merge == null) return;
  merge.parentOids = [...merge.parentOids, incoming.oid];
  merge.filesByParent = {
    2: merge.files
      .map((file) => ({
        ...file,
        before:
          incoming.files.find((entry) => entry.path === file.path)?.after ??
          file.before,
      }))
      .filter((file) => file.before !== file.after),
  };
  for (const commit of worktree.commits)
    commit.refs = commit.refs?.filter((ref) => ref !== upstream);
  worktree.commits.splice(1, 0, {
    ...incoming,
    refs: upstream == null ? undefined : [upstream],
  });
  worktree.branch.behind = 0;
  worktree.branch.upstreamOid = incoming.oid;
  worktree.inProgress = null;
  worktree.incoming = null;
}

/** Reverts the one hunk whose new-side lines overlap `range`, leaving the rest of the file as it is. */
function revertHunk(
  file: FileSeed,
  range: { startLine: number; endLine: number },
): string | null {
  if (file.head == null || file.working == null) return null;
  const lines = textLines(file.working);
  for (const hunk of structuredPatch(
    'a',
    'b',
    file.head,
    file.working,
    '',
    '',
    { context: 0 },
  ).hunks) {
    const start = hunk.newStart;
    const end = hunk.newStart + Math.max(hunk.newLines, 1) - 1;
    if (range.startLine > end || range.endLine < start) continue;
    const old = hunk.lines
      .filter((line) => line.startsWith('-'))
      .map((line) => line.slice(1));
    // A pure deletion's newStart is the line before it: insert after that line.
    const at = hunk.newLines === 0 ? hunk.newStart : hunk.newStart - 1;
    lines.splice(at, hunk.newLines, ...old);
    return `${lines.join('\n')}\n`;
  }
  return null;
}

function branchesOf(
  store: MockStore,
  worktree: WorktreeState,
): { current: string; elsewhere: Map<string, string> } {
  const elsewhere = new Map<string, string>();
  const project = store.projects.find(
    (entry) => entry.id === worktree.projectId,
  );
  for (const entry of project?.worktrees ?? []) {
    const other = store.worktree(entry.id);
    if (other == null || other === worktree) continue;
    elsewhere.set(shortBranch(other.branch.name), entry.path);
  }
  return { current: shortBranch(worktree.branch.name), elsewhere };
}

export function listBranches(
  store: MockStore,
  worktree: WorktreeState,
): BranchesResponse {
  const { current, elsewhere } = branchesOf(store, worktree);
  const names = [
    ...new Set([...worktree.otherBranches, ...elsewhere.keys()]),
  ].filter((name) => name !== current);
  const lastCommitAt = (index: number) =>
    new Date(Date.now() - (index + 2) * 3_600_000).toISOString();
  return {
    current,
    branches: [
      {
        name: current,
        upstream: worktree.branch.upstream,
        lastCommitAt: new Date().toISOString(),
        checkedOutElsewhere: false,
      },
      ...names.map((name, index) => ({
        name,
        upstream: `origin/${name}`,
        lastCommitAt: lastCommitAt(index),
        checkedOutElsewhere: elsewhere.has(name),
      })),
    ],
  };
}

const PROGRESS: Record<
  'fetch' | 'pull' | 'push',
  (branch: string) => string[]
> = {
  fetch: (branch) => [
    'remote: Counting objects: 100% (12/12), done.',
    'Receiving objects: 100% (7/7), 2.1 KiB, done.',
    `From origin: ${branch} has 1 new commit`,
  ],
  pull: (branch) => [
    'remote: Counting objects: 100% (12/12), done.',
    'Receiving objects: 100% (7/7), 2.1 KiB, done.',
    `Updating ${branch}: fast-forward`,
  ],
  push: (branch) => [
    'Enumerating objects: 9, done.',
    'Writing objects: 100% (5/5), 1.4 KiB, done.',
    `To origin: ${branch} updated`,
  ],
};

/**
 * Runs one action. Network actions answer `running` at once and report progress and
 * completion over the live channel; the rest answer their final receipt.
 */
export function runAction(
  store: MockStore,
  worktreeId: string,
  request: RunGitActionRequest,
): Receipt {
  const worktree = store.worktree(worktreeId);
  if (worktree == null) throw new Error('unknown worktree');
  const existing = worktree.receipts.get(request.requestId);
  if (existing != null) return structuredClone(existing);

  const { input } = request;
  const receipt: Receipt = {
    requestId: request.requestId,
    worktreeId,
    action: input.action,
    state: 'running',
    progress: [],
    startedAt: Date.now(),
  };
  worktree.receipts.set(request.requestId, receipt);
  const finish = (update: Partial<Receipt>) => {
    Object.assign(receipt, update, { finishedAt: Date.now() });
    store.emit({
      kind: 'action',
      worktreeId,
      requestId: receipt.requestId,
      state: 'finished',
    });
    if (
      receipt.state === 'succeeded' ||
      receipt.reason === 'CHANGED_SINCE_LOOKED' ||
      receipt.reason === 'GIT_REJECTED'
    ) {
      store.emit({ kind: 'branch', worktreeId });
      store.emit({ kind: 'files', worktreeId, paths: [] });
      store.emit({
        kind: 'review',
        worktreeId,
        revision: worktree.review?.revision ?? null,
      });
      store.emit({ kind: 'marks', worktreeId });
      store.emit({ kind: 'inventory' });
    }
    return structuredClone(receipt);
  };

  const moved = changedSinceLooked(worktree, request);
  if (moved != null)
    return finish({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
      message: moved,
    });

  const branch = worktree.branch;
  const branchName = shortBranch(branch.name);

  if (
    input.action === 'fetch' ||
    input.action === 'pull' ||
    input.action === 'push'
  ) {
    if (branch.upstream == null)
      return finish({
        state: 'rejected',
        reason: 'UNSUPPORTED_CONFIGURATION',
        message: 'This branch has no upstream.',
      });
    if (input.action === 'push' && branch.behind > 0) {
      return finish({
        state: 'rejected',
        reason: 'NON_FAST_FORWARD',
        message:
          'Updates were rejected because the remote has work you do not have. Pull first.',
      });
    }
    const lines = PROGRESS[input.action](branchName);
    lines.forEach((line, index) => {
      setTimeout(
        () => {
          receipt.progress.push(line);
          store.emit({
            kind: 'action',
            worktreeId,
            requestId: receipt.requestId,
            state: 'running',
            line,
          });
          if (index < lines.length - 1) return;
          if (input.action === 'fetch') {
            if (worktree.fetchedOnce) {
              finish({ state: 'no-change' });
              return;
            }
            worktree.fetchedOnce = true;
            branch.behind += 1;
            branch.upstreamOid = newOid();
            finish({ state: 'succeeded' });
          } else if (input.action === 'pull') {
            if (branch.behind === 0) {
              finish({ state: 'no-change' });
              return;
            }
            if (input.strategy === 'ff-only' && branch.ahead > 0) {
              finish({
                state: 'rejected',
                reason: 'GIT_REJECTED',
                message: 'fatal: Not possible to fast-forward, aborting.',
              });
              return;
            }
            const incoming = worktree.incoming;
            const change = incoming?.files[0];
            const file =
              change == null ? undefined : worktree.files.get(change.path);
            if (
              incoming != null &&
              change != null &&
              file?.working != null &&
              change.before != null &&
              change.after != null
            ) {
              // Both sides appended to the same base, so Git cannot pick one.
              const tail = (text: string) =>
                text.slice(change.before?.length ?? 0).replace(/^\n/, '');
              const ours = { label: 'HEAD', text: tail(file.working) };
              const theirs = {
                label: branch.upstream ?? 'upstream',
                text: tail(change.after),
              };
              const [first, second] =
                input.strategy === 'rebase'
                  ? [
                      theirs,
                      {
                        ...ours,
                        label: worktree.commits[0]?.subject ?? 'local',
                      },
                    ]
                  : [ours, theirs];
              file.working = `${change.before}\n<<<<<<< ${first.label}\n${first.text}=======\n${second.text}>>>>>>> ${second.label}\n`;
              file.conflict = 'UU';
              // The rest merges cleanly: staged for the merge commit, or already applied by the rebase.
              for (const other of incoming.files.slice(1)) {
                if (other.after == null || worktree.files.has(other.path))
                  continue;
                worktree.files.set(
                  other.path,
                  input.strategy === 'rebase'
                    ? { head: other.after, working: other.after }
                    : {
                        head: other.before,
                        working: other.after,
                        staged: true,
                      },
                );
              }
              worktree.inProgress =
                input.strategy === 'rebase' ? 'rebase' : 'merge';
              finish({
                state: 'conflicted',
                message:
                  input.strategy === 'rebase'
                    ? `CONFLICT (content): Merge conflict in ${change.path}\nerror: could not apply ${worktree.commits[0]?.oid.slice(0, 7)}... ${worktree.commits[0]?.subject}\nResolve all conflicts manually, mark them as resolved with "git add/rm <conflicted_files>", then run "git rebase --continue".`
                    : `CONFLICT (content): Merge conflict in ${change.path}\nAutomatic merge failed; fix conflicts and then commit the result.`,
              });
              store.emit({ kind: 'branch', worktreeId });
              store.emit({
                kind: 'files',
                worktreeId,
                paths: incoming.files.map((entry) => entry.path),
              });
              return;
            }
            const oid = newOid();
            commitOnHead(worktree, {
              oid,
              subject: 'Tighten the review revision check',
              author: 'Ana Souza',
              files: [
                {
                  path: 'CHANGELOG.md',
                  before: '# Changelog\n',
                  after: '# Changelog\n\n- Revision checks are strict.\n',
                },
              ],
            });
            branch.behind = 0;
            branch.upstreamOid = oid;
            finish({ state: 'succeeded', result: { headOid: oid } });
          } else {
            if (branch.ahead === 0) {
              finish({ state: 'no-change' });
              return;
            }
            branch.ahead = 0;
            branch.upstreamOid = worktree.commits[0]?.oid ?? null;
            finish({
              state: 'succeeded',
              result: { destinationRef: branch.upstream ?? undefined },
            });
          }
        },
        PROGRESS_MS * (index + 1),
      );
    });
    return structuredClone(receipt);
  }

  switch (input.action) {
    case 'commit':
    case 'amend': {
      const message = input.message.trim();
      if (message === '')
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: 'Aborting commit due to empty commit message.',
        });
      if (worktree.inProgress === 'rebase') {
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message:
            'A rebase is in progress: continue it with git rebase --continue, or abort it.',
        });
      }
      if (input.action === 'amend' && worktree.inProgress === 'merge') {
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: 'You are in the middle of a merge -- cannot amend.',
        });
      }
      const changed = changedPaths(worktree);
      // A merge commit is the whole index (Git refuses a partial one): the picked files are added to what the merge staged.
      const merging =
        input.action === 'commit' && worktree.inProgress === 'merge';
      const paths = changed.filter(
        (path) =>
          input.paths.includes(path) ||
          (merging && worktree.files.get(path)?.staged === true),
      );
      if (input.action === 'commit' && paths.length === 0 && !merging)
        return finish({ state: 'no-change' });
      // The server stages what it commits, which marks conflicted files resolved; it refuses leftover markers.
      const markers = paths.filter((path) =>
        /^(<<<<<<<|>>>>>>>) /m.test(worktree.files.get(path)?.working ?? ''),
      );
      if (markers.length > 0) {
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: `Conflict markers are still in ${markers.join(', ')}. Resolve them, then commit.`,
        });
      }
      const unmerged = [...worktree.files]
        .filter(
          ([path, file]) => file.conflict != null && !paths.includes(path),
        )
        .map(([path]) => path);
      if (unmerged.length > 0) {
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: `Committing is not possible because you have unmerged files: ${unmerged.join(', ')}.`,
        });
      }
      const files = paths.map((path) => {
        const file = worktree.files.get(path);
        return {
          path,
          before: file?.head ?? null,
          after: file?.working ?? null,
        };
      });
      for (const path of paths) {
        const file = worktree.files.get(path);
        if (file?.working == null) worktree.files.delete(path);
        else
          Object.assign(file, {
            head: file.working,
            conflict: undefined,
            staged: undefined,
          });
      }
      const [subject = '', ...rest] = message.split('\n');
      const oid = newOid();
      if (input.action === 'amend') {
        const last = worktree.commits[0];
        if (last == null)
          return finish({
            state: 'rejected',
            reason: 'GIT_REJECTED',
            message: 'There is no commit to amend.',
          });
        const wasPushed = branch.ahead === 0 && branch.upstream != null;
        worktree.commits[0] = {
          ...last,
          oid,
          subject,
          body: rest.join('\n').trim() || undefined,
          minutesAgo: 0,
          files: [...last.files, ...files],
        };
        // Amending a pushed commit leaves the branch diverged from its upstream.
        if (wasPushed) {
          branch.ahead = 1;
          branch.behind = 1;
        }
        return finish({ state: 'succeeded', result: { headOid: oid } });
      }
      commitOnHead(worktree, {
        oid,
        subject,
        body: rest.join('\n').trim() || undefined,
        author: 'You',
        files,
      });
      branch.ahead += 1;
      if (worktree.inProgress === 'merge' && worktree.incoming != null)
        finishMerge(worktree, worktree.incoming);
      return finish({ state: 'succeeded', result: { headOid: oid } });
    }
    case 'stash-create': {
      const paths = changedPaths(worktree);
      if (paths.length === 0) return finish({ state: 'no-change' });
      const snapshot = new Map(
        paths.map((path) => [
          path,
          { ...(worktree.files.get(path) as FileSeed) },
        ]),
      );
      for (const path of paths) {
        const file = worktree.files.get(path);
        if (file == null) continue;
        if (file.head == null) worktree.files.delete(path);
        else file.working = file.head;
      }
      const oid = newOid();
      worktree.stashes.unshift({
        oid,
        message: input.message,
        files: snapshot,
      });
      return finish({ state: 'succeeded', result: { stashOid: oid } });
    }
    case 'stash-apply':
    case 'stash-pop': {
      // A discarded version restores like a stash, then its backup is dropped.
      const backup = worktree.discarded.get(input.stashOid);
      if (backup != null && input.action === 'stash-apply') {
        for (const [path, file] of backup)
          worktree.files.set(path, { ...file });
        worktree.discarded.delete(input.stashOid);
        return finish({
          state: 'succeeded',
          result: { stashOid: input.stashOid, stashRetained: false },
        });
      }
      const index = worktree.stashes.findIndex(
        (stash) => stash.oid === input.stashOid,
      );
      const stash = worktree.stashes[index];
      if (stash == null)
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: 'That stash no longer exists.',
        });
      for (const [path, file] of stash.files)
        worktree.files.set(path, { ...file });
      if (input.action === 'stash-pop') worktree.stashes.splice(index, 1);
      return finish({
        state: 'succeeded',
        result: {
          stashOid: stash.oid,
          stashRetained: input.action === 'stash-apply',
        },
      });
    }
    case 'discard': {
      const file = worktree.files.get(input.path);
      if (file == null || file.head === file.working)
        return finish({ state: 'no-change' });
      const saved = { ...file };
      if (input.hunk != null) {
        const reverted = revertHunk(file, input.hunk);
        if (reverted == null) return finish({ state: 'no-change' });
        file.working = reverted;
      } else if (file.head == null) {
        worktree.files.delete(input.path);
      } else {
        file.working = file.head;
      }
      // The discarded version is saved first (outside the stash list), so it can always be restored.
      const oid = newOid();
      worktree.discarded.set(oid, new Map([[input.path, saved]]));
      return finish({ state: 'succeeded', result: { restoreStashOid: oid } });
    }
    case 'switch-branch': {
      const { current, elsewhere } = branchesOf(store, worktree);
      if (input.branch === current) return finish({ state: 'no-change' });
      const other = elsewhere.get(input.branch);
      if (other != null) {
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: `fatal: '${input.branch}' is already used by worktree at '${other}'`,
        });
      }
      if (!worktree.otherBranches.includes(input.branch)) {
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: `error: pathspec '${input.branch}' did not match any branch`,
        });
      }
      worktree.otherBranches = [
        ...worktree.otherBranches.filter((name) => name !== input.branch),
        current,
      ];
      branch.name = `refs/heads/${input.branch}`;
      branch.upstream = `origin/${input.branch}`;
      branch.ahead = 0;
      branch.behind = 0;
      return finish({ state: 'succeeded', result: { branch: input.branch } });
    }
    case 'create-branch': {
      const name = input.branch.trim();
      const { current, elsewhere } = branchesOf(store, worktree);
      if (
        !/^[\w][\w./-]*$/.test(name) ||
        name.includes('..') ||
        name.endsWith('/') ||
        name.endsWith('.lock')
      ) {
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: `fatal: '${name}' is not a valid branch name`,
        });
      }
      if (
        name === current ||
        worktree.otherBranches.includes(name) ||
        elsewhere.has(name)
      ) {
        return finish({
          state: 'rejected',
          reason: 'GIT_REJECTED',
          message: `fatal: a branch named '${name}' already exists`,
        });
      }
      if (input.switchTo) {
        worktree.otherBranches = [...worktree.otherBranches, current];
        branch.name = `refs/heads/${name}`;
        branch.upstream = null;
        branch.upstreamOid = null;
        branch.ahead = 0;
        branch.behind = 0;
      } else {
        worktree.otherBranches = [...worktree.otherBranches, name];
      }
      return finish({ state: 'succeeded', result: { branch: name } });
    }
  }
}
