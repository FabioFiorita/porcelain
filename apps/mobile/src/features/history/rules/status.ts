import type {
  ListCommitsResponse,
  ReadGitStatusResponse,
} from '@porcelain/contracts/changes';
import { branchTracking } from '@porcelain/client/history/rules';

export function historyStatus(
  status: Pick<ReadGitStatusResponse, 'branch' | 'changes'>,
  snapshot: ListCommitsResponse['snapshot'] | null,
) {
  const files = new Set(
    status.changes.map((change) =>
      'path' in change ? change.path : (change.newPath ?? change.oldPath),
    ),
  ).size;
  return {
    ...branchTracking(status.branch, snapshot),
    uncommitted:
      files === 0 ? undefined : `${files} ${files === 1 ? 'file' : 'files'}`,
  };
}
