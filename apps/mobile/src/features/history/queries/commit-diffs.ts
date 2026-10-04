import { useQuery } from '@tanstack/react-query';
import { commitDiffsQueryOptions } from '@porcelain/client/changes';
import { commitFilePaths, type CommitFile } from '@porcelain/client/history';
import type { useHistory } from './history';

type HistoryWorkspace = Parameters<typeof useHistory>[0];

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
