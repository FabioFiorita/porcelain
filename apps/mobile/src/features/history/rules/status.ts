import type {
  ListCommitsResponse,
  ReadGitStatusResponse,
} from '@porcelain/contracts/changes';
import { historyHeading, refLabel } from '@porcelain/client/history/rules';

export function historyStatus(
  status: Pick<ReadGitStatusResponse, 'branch' | 'changes'>,
  snapshot: ListCommitsResponse['snapshot'] | null,
) {
  const branch = status.branch;
  const name = branch
    ? branch.name
      ? refLabel(branch.name)
      : 'Detached HEAD'
    : historyHeading(snapshot);
  const tracking = !branch
    ? 'Branch status unavailable'
    : !branch.name
      ? 'No branch checked out'
      : !branch.upstream
        ? 'No upstream'
        : `↑ ${branch.ahead} ahead · ↓ ${branch.behind} behind · against ${refLabel(branch.upstream)}`;
  const files = new Set(
    status.changes.map((change) =>
      'path' in change ? change.path : (change.newPath ?? change.oldPath),
    ),
  ).size;
  return {
    name,
    tracking,
    uncommitted:
      files === 0 ? undefined : `${files} ${files === 1 ? 'file' : 'files'}`,
  };
}
