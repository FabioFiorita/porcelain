import type { LucideIcon } from 'lucide-react';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  GitCommitHorizontalIcon,
  HistoryIcon,
} from 'lucide-react';
import type { GitAction } from '../../domain/git-action';
import type { Change, Status } from '../../domain/review';

export type GitBranchStatus = NonNullable<Status['branch']>;
/**
 * What deciding an action needs: the comparisons, the observation they were
 * read at, and the branch. The change list carries all three. The remote name
 * and stashes are absent from it, and an absent field already means "not known
 * to be blocking" here — the action panel reads them when it opens.
 */
export type GitActionStatus = {
  statusToken: string;
  inProgress?: 'merge' | 'rebase' | null;
  mergeHeadOid?: string | null;
  headOid?: string | null;
  changes: readonly Change[];
  files?: readonly { path: string; fingerprint: string | null }[];
  branch?: GitBranchStatus | null | undefined;
};

type GitActionGroupId = 'commit' | 'sync' | 'stash' | 'branch';

export type GitActionOption = {
  readonly id: GitAction;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly group: GitActionGroupId;
};

/** Actions supported by the current API, in the order used by the menu. */
export const gitActions = [
  {
    id: 'commit',
    label: 'Commit…',
    description: 'Commit selected files',
    icon: GitCommitHorizontalIcon,
    group: 'commit',
  },
  {
    id: 'amend',
    label: 'Amend last commit…',
    description: 'Replace the latest commit',
    icon: HistoryIcon,
    group: 'commit',
  },
  {
    id: 'push',
    label: 'Push',
    description: 'Send committed changes',
    icon: ArrowUpIcon,
    group: 'sync',
  },
  {
    id: 'pull',
    label: 'Pull',
    description: 'Bring in upstream changes',
    icon: ArrowDownIcon,
    group: 'sync',
  },
  {
    id: 'fetch',
    label: 'Fetch',
    description: 'Update a remote-tracking branch',
    icon: ArrowDownIcon,
    group: 'sync',
  },
  {
    id: 'stash-create',
    label: 'Stash changes',
    description: 'Set aside local changes',
    icon: ArchiveIcon,
    group: 'stash',
  },
  {
    id: 'stash-apply',
    label: 'Apply stash',
    description: 'Restore a stash and keep it',
    icon: ArchiveRestoreIcon,
    group: 'stash',
  },
  {
    id: 'stash-pop',
    label: 'Pop stash',
    description: 'Restore, then remove a stash',
    icon: ArchiveRestoreIcon,
    group: 'stash',
  },
  {
    id: 'switch-branch',
    label: 'Switch branch',
    description: 'Check out another local branch',
    icon: GitBranchIcon,
    group: 'branch',
  },
  {
    id: 'create-branch',
    label: 'Create branch',
    description: 'Start a branch from the current commit',
    icon: GitBranchPlusIcon,
    group: 'branch',
  },
] as const satisfies readonly GitActionOption[];

export type GitActionGroup = {
  readonly id: GitActionGroupId;
  readonly label: string;
  readonly actions: readonly GitActionOption[];
};

/** Menu sections keep commit, remote sync and handoff actions distinct. */
export const gitActionGroups = [
  { id: 'commit', label: 'Commit', actions: [gitActions[0], gitActions[1]] },
  {
    id: 'sync',
    label: 'Sync',
    actions: [gitActions[2], gitActions[3], gitActions[4]],
  },
  {
    id: 'stash',
    label: 'Stash',
    actions: [gitActions[5], gitActions[7]],
  },
  {
    id: 'branch',
    label: 'Branch',
    actions: [gitActions[8], gitActions[9]],
  },
] as const satisfies readonly GitActionGroup[];

export function branchStatus(status: GitActionStatus): GitBranchStatus | null {
  return status.branch ?? null;
}

function hasConflicts(status: GitActionStatus) {
  return status.changes.some((change) => change.scope === 'unmerged');
}

/**
 * A hard blocker is only returned when the status gives us enough information
 * to know an action cannot run. Missing optional branch data leaves the action
 * selectable: the server validates the exact request before running it.
 */
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
      return status.headOid == null ? 'There is no commit to amend.' : null;
    case 'push':
      if (!branch) return null;
      if (branch.name == null)
        return 'Detached HEAD: check out a branch before pushing.';
      if (branch.behind > 0) return 'Pull the upstream changes before pushing.';
      return branch.ahead > 0 || branch.upstream == null
        ? null
        : 'No local commits to push.';
    case 'pull':
      if (status.changes.length)
        return 'Commit or stash local changes before pulling.';
      if (branch?.name === null)
        return 'Detached HEAD: check out a branch before pulling.';
      return null;
    case 'fetch':
      return null;
    case 'stash-create':
      return null;
    case 'stash-apply':
    case 'stash-pop':
      return branch?.stashes && branch.stashes.length === 0
        ? 'No stash is available.'
        : null;
    case 'switch-branch':
    case 'create-branch':
      return null;
    case 'discard':
      return null;
  }
}

/**
 * A non-blocking status note explains why an action may produce no change or
 * still needs explicit values. These notes are rendered below each menu row.
 */
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
      return branch == null
        ? 'Enter the configured remote and full branch ref.'
        : null;
    case 'pull':
    case 'fetch':
      return branch == null
        ? 'Enter the configured remote and full branch ref.'
        : null;
    case 'stash-create':
      return status.changes.length === 0
        ? 'Nothing changed; the server will report no change.'
        : null;
    case 'stash-apply':
    case 'stash-pop':
      return branch?.stashes == null ? 'Enter a full stash object ID.' : null;
    case 'switch-branch':
      return status.changes.length
        ? 'Uncommitted files come along unless Git refuses the switch.'
        : null;
    case 'create-branch':
      return 'Starts at the currently displayed commit.';
    case 'discard':
      return null;
  }
}

export type PrimaryGitAction =
  | { kind: 'commit'; label: string }
  | { kind: 'run'; action: 'push' | 'pull'; label: string }
  | { kind: 'hint'; label: string; hint: string };

/**
 * Pick the contextual half of the split control. Commit comes first; when
 * branch tracking selects pull or push when the worktree is clean.
 */
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
  if (branch == null)
    return {
      kind: 'hint',
      label: 'Commit',
      hint: 'Nothing to commit. Choose a Git action to continue.',
    };
  if (branch.name == null)
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
  return {
    kind: 'hint',
    label: 'Commit',
    hint: 'Nothing to commit, pull or push.',
  };
}
