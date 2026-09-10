import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  GitCommitHorizontalIcon,
} from 'lucide-react';
export const gitActions = [
  {
    id: 'fetch',
    label: 'Fetch',
    description: 'Update a remote-tracking branch',
    icon: ArrowDownIcon,
  },
  {
    id: 'push',
    label: 'Push',
    description: 'Send committed changes',
    icon: ArrowUpIcon,
  },
  {
    id: 'commit',
    label: 'Commit',
    description: 'Commit the existing index',
    icon: GitCommitHorizontalIcon,
  },
  {
    id: 'stash-create',
    label: 'Create stash',
    description: 'Set aside local changes',
    icon: ArchiveIcon,
  },
  {
    id: 'stash-apply',
    label: 'Apply stash',
    description: 'Restore a stash and keep it',
    icon: ArchiveIcon,
  },
  {
    id: 'stash-pop',
    label: 'Pop stash',
    description: 'Restore, then remove a stash',
    icon: ArchiveIcon,
  },
] as const;
