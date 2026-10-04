import { useQuery } from '@tanstack/react-query';
import { commitDiffsQueryOptions } from '@porcelain/client/changes';
import { commitFilePaths, type CommitFile } from '@porcelain/client/history';
import type { ReadCommitDiffsResponse } from '@porcelain/contracts/changes';
import type { HistoryWorkspace } from './history';

export type CommitDiffContent =
  ReadCommitDiffsResponse['diffs'][number]['content'];

export function useCommitDiff(
  workspace: HistoryWorkspace,
  oid: string,
  parent: number,
  file: CommitFile,
) {
  const query = useQuery(
    commitDiffsQueryOptions(
      workspace.scope,
      workspace.connection,
      oid,
      parent,
      [commitFilePaths(file)],
    ),
  );
  return {
    content: query.data?.diffs[0]?.content,
    isPending: query.isPending,
    error: query.error,
    read: () => {
      void query.refetch();
    },
  };
}
