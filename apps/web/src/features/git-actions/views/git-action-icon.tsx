import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  GitCommitHorizontalIcon,
  HistoryIcon,
} from 'lucide-react';
import type { GitAction } from '@porcelain/client/git-actions/rules';

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
    default:
      return <GitCommitHorizontalIcon className={className} />;
  }
}
