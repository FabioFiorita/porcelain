import type {
  ReadGitStatusResponse,
  ReadChangesResponse,
} from '@porcelain/contracts/changes';
import type { GitAction } from './git-action.ts';
type Status = ReadGitStatusResponse;
type Change = ReadChangesResponse['changes'][number]['comparisons'][number];

type GitBranchStatus = Pick<
  NonNullable<Status['branch']>,
  'name' | 'upstream' | 'ahead' | 'behind'
> &
  Partial<
    Omit<
      NonNullable<Status['branch']>,
      'name' | 'upstream' | 'ahead' | 'behind'
    >
  >;
export type GitActionStatus = {
  statusToken: string;
  inProgress?: 'merge' | 'rebase' | null | undefined;
  mergeHeadOid?: string | null | undefined;
  headOid?: string | null | undefined;
  changes: readonly Change[];
  files?: readonly { path: string; fingerprint: string | null | undefined }[];
  branch?: GitBranchStatus | null | undefined;
};

export function statusFromChanges(
  changes: ReadChangesResponse,
): GitActionStatus {
  return {
    statusToken: changes.statusToken,
    inProgress: changes.inProgress,
    mergeHeadOid: changes.mergeHeadOid,
    headOid: changes.headOid,
    branch: changes.branch,
    changes: changes.changes.flatMap((entry) => entry.comparisons),
    files: changes.changes.map(({ path, fingerprint }) => ({
      path,
      fingerprint,
    })),
  };
}

type ListedBranch = Pick<
  GitBranchStatus,
  'name' | 'upstream' | 'ahead' | 'behind'
>;

export function shownBranch(
  listed: ListedBranch | null | undefined,
  looked: GitBranchStatus | null | undefined,
): GitBranchStatus | null | undefined {
  if (listed === null || listed === undefined) return looked;
  if (
    looked === null ||
    looked === undefined ||
    looked.name !== listed.name ||
    looked.upstream !== listed.upstream
  )
    return listed;
  return {
    ...looked,
    name: listed.name,
    upstream: listed.upstream,
    ahead: listed.ahead,
    behind: listed.behind,
  };
}

export function branchStatus(status: GitActionStatus): GitBranchStatus | null {
  return status.branch ?? null;
}

function hasConflicts(status: GitActionStatus) {
  return status.changes.some((change) => change.scope === 'unmerged');
}

export function gitActionBlocker(
  action: GitAction,
  status: GitActionStatus,
): string | null {
  const branch = branchStatus(status);
  if (status.inProgress === 'rebase')
    return 'Continue or abort the rebase in a terminal.';
  if (status.inProgress === 'merge' && action !== 'commit')
    return 'Finish or abort the merge first.';
  if (status.inProgress === 'merge' && !status.mergeHeadOid)
    return 'Finish this merge in a terminal.';
  switch (action) {
    case 'commit':
      return hasConflicts(status) && status.inProgress !== 'merge'
        ? 'Resolve the conflicts before committing.'
        : null;
    case 'amend':
      if (hasConflicts(status)) return 'Resolve the conflicts before amending.';
      return status.headOid === null || status.headOid === undefined
        ? 'There is no commit to amend.'
        : null;
    case 'push':
      if (!branch) return null;
      if (branch.name === null || branch.name === undefined)
        return 'Detached HEAD: check out a branch before pushing.';
      if (branch.behind > 0) return 'Pull the upstream changes before pushing.';
      return branch.ahead > 0 ||
        branch.upstream === null ||
        branch.upstream === undefined
        ? null
        : 'No local commits to push.';
    case 'pull':
      if (branch?.upstream === null || branch?.upstream === undefined)
        return 'No upstream branch to pull from.';
      if (status.changes.length)
        return 'Commit or stash local changes before pulling.';
      if (branch?.name === null)
        return 'Detached HEAD: check out a branch before pulling.';
      return null;
    case 'fetch':
      return branch?.upstream === null || branch?.upstream === undefined
        ? 'No upstream branch to fetch.'
        : null;
    case 'stash-create':
      return null;
    case 'stash-apply':
    case 'stash-pop':
      return branch?.stashes && branch.stashes.length === 0
        ? 'No stash is available.'
        : null;
    case 'discard':
      return null;
  }
}

export function gitActionReason(
  action: GitAction,
  status: GitActionStatus,
): string | null {
  const branch = branchStatus(status);
  if (status.inProgress === 'rebase')
    return 'Continue or abort the rebase in a terminal.';
  if (status.inProgress === 'merge' && action !== 'commit')
    return 'Finish or abort the merge first.';
  switch (action) {
    case 'commit':
      return status.changes.length ? null : 'Nothing to commit.';
    case 'amend':
      return status.changes.length
        ? 'Choose which changed files to add to the last commit.'
        : 'Change the last commit message.';
    case 'push':
      return branch === null || branch === undefined
        ? 'Enter the configured remote and full branch ref.'
        : null;
    case 'pull':
    case 'fetch':
      return branch === null || branch === undefined
        ? 'Enter the configured remote and full branch ref.'
        : null;
    case 'stash-create':
      return status.changes.length === 0
        ? 'Nothing changed; the server will report no change.'
        : null;
    case 'stash-apply':
    case 'stash-pop':
      return branch?.stashes === null || branch?.stashes === undefined
        ? 'Enter a full stash object ID.'
        : null;
    case 'discard':
      return null;
  }
}

type PrimaryGitAction =
  | { kind: 'commit'; label: string }
  | { kind: 'run'; action: 'push' | 'pull'; label: string }
  | { kind: 'stash'; label: string }
  | { kind: 'hint'; label: string; hint: string };

export function suggestedCount(
  primary: PrimaryGitAction,
  status: GitActionStatus,
): number | null {
  const branch = branchStatus(status);
  if (primary.kind !== 'run' || branch === null || branch === undefined)
    return null;
  return primary.action === 'pull' ? branch.behind : branch.ahead;
}

export function primaryGitAction(status: GitActionStatus): PrimaryGitAction {
  if (
    status.inProgress === 'rebase' ||
    (status.inProgress === 'merge' && !status.mergeHeadOid)
  )
    return {
      kind: 'hint',
      label: 'Git recovery',
      hint: 'Finish or abort this operation in a terminal.',
    };
  if (status.inProgress === 'merge' || status.changes.length > 0)
    return { kind: 'commit', label: 'Commit' };

  const branch = branchStatus(status);
  if (branch === null || branch === undefined)
    return {
      kind: 'hint',
      label: 'Commit',
      hint: 'Nothing to commit. Choose a Git action to continue.',
    };
  if (branch.name === null || branch.name === undefined)
    return {
      kind: 'hint',
      label: 'Commit',
      hint: 'Detached HEAD: check out a branch before pushing.',
    };
  if (branch.behind > 0)
    return {
      kind: 'run',
      action: 'pull',
      label: 'Pull',
    };
  if (branch.ahead > 0) return { kind: 'run', action: 'push', label: 'Push' };
  if ((branch.stashes?.length ?? 0) > 0)
    return { kind: 'stash', label: 'Apply stash' };
  return {
    kind: 'hint',
    label: 'Commit',
    hint: 'Nothing to commit, pull or push.',
  };
}
