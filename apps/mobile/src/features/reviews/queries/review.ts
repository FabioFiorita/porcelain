import {
  changeSelections,
  selectionKey,
  branchRange,
  branchFilePaths,
} from '@porcelain/client/changes/rules';
import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import { useDiffRecoveryToken } from '../store';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  changesQueryOptions,
  branchQueryOptions,
  fileDiffReadsQueryOptions,
  branchDiffReadsQueryOptions,
  changesRecoveryKey,
} from '@porcelain/client/changes';
import {
  publishedReviewQueryOptions,
  commentsQueryOptions,
  reviewFilesQueryOptions,
  untrackedFileDiffQueryOptions,
} from '@porcelain/client/reviews';
import type { WorktreeConnection } from '@porcelain/client/transport';
import type {
  ReadChangesResponse,
  ReadBranchChangesResponse,
} from '@porcelain/contracts/changes';

type Scope = { projectId: string; worktreeId: string };

export function useReview(
  scope: Scope,
  connection: WorktreeConnection,
  range: 'worktree' | 'branch',
) {
  const changes = useQuery(changesQueryOptions(scope, connection));
  const branch = useQuery({
    ...branchQueryOptions(scope, connection),
    enabled: range === 'branch',
  });
  const published = useQuery(publishedReviewQueryOptions(scope, connection));
  const files =
    range === 'branch'
      ? (branch.data?.files.map((file) => ({
          path: file.path,
          fingerprint: file.fingerprint,
          note: file.status,
        })) ?? [])
      : (changes.data?.changes.changes.map((file) => ({
          path: file.path,
          fingerprint: file.fingerprint,
          note: file.comparisons.map((item) => item.scope).join(', '),
        })) ?? []);
  const markQueries: ReturnType<typeof reviewFilesQueryOptions>[] =
    range === 'worktree'
      ? [
          reviewFilesQueryOptions(
            scope,
            connection,
            { kind: 'worktree' },
            files,
          ),
        ]
      : branch.data?.base
        ? [
            reviewFilesQueryOptions(
              scope,
              connection,
              {
                kind: 'branch',
                base: branch.data.base.ref,
                branch: branch.data.head.branch,
              },
              files,
            ),
          ]
        : [];
  const marks = useQueries({ queries: markQueries })[0];
  const marksUnavailable =
    range === 'branch' && branch.data !== undefined && !branch.data.base;
  return {
    files:
      marks?.data ??
      files.map((file) => ({
        ...file,
        reviewed: marksUnavailable
          ? undefined
          : marks?.error
            ? 'Reviewed marks unavailable'
            : 'Reading reviewed marks…',
      })),
    changes: changes.data?.changes,
    branch: branch.data,
    marksUnavailable,
    published: published.data?.active ? published.data : null,
    isPending: range === 'branch' ? branch.isPending : changes.isPending,
    error:
      (range === 'branch' ? branch.error : changes.error) ??
      marks?.error ??
      published.error,
    read: () => {
      void changes.refetch();
      void published.refetch();
      if (marks) void marks.refetch();
      if (range === 'branch') void branch.refetch();
    },
  };
}

export function useFileDiffs(
  scope: Scope,
  connection: WorktreeConnection,
  list: ReadChangesResponse | undefined,
  branch: ReadBranchChangesResponse | undefined,
  range: 'worktree' | 'branch',
  path: string,
  recover: (statusToken: string) => void,
) {
  const recoveringToken = useDiffRecoveryToken(
    changesRecoveryKey(scope, connection),
  );
  const recovering = Boolean(list && recoveringToken === list.statusToken);
  const files = list?.changes.filter((file) => file.path === path) ?? [];
  const selections = files.flatMap((file) =>
    file.comparisons.flatMap(changeSelections),
  );
  const branchFile = branch?.files.find((file) => file.path === path);
  const branchDiffs = useQueries({
    queries:
      range === 'branch' && branch
        ? branchDiffReadsQueryOptions(
            scope,
            connection,
            branchRange(branch),
            branchFile ? [branchFilePaths(branchFile)] : [],
            DIFFS_PER_REQUEST,
          )
        : [],
  });
  const changes = useQueries({
    queries:
      range === 'worktree' && list
        ? fileDiffReadsQueryOptions(scope, connection, list, path, recover)
        : [],
  });
  const isUntracked = Boolean(
    range === 'worktree' &&
    list?.changes
      .find((file) => file.path === path)
      ?.comparisons.some((comparison) => comparison.scope === 'untracked'),
  );
  const untracked = useQuery({
    ...untrackedFileDiffQueryOptions(scope, connection, path),
    enabled: isUntracked,
  });
  const untrackedData = isUntracked ? untracked.data : undefined;
  const content = new Map(
    changes.every((query) => query.data !== undefined)
      ? changes.flatMap((query) => query.data ?? [])
      : [],
  );
  return {
    diffs:
      range === 'branch'
        ? branchDiffs.flatMap(
            (query) =>
              query.data?.map(([, content]) => ({
                label: 'Branch',
                content,
              })) ?? [],
          )
        : [
            ...selections.flatMap((selection) => {
              const patch = content.get(selectionKey(selection));
              return patch ? [{ label: selection.scope, content: patch }] : [];
            }),
            ...(untrackedData?.kind === 'text'
              ? [{ label: 'untracked', content: untrackedData }]
              : []),
          ],
    isPending:
      recovering ||
      (range === 'branch'
        ? branchDiffs.some((query) => query.isPending)
        : changes.some((query) => query.isPending) ||
          (isUntracked && untracked.isPending)),
    error: recovering
      ? null
      : range === 'branch'
        ? branchDiffs.find((query) => query.error)?.error
        : (changes.find((query) => query.error)?.error ??
          (isUntracked ? untracked.error : null)),
    unavailable:
      untrackedData?.kind === 'unavailable' ? untrackedData.reason : undefined,
    read: () => {
      for (const query of [...changes, ...branchDiffs]) void query.refetch();
      if (isUntracked) void untracked.refetch();
    },
  };
}

export function useComments(scope: Scope, connection: WorktreeConnection) {
  const query = useQuery(commentsQueryOptions(scope, connection));
  return {
    threads: query.data ?? [],
    isPending: query.isPending,
    error: query.error,
    read: () => {
      void query.refetch();
    },
  };
}
