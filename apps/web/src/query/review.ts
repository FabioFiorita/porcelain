import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { RequestError } from '@porcelain/client/errors/request-error';
import {
  useMutation,
  usePrefetchQuery,
  useQueries,
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ReviewPort, ReviewRequest } from '../api/review/port';
import type {
  Change,
  EvidenceResponse,
  ReviewEvidenceItem,
  ReviewedMarksResponse,
  ReviewScope,
  SetReviewedRequest,
  TextFile,
} from '../domain/review';
import {
  changePath,
  isFingerprintable,
  reviewMark,
  reviewStatus,
} from '../domain/review';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { enqueueReviewed } from './reviewed-queue';
import { useConnectedContext } from './workspace-provider';

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
) {
  return useSuspenseQuery({
    ...useReviewOptions(scope, key, read),
    refetchInterval,
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

/**
 * A published layer turns the Changes surface into a review. Keep the plain
 * Changes label while this shared query is loading or has failed.
 */
export function useHasReviewLayers(scope: ReviewScope) {
  return useQuery({
    ...useChangesOptions(scope),
    select: (data) => data.layers.layers.length > 0,
    throwOnError: false,
  }).data;
}

function useChangesOptions(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'changes',
    ]),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await api.review.changes({ ...scope, ...request });
      request.signal.throwIfAborted();
      if (
        data.status.environmentId !== connection.environmentId ||
        data.status.worktreeId !== scope.worktreeId ||
        data.layers.worktreeId !== scope.worktreeId
      )
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
        );
      return data;
    },
  };
}

export function useArtifacts(scope: ReviewScope) {
  return useReviewData(scope, ['artifacts'], (api, request) =>
    api.artifacts(request),
  );
}
export function useArtifactsOverview(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return (
    useQuery({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'artifacts',
      ]),
      queryFn: async ({ signal }) => {
        const request = connection.request(signal);
        const data = await api.review.artifacts({ ...scope, ...request });
        request.signal.throwIfAborted();
        return data;
      },
      throwOnError: false,
    }).data ?? []
  );
}

function useEvidenceOptions(scope: ReviewScope) {
  return useReviewOptions<EvidenceResponse>(
    scope,
    ['evidence'],
    (api, request) => api.evidence(request),
  );
}

function useReviewedOptions(scope: ReviewScope) {
  return useReviewOptions<ReviewedMarksResponse>(
    scope,
    ['reviewed'],
    (api, request) => api.reviewed.list(request),
  );
}

/** Suspense hooks start one read at a time; start them together instead. */
export function usePrefetchReview(scope: ReviewScope) {
  usePrefetchQuery(useChangesOptions(scope));
  usePrefetchQuery(useEvidenceOptions(scope));
  usePrefetchQuery(useReviewedOptions(scope));
}

/** Fetch only the content for the currently available artifact tabs. */
export function useArtifactContents(
  scope: ReviewScope,
  artifactIds: readonly string[],
) {
  const { api, connection } = useConnectedContext();
  return useSuspenseQueries({
    queries: artifactIds.map((artifactId) => ({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'artifact',
        artifactId,
      ]),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const request = connection.request(signal);
        const data = await api.review.artifact({
          ...scope,
          ...request,
          artifactId,
        });
        request.signal.throwIfAborted();
        return data;
      },
    })),
  }).map((result) => result.data);
}
export function reviewErrorMessage(error: unknown) {
  return error instanceof ConnectionError
    ? error.message
    : 'This review surface could not be loaded. Try again.';
}

export function isContentChangedError(error: unknown) {
  return error instanceof RequestError && error.code === 'CONTENT_CHANGED';
}

export function useReviewReset() {
  return useQueryErrorResetBoundary();
}
export function useTextFile(scope: ReviewScope, path: string, active: boolean) {
  return useReviewData<TextFile | { kind: 'unreadable'; reason: string }>(
    scope,
    ['text', path],
    async (api, request) => {
      try {
        return await api.text({ ...request, path });
      } catch (error) {
        if (error instanceof RequestError && error.status === 422) {
          if (error.code === 'UNSUPPORTED_TEXT')
            return {
              kind: 'unreadable',
              reason:
                'This file is binary or uses an unsupported text encoding.',
            };
          if (error.code === 'FILE_TOO_LARGE')
            return {
              kind: 'unreadable',
              reason: 'This file is too large to display as text.',
            };
        }
        throw error;
      }
    },
    active ? 3000 : false,
  );
}
export function useCommit(scope: ReviewScope, oid: string, parent = 1) {
  return useReviewData(scope, ['commit', oid, parent], (api, request) =>
    api.commit({ ...request, oid, ...(parent === 1 ? {} : { parent }) }),
  );
}

export function useReviewEvidence(
  scope: ReviewScope,
  changes?: readonly Change[],
): ReviewEvidenceItem[] {
  const [evidence, reviewed] = useSuspenseQueries({
    queries: [useEvidenceOptions(scope), useReviewedOptions(scope)],
  });
  return mergeReviewEvidence(evidence.data, reviewed.data, changes);
}

export function mergeReviewEvidence(
  evidence: EvidenceResponse,
  reviewed: ReviewedMarksResponse,
  changes?: readonly Change[],
): ReviewEvidenceItem[] {
  const selected =
    changes == null
      ? null
      : new Set(changes.map((change) => changePath(change)));
  return evidence.evidence.flatMap((entry) => {
    // Selection is by logical file path. Once a path is selected, retain every
    // comparison for it so staged and unstaged evidence cannot disappear from
    // the review surface or from the fingerprint being marked.
    if (selected && !selected.has(entry.path)) return [];
    const mark = reviewMark(entry, reviewed.marks);
    return [
      {
        ...entry,
        environmentId: evidence.environmentId,
        worktreeId: evidence.worktreeId,
        statusToken: evidence.statusToken,
        consistency: evidence.consistency,
        reviewStatus: reviewStatus(entry, reviewed.marks),
        ...(mark ? { mark } : {}),
      },
    ];
  });
}

function useReviewedContext(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    api: api.review.reviewed,
    key: queryKeys.reviewSurface(connection.environmentId, scope, ['reviewed']),
    connection,
    request: (signal?: AbortSignal) => ({
      ...scope,
      ...connection.request(signal),
    }),
  };
}

export type MarkReviewedInput = Pick<
  SetReviewedRequest,
  'path' | 'fingerprint'
>;

export function useMarkReviewed(scope: ReviewScope) {
  const context = useReviewedContext(scope);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (input: MarkReviewedInput) =>
        enqueueReviewed(context, client, input, async () => {
          const request = context.request();
          const result = await context.api.set({
            ...request,
            input: { ...input, reviewed: true },
          });
          request.signal.throwIfAborted();
          return result;
        }),
    }),
  );
}

export function useUnmarkReviewed(scope: ReviewScope) {
  const context = useReviewedContext(scope);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (path: string) =>
        enqueueReviewed(context, client, { path }, async () => {
          const request = context.request();
          const result = await context.api.remove({ ...request, path });
          request.signal.throwIfAborted();
          return result;
        }),
    }),
  );
}

export type BulkReviewReport = {
  marked: string[];
  skipped: Array<{
    path: string;
    reason: 'not-fingerprintable' | 'already-reviewed';
  }>;
  failed: Array<{ path: string; error: unknown }>;
};

export function useMarkAllReviewed(scope: ReviewScope) {
  const context = useReviewedContext(scope);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: async (
        entries: readonly ReviewEvidenceItem[],
      ): Promise<BulkReviewReport> => {
        const report: BulkReviewReport = {
          marked: [],
          skipped: [],
          failed: [],
        };
        const uniqueEntries = [
          ...new Map(entries.map((entry) => [entry.path, entry])).values(),
        ];
        for (const entry of uniqueEntries) {
          if (entry.reviewStatus === 'reviewed') {
            report.skipped.push({
              path: entry.path,
              reason: 'already-reviewed',
            });
            continue;
          }
          if (!isFingerprintable(entry)) {
            report.skipped.push({
              path: entry.path,
              reason: 'not-fingerprintable',
            });
            continue;
          }
          try {
            await enqueueReviewed(
              context,
              client,
              { path: entry.path, fingerprint: entry.fingerprint },
              async () => {
                const request = context.request();
                const result = await context.api.set({
                  ...request,
                  input: {
                    path: entry.path,
                    reviewed: true,
                    fingerprint: entry.fingerprint,
                  },
                });
                request.signal.throwIfAborted();
                return result;
              },
            );
            report.marked.push(entry.path);
          } catch (error) {
            // The connection controller represents user cancellation. A
            // request-local timeout should be reported for this path and let
            // the remaining paths continue, preserving earlier snapshots.
            if (context.connection.controller.signal.aborted) throw error;
            report.failed.push({ path: entry.path, error });
          }
        }
        return report;
      },
    }),
  );
}

export function useFileTree(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'file-tree',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await api.review.fileTree({ ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
    retry: false,
    throwOnError: false,
  });
}

export function useCommitLayers(scope: ReviewScope, oid: string) {
  return useReviewData(scope, ['commit-layers', oid], (api, request) =>
    api.commitLayers({ ...request, oid }),
  );
}
