import type { LucideIcon } from 'lucide-react';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  GitCommitHorizontalIcon,
} from 'lucide-react';
import type { GitAction } from '../../domain/git-action';
import type { Status } from '../../domain/review';

/** The branch details newer review status responses may expose. */
export type GitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  stashes?: readonly { oid: string; message: string }[];
};

/**
 * The server contract currently omits branch tracking. Keeping this optional
 * lets the control take advantage of it when a compatible status is supplied,
 * without widening or changing the shared response schema.
 */
export type GitActionStatus = Status & {
  branch?: GitBranchStatus | null;
};

export type GitActionGroupId = 'commit' | 'sync' | 'stash';

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
    label: 'Commit',
    description: 'Commit the existing index',
    icon: GitCommitHorizontalIcon,
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
    id: 'fetch',
    label: 'Fetch',
    description: 'Update a remote-tracking branch',
    icon: ArrowDownIcon,
    group: 'sync',
  },
  {
    id: 'stash-create',
    label: 'Create stash',
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
] as const satisfies readonly GitActionOption[];

export type GitActionGroup = {
  readonly id: GitActionGroupId;
  readonly label: string;
  readonly actions: readonly GitActionOption[];
};

/** Menu sections keep commit, remote sync and handoff actions distinct. */
export const gitActionGroups = [
  { id: 'commit', label: 'Commit', actions: [gitActions[0]] },
  {
    id: 'sync',
    label: 'Sync',
    actions: [gitActions[1], gitActions[2]],
  },
  {
    id: 'stash',
    label: 'Stash',
    actions: [gitActions[3], gitActions[4], gitActions[5]],
  },
] as const satisfies readonly GitActionGroup[];

export function branchStatus(status: GitActionStatus): GitBranchStatus | null {
  return status.branch ?? null;
}

function hasStagedChanges(status: GitActionStatus) {
  return status.changes.some((change) => change.scope === 'staged');
}

function hasConflicts(status: GitActionStatus) {
  return status.changes.some((change) => change.scope === 'unmerged');
}

/**
 * A hard blocker is only returned when the status gives us enough information
 * to know an action cannot run. Missing optional branch data leaves the action
 * selectable: the existing preparation request remains the source of truth.
 */
export function gitActionBlocker(
  action: GitAction,
  status: GitActionStatus,
): string | null {
  const branch = branchStatus(status);
  switch (action) {
    case 'commit':
      return hasConflicts(status)
        ? 'Resolve the conflicts before committing.'
        : null;
    case 'push':
      if (!branch) return null;
      if (branch.name == null)
        return 'Detached HEAD: check out a branch before pushing.';
      if (branch.behind > 0)
        return 'The branch is behind upstream. Pull is not available in this API.';
      return branch.ahead > 0 || branch.upstream == null
        ? null
        : 'No local commits to push.';
    case 'fetch':
      return null;
    case 'stash-create':
      return null;
    case 'stash-apply':
    case 'stash-pop':
      return branch?.stashes && branch.stashes.length === 0
        ? 'No stash is available.'
        : null;
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
  switch (action) {
    case 'commit':
      return hasStagedChanges(status)
        ? null
        : 'Nothing staged; the server will report no change.';
    case 'push':
      return branch == null
        ? 'Enter the configured remote and full branch ref.'
        : null;
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
  }
}

export type PrimaryGitAction =
  | { kind: 'commit'; label: string }
  | { kind: 'run'; action: 'push'; label: string }
  | { kind: 'hint'; label: string; hint: string };

/**
 * Pick the contextual half of the split control. Commit comes first; when
 * branch tracking is available, an ahead branch can be pushed. Pull is
 * intentionally absent because the current API has no pull action.
 */
export function primaryGitAction(status: GitActionStatus): PrimaryGitAction {
  if (status.changes.length > 0) return { kind: 'commit', label: 'Commit' };

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
      kind: 'hint',
      label: 'Commit',
      hint: 'The branch is behind upstream. Pull is not available in this API.',
    };
  if (branch.ahead > 0) return { kind: 'run', action: 'push', label: 'Push' };
  return {
    kind: 'hint',
    label: 'Commit',
    hint: 'Nothing to commit, pull or push.',
  };
}
