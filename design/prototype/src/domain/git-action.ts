import type {
  ActionInput,
  Expectation,
  GitAction,
  Receipt,
} from '../contracts/git-actions';
import type { GitStatusResponse } from '../contracts/git-status';
import { listChanges } from './review';

export type { ActionInput, GitAction, Receipt };

/** The Git button's menu, in order. Discard lives on a file or a hunk, not here. */
export type GitMenuAction =
  | 'commit'
  | 'amend'
  | 'push'
  | 'pull'
  | 'fetch'
  | 'stash-create'
  | 'stash-pop'
  | 'switch-branch'
  | 'create-branch';

export const GIT_MENU: readonly { action: GitMenuAction; label: string }[] = [
  { action: 'commit', label: 'Commit…' },
  { action: 'amend', label: 'Amend last commit…' },
  { action: 'push', label: 'Push' },
  { action: 'pull', label: 'Pull' },
  { action: 'fetch', label: 'Fetch' },
  { action: 'stash-create', label: 'Stash changes' },
  { action: 'stash-pop', label: 'Pop stash' },
  { action: 'switch-branch', label: 'Switch branch…' },
  { action: 'create-branch', label: 'Create branch…' },
];

const LABELS: Record<GitAction, string> = {
  fetch: 'Fetch',
  pull: 'Pull',
  push: 'Push',
  commit: 'Commit',
  amend: 'Amend',
  'stash-create': 'Stash changes',
  'stash-apply': 'Apply stash',
  'stash-pop': 'Pop stash',
  discard: 'Discard',
  'switch-branch': 'Switch branch',
  'create-branch': 'Create branch',
};

/** A short name for toasts and confirms. */
export const gitActionLabel = (action: GitAction) => LABELS[action];

/** Both sides have commits the other lacks, e.g. after amending a pushed commit. */
export const DIVERGED =
  'The branch and its upstream have diverged. Pull to combine them, or force push outside Porcelain.';
const DIVERGED_FF_ONLY =
  'The branch and its upstream have diverged, and Pull only fast-forwards. Pull with merge or with rebase from the Git menu.';

export type PullStrategy = Extract<ActionInput, { action: 'pull' }>['strategy'];

/**
 * Fast-forward only (the default, as in Git) cannot combine a diverged branch; the Git
 * menu then offers one pull with merge or with rebase, leaving the setting alone.
 */
export const pullNeedsStrategy = (
  status: GitStatusResponse,
  pullStrategy: PullStrategy,
) =>
  pullStrategy === 'ff-only' &&
  status.inProgress == null &&
  status.branch.upstream != null &&
  status.branch.ahead > 0 &&
  status.branch.behind > 0;

const diverged = (pullStrategy: PullStrategy) =>
  pullStrategy === 'ff-only' ? DIVERGED_FF_ONLY : DIVERGED;

/** Porcelain has no continue action: the agent or a terminal finishes a rebase. */
export const REBASE_STOPPED =
  'A rebase stopped on a conflict: continue it with git rebase --continue, or abort it.';

export type PrimaryGitAction =
  | { kind: 'commit'; label: string }
  | { kind: 'run'; action: 'pull' | 'push'; label: string }
  | { kind: 'hint'; label: string; hint: string };

/**
 * What one click on the Git button does, in t3code's order: commit what is
 * pending, then catch up with upstream, then publish.
 */
export function primaryGitAction(
  status: GitStatusResponse,
  pullStrategy: PullStrategy,
): PrimaryGitAction {
  const branch = status.branch;
  if (status.inProgress === 'rebase')
    return { kind: 'hint', label: 'Commit', hint: REBASE_STOPPED };
  // A merge finishes with a commit, even one that changes nothing.
  if (status.inProgress === 'merge' || status.changes.length > 0)
    return { kind: 'commit', label: 'Commit' };
  if (branch.name == null)
    return {
      kind: 'hint',
      label: 'Commit',
      hint: 'Detached HEAD: switch to a branch to push or pull.',
    };
  if (branch.ahead > 0 && branch.behind > 0)
    return { kind: 'hint', label: 'Pull', hint: diverged(pullStrategy) };
  if (branch.behind > 0) return { kind: 'run', action: 'pull', label: 'Pull' };
  if (branch.ahead > 0) return { kind: 'run', action: 'push', label: 'Push' };
  return {
    kind: 'hint',
    label: 'Commit',
    hint: 'Nothing to commit, pull or push.',
  };
}

/** Why a menu action cannot run right now, or null when it can. */
export function gitActionBlocker(
  action: GitMenuAction,
  status: GitStatusResponse,
  pullStrategy: PullStrategy,
): string | null {
  const branch = status.branch;
  const changed = status.changes.length > 0;
  // Committing stages the files, which marks resolved conflicts resolved, so a merge
  // finishes with a commit. A rebase finishes with `git rebase --continue` instead.
  const stopped =
    status.inProgress == null
      ? null
      : `Finish or abort the ${status.inProgress} first.`;
  switch (action) {
    case 'commit':
      if (status.inProgress === 'rebase') return REBASE_STOPPED;
      return changed || status.inProgress === 'merge'
        ? null
        : 'Nothing to commit.';
    case 'amend':
      if (stopped != null) return stopped;
      return status.headOid == null ? 'There is no commit to amend yet.' : null;
    case 'push':
      if (stopped != null) return stopped;
      if (branch.name == null)
        return 'Detached HEAD: switch to a branch first.';
      if (branch.ahead > 0 && branch.behind > 0) return diverged(pullStrategy);
      if (branch.behind > 0)
        return 'The branch is behind upstream. Pull first.';
      return branch.ahead > 0 || branch.upstream == null
        ? null
        : 'No local commits to push.';
    case 'pull':
      if (stopped != null) return stopped;
      if (branch.upstream == null) return 'No upstream branch to pull from.';
      if (branch.behind === 0)
        return 'Already up to date. Fetch to check again.';
      return branch.ahead > 0 && pullStrategy === 'ff-only'
        ? DIVERGED_FF_ONLY
        : null;
    case 'fetch':
      return branch.upstream == null ? 'No upstream branch to fetch.' : null;
    case 'stash-create':
      if (stopped != null) return stopped;
      return changed ? null : 'Nothing to stash.';
    case 'stash-pop':
      if (stopped != null) return stopped;
      if (branch.stashes.length === 0) return 'No stash to pop.';
      return changed ? 'Commit or stash your changes first.' : null;
    case 'switch-branch':
    case 'create-branch':
      return stopped;
  }
}

/** Amending a commit that is already on the upstream rewrites pushed history. */
export const amendRewritesPushed = (status: GitStatusResponse) =>
  status.headOid != null &&
  status.branch.upstream != null &&
  status.branch.ahead === 0;

/**
 * What the reviewer saw, sent with every action. The server checks only what the
 * action depends on and answers "changed since you looked" otherwise.
 */
export function expectationFor(
  status: GitStatusResponse,
  paths: readonly string[] = [],
): Expectation {
  // One fingerprint per file: for one Git lists twice, the one of the file on disk, which is what gets committed.
  const fingerprints = new Map(
    listChanges(status.changes).map((file) => [
      file.path,
      file.change.fingerprint,
    ]),
  );
  return {
    headOid: status.headOid,
    upstreamOid: status.branch.upstreamOid,
    files: paths.flatMap((path) => {
      const fingerprint = fingerprints.get(path);
      return fingerprint == null ? [] : [{ path, fingerprint }];
    }),
  };
}

/** The input for a network or stash action, filled from the current status. */
export function actionInput(
  action: 'fetch' | 'pull' | 'push' | 'stash-create' | 'stash-pop',
  status: GitStatusResponse,
  pullStrategy: 'ff-only' | 'merge' | 'rebase',
): ActionInput {
  const branch = status.branch.name ?? 'refs/heads/main';
  const remoteName = status.branch.upstream?.split('/')[0] ?? 'origin';
  switch (action) {
    case 'fetch':
      return { action, remoteName };
    case 'pull':
      return { action, remoteName, strategy: pullStrategy };
    case 'push':
      return {
        action,
        remoteName,
        destinationRef: branch,
        allowCreate: status.branch.upstream == null,
      };
    case 'stash-create':
      return { action, message: 'Porcelain stash', includeUntracked: true };
    case 'stash-pop':
      return { action, stashOid: status.branch.stashes[0]?.oid ?? '' };
  }
}

/** One commit of a grouped commit: its message and the paths it takes. */
export type CommitGroup = { id: string; message: string; paths: string[] };

/**
 * Moves a path into another group, dropping any group it leaves empty. A path
 * that was in no group (left uncommitted) joins the target the same way.
 */
export function moveToGroup(
  groups: readonly CommitGroup[],
  path: string,
  targetId: string,
): CommitGroup[] {
  return groups
    .map((group) => {
      const without = group.paths.filter((entry) => entry !== path);
      return group.id === targetId
        ? { ...group, paths: [...without, path] }
        : { ...group, paths: without };
    })
    .filter((group) => group.paths.length > 0);
}

/** Changed paths no group takes: they stay uncommitted. */
export function ungroupedPaths(
  paths: readonly string[],
  groups: readonly CommitGroup[],
): string[] {
  const grouped = new Set(groups.flatMap((group) => group.paths));
  return paths.filter((path) => !grouped.has(path));
}

/** A grouped commit can run only when every group has files and a message. */
export function groupsBlocker(groups: readonly CommitGroup[]): string | null {
  if (groups.length === 0) return 'No groups left to commit.';
  const unnamed = groups.findIndex((group) => group.message.trim() === '');
  return unnamed === -1 ? null : `Commit ${unnamed + 1} needs a message.`;
}

export function receiptHeadline(receipt: Receipt): string {
  switch (receipt.state) {
    case 'running':
      return receipt.progress.at(-1) ?? 'Running…';
    case 'succeeded':
      return 'Done';
    case 'no-change':
      return 'Nothing to do';
    case 'conflicted':
      return 'Stopped on a conflict';
    case 'interrupted':
      return 'Interrupted by a server restart';
    case 'rejected':
      if (receipt.reason === 'CHANGED_SINCE_LOOKED')
        return receipt.message ?? 'Changed since you looked';
      if (receipt.reason === 'NON_FAST_FORWARD')
        return 'Rejected: upstream has commits you do not';
      return receipt.message ?? 'Rejected';
  }
}

/** Whether a receipt means the action did not do what was asked. */
export const receiptFailed = (receipt: Receipt) =>
  receipt.state === 'rejected' ||
  receipt.state === 'conflicted' ||
  receipt.state === 'interrupted';

export const receiptFinished = (receipt: Receipt) =>
  receipt.state !== 'running';
