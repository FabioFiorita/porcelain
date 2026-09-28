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
import type { GitAction } from '@/features/git-actions/index';
export {
  branchStatus,
  gitActionBlocker,
  gitActionReason,
  primaryGitAction,
} from '@/features/git-actions/index';
export type { GitActionStatus } from '@/features/git-actions/index';

type GitActionGroupId = 'commit' | 'sync' | 'stash' | 'branch';

export type GitActionOption = {
  readonly id: GitAction;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly group: GitActionGroupId;
};

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
