import { ConnectionError } from '@/shared/api/connection-error';
import { RequestError } from '@/shared/api/request';
import {
  usePrefetchQuery,
  useQueries,
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type {
  ReviewPort,
  ReviewRequest,
} from '@/features/review/api/review-port';
import type {
  ChangeList,
  ChangeSelection,
  DiffContent,
  ExpectedFile,
  ReviewChangeItem,
  ReviewedMarksResponse,
  ReviewScope,
  TextFile,
} from '@/features/review/model/review';
import { reviewMark, reviewStatus } from '@/features/review/model/review';
import { queryKeys } from '@/shared/query/keys';
import { usePublishedReview } from '@/features/review/queries/published-review';
import { useConnectedContext } from '@/app/workspace-provider';

function useReviewOptions<T>(
  scope: ReviewScope,
  key: readonly unknown[],
  read: (api: ReviewPort, request: ReviewRequest) => Promise<T>,
) {
  const { api, connection } = useConnectedContext();
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, key),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await read(api.review, { ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
  };
}
function useReviewData<T>(
  scope: ReviewScope,
  key: readonly unknown[],
  read: (api: ReviewPort, request: ReviewRequest) => Promise<T>,
  refetchInterval: number | false = false,
  onFocus: 'always' | false = false,
) {
  return useSuspenseQuery({
    ...useReviewOptions(scope, key, read),
    refetchInterval,
    refetchOnWindowFocus: onFocus,
    refetchOnReconnect: onFocus,
  }).data;
}
export function useDirectory(scope: ReviewScope, path: string) {
  return useReviewData(scope, ['directory', path], (api, request) =>
    api.directory({ ...request, path }),
  );
}
export function useDirectories(scope: ReviewScope, paths: readonly string[]) {
  const { api, connection } = useConnectedContext();
  return useQueries({
    queries: paths.map((path) => ({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'directory',
        path,
      ]),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const request = connection.request(signal);
        const data = await api.review.directory({ ...scope, ...request, path });
        request.signal.throwIfAborted();
        return data;
      },
    })),
  });
}
export function useChanges(scope: ReviewScope) {
  return useSuspenseQuery(useChangesOptions(scope)).data;
}

export function useReviewOverview(scope: ReviewScope) {
  return useQuery({ ...useChangesOptions(scope), throwOnError: false }).data;
}

export function useReadCurrentChanges(scope: ReviewScope) {
  const client = useQueryClient();
  const options = useChangesOptions(scope);
  return async () =>
    (await client.fetchQuery({ ...options, staleTime: 0 })).changes;
}

export function useRefreshGitLook(scope: ReviewScope) {
  const readChanges = useReadCurrentChanges(scope);
  const client = useQueryClient();
  const { connection } = useConnectedContext();
  return async () => {
    const changes = await readChanges();
    await client.invalidateQueries({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'git-status',
      ]),
      exact: true,
    });
    return changes;
  };
}

export function useHasReviewLayers(scope: ReviewScope) {
  return usePublishedReview(scope).data?.active ?? false;
}

function useChangesOptions(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'changes',
    ]),
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: false as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await api.review.changes({ ...scope, ...request });
      request.signal.throwIfAborted();
      if (
        data.changes.environmentId !== connection.environmentId ||
        data.changes.worktreeId !== scope.worktreeId
      )
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
        );
      return data;
    },
  };
}

function useReviewedOptions(scope: ReviewScope) {
  return useReviewOptions<ReviewedMarksResponse>(
    scope,
    ['reviewed'],
    (api, request) => api.reviewed.list(request),
  );
}

export function usePrefetchReview(scope: ReviewScope) {
  usePrefetchQuery(useChangesOptions(scope));
  usePrefetchQuery(useReviewedOptions(scope));
}

export function reviewErrorMessage(error: unknown) {
  return error instanceof ConnectionError
    ? error.message
    : 'This review surface could not be loaded. Try again.';
}

export function isContentChangedError(error: unknown) {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.code === 'content_changed'
  );
}

export function useReviewReset() {
  return useQueryErrorResetBoundary();
}
type ReadFile = TextFile | { kind: 'unreadable'; reason: string };

function readFile(api: ReviewPort, request: ReviewRequest, path: string) {
  return async (): Promise<ReadFile> => {
    try {
      return await api.text({ ...request, path });
    } catch (error) {
      if (error instanceof RequestError && error.status === 422) {
        if (error.code === 'unsupported_text')
          return {
            kind: 'unreadable',
            reason: 'This file is binary or uses an unsupported text encoding.',
          };
        if (error.code === 'file_too_large')
          return {
            kind: 'unreadable',
            reason: 'This file is too large to display as text.',
          };
      }
      throw error;
    }
  };
}

function textFileOptions(
  { api, connection }: ReturnType<typeof useConnectedContext>,
  scope: ReviewScope,
  path: string,
) {
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'text',
      path,
    ]),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await readFile(api.review, { ...scope, ...request }, path)();
      request.signal.throwIfAborted();
      return data;
    },
  };
}

export function useTextFile(
  scope: ReviewScope,
  path: string,
  _active: boolean,
) {
  const context = useConnectedContext();
  return useSuspenseQuery({
    ...textFileOptions(context, scope, path),
    refetchInterval: false,
  }).data;
}
export function useCommit(scope: ReviewScope, oid: string, parent = 1) {
  return useReviewData(
    scope,
    ['commit', oid, parent],
    (api, request) =>
      api.commit({ ...request, oid, ...(parent === 1 ? {} : { parent }) }),
    false,
    false,
  );
}

const COMMIT_DIFF_BATCH = 200;

export function useCommitDiffs(
  scope: ReviewScope,
  oid: string,
  parent: number,
  paths: readonly (readonly string[])[],
) {
  const { api, connection } = useConnectedContext();
  const batches: (readonly string[])[][] = [];
  for (let at = 0; at < paths.length; at += COMMIT_DIFF_BATCH)
    batches.push([...paths.slice(at, at + COMMIT_DIFF_BATCH)]);
  const results = useQueries({
    queries: batches.map((batch) => ({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'commit-diffs',
        oid,
        parent,
        batch.map((entry) => entry.join('\0')),
      ]),
      refetchOnWindowFocus: false as const,
      refetchOnReconnect: false as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const request = connection.request(signal);
        const data = await api.review.commitDiffs({
          ...scope,
          ...request,
          oid,
          ...(parent === 1 ? {} : { parent }),
          paths: batch.map((entry) => [...entry]),
        });
        request.signal.throwIfAborted();
        return data.diffs;
      },
    })),
  });
  const patches = new Map<string, DiffContent>();
  for (const result of results)
    for (const diff of result.data ?? [])
      patches.set(diff.paths.join('\0'), diff.content);
  return {
    patches,
    isPending: results.some((result) => result.isPending),
    isError: results.some((result) => result.isError),
    retry: () => {
      for (const result of results) if (result.isError) void result.refetch();
    },
  };
}

export function useReviewChanges(
  scope: ReviewScope,
  paths?: readonly string[],
): ReviewChangeItem[] {
  const [list, reviewed] = useSuspenseQueries({
    queries: [useChangesOptions(scope), useReviewedOptions(scope)],
  });
  return mergeReviewChanges(list.data.changes, reviewed.data, paths);
}

export function mergeReviewChanges(
  list: ChangeList,
  reviewed: ReviewedMarksResponse,
  paths?: readonly string[],
): ReviewChangeItem[] {
  const selected = paths == null ? null : new Set(paths);
  return list.changes.flatMap((entry) => {
    if (selected && !selected.has(entry.path)) return [];
    const mark = reviewMark(entry, reviewed.marks);
    return [
      {
        ...entry,
        environmentId: list.environmentId,
        worktreeId: list.worktreeId,
        statusToken: list.statusToken,
        reviewStatus: reviewStatus(entry, reviewed.marks),
        ...(mark ? { mark } : {}),
      },
    ];
  });
}

export function useChangeDiffs(
  scope: ReviewScope,
  statusToken: string,
  expectedFiles: readonly ExpectedFile[],
  selections: readonly ChangeSelection[],
) {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const changesKey = queryKeys.reviewSurface(connection.environmentId, scope, [
    'changes',
  ]);
  const wanted = [...selections].sort((left, right) =>
    selectionKey(left).localeCompare(selectionKey(right)),
  );
  const query = useQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'change-diffs',
      statusToken,
      [...expectedFiles]
        .map((file) => `${file.path}:${file.fingerprint ?? ''}`)
        .sort(),
      wanted.map(selectionKey),
    ]),
    enabled: wanted.length > 0,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: false as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await api.review.diffs({
        ...scope,
        ...request,
        input: {
          expectedStatusToken: statusToken,
          expectedFiles: [...expectedFiles].sort((left, right) =>
            left.path.localeCompare(right.path),
          ),
          selections: wanted,
        },
      });
      request.signal.throwIfAborted();
      return new Map(
        data.diffs.map(({ selection, content }) => [
          selectionKey(selection),
          content,
        ]),
      );
    },
    throwOnError: false,
  });
  const moved = query.isError && isWorktreeChangedError(query.error);
  const recovered = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!moved || recovered.current === statusToken) return;
    recovered.current = statusToken;
    void client.invalidateQueries({ queryKey: changesKey });
  }, [moved, statusToken, client, changesKey]);
  const recovering = moved && recovered.current !== statusToken;
  return {
    diffs: query.data ?? new Map<string, DiffContent>(),
    pending: (wanted.length > 0 && query.isPending) || recovering,
    failed: query.isError && !recovering,
    retry: () => void query.refetch(),
  };
}

function isWorktreeChangedError(error: unknown) {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.code === 'worktree_changed'
  );
}

export function gitStatusQuery(
  scope: ReviewScope,
  api: ReturnType<typeof useConnectedContext>['api'],
  connection: ReturnType<typeof useConnectedContext>['connection'],
) {
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'git-status',
    ]),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await api.review.status({ ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
  };
}

export function useGitStatus(scope: ReviewScope, enabled = true) {
  const { api, connection } = useConnectedContext();
  const query = useQuery({
    ...gitStatusQuery(scope, api, connection),
    enabled,
    throwOnError: false,
  });
  return {
    status: query.data,
    pending: enabled && query.isPending,
    read: async () => (await query.refetch()).data,
  };
}

export function useUntrackedContents(
  scope: ReviewScope,
  paths: readonly string[],
) {
  const context = useConnectedContext();
  const queries = useQueries({
    queries: paths.map((path) => ({
      ...textFileOptions(context, scope, path),
      throwOnError: false,
    })),
  });
  return {
    contents: new Map(
      paths.flatMap((path, index) => {
        const data = queries[index]?.data;
        return data === undefined || !('text' in data)
          ? []
          : [[path, data.text] as const];
      }),
    ),
    pending: queries.some((query) => query.isPending),
    failed: queries.some((query) => query.isError),
    retry: () => {
      for (const query of queries) void query.refetch();
    },
  };
}

export function selectionKey(selection: ChangeSelection) {
  return `${selection.scope}\n${selection.oldPath}\n${selection.newPath}`;
}

export function useWorktreePaths(scope: ReviewScope, enabled = true) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    enabled,
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'paths',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await api.review.worktreePaths({ ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
    retry: false,
    throwOnError: false,
  });
}
