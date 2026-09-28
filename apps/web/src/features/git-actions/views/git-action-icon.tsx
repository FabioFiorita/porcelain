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
import type { GitAction } from '../rules/git-action';

export function GitActionIcon({
  action,
  className,
}: {
  action: GitAction;
  className?: string | undefined;
}) {
  switch (action) {
    case 'amend':
      return <HistoryIcon className={className} />;
    case 'push':
      return <ArrowUpIcon className={className} />;
    case 'pull':
    case 'fetch':
      return <ArrowDownIcon className={className} />;
    case 'stash-create':
      return <ArchiveIcon className={className} />;
    case 'stash-apply':
    case 'stash-pop':
      return <ArchiveRestoreIcon className={className} />;
    case 'switch-branch':
      return <GitBranchIcon className={className} />;
    case 'create-branch':
      return <GitBranchPlusIcon className={className} />;
    default:
      return <GitCommitHorizontalIcon className={className} />;
  }
}
