import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { RequestError } from '@porcelain/client/errors/request-error';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ReviewPort, ReviewRequest } from '../api/review/port';
import type {
  ArtifactContent,
  Change,
  DiffRequest,
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
import { useConnectedContext } from './workspace-provider';

function useReviewData<T>(
  scope: ReviewScope,
  key: readonly unknown[],
  read: (api: ReviewPort, request: ReviewRequest) => Promise<T>,
) {
  const { api, connection } = useConnectedContext();
  return useSuspenseQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, key),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await read(api.review, { ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
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

export function useEvidence(scope: ReviewScope) {
  return useReviewData<EvidenceResponse>(scope, ['evidence'], (api, request) =>
    api.evidence(request),
  );
}

export function useReviewed(scope: ReviewScope) {
  return useReviewData<ReviewedMarksResponse>(
    scope,
    ['reviewed'],
    (api, request) => api.reviewed.list(request),
  );
}
export function useArtifact(scope: ReviewScope, artifactId: string) {
  return useReviewData<ArtifactContent>(
    scope,
    ['artifact', artifactId],
    (api, request) => api.artifact({ ...request, artifactId }),
  );
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

export function useReviewReset() {
  return useQueryErrorResetBoundary();
}
export function useTextFile(scope: ReviewScope, path: string) {
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
  );
}
export function useCommit(scope: ReviewScope, oid: string, parent = 1) {
  return useReviewData(scope, ['commit', oid, parent], (api, request) =>
    api.commit({ ...request, oid, ...(parent === 1 ? {} : { parent }) }),
  );
}
export function useDiff(scope: ReviewScope, input: DiffRequest) {
  return useReviewData(scope, ['diff', input], (api, request) =>
    api.diff({ ...request, input }),
  );
}

export function useReviewEvidence(
  scope: ReviewScope,
  changes?: readonly Change[],
): ReviewEvidenceItem[] {
  const evidence = useEvidence(scope);
  const reviewed = useReviewed(scope);
  return mergeReviewEvidence(evidence, reviewed, changes);
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

type ReviewedQueue = { tail: Promise<void> };
const reviewedQueues = new WeakMap<object, Map<string, ReviewedQueue>>();

/**
 * Reviewed mutations share a queue for one connection and query key. The API
 * returns full snapshots, so serializing intent is what makes a delayed mark
 * unable to overwrite a later unmark (and keeps bulk and single-file actions
 * consistent).
 */
function enqueueReviewed<T>(
  context: ReturnType<typeof useReviewedContext>,
  operation: () => Promise<T>,
) {
  const queryHash = JSON.stringify(context.key) ?? '';
  let queues = reviewedQueues.get(context.connection);
  if (!queues) {
    queues = new Map();
    reviewedQueues.set(context.connection, queues);
  }
  let queue = queues.get(queryHash);
  if (!queue) {
    queue = { tail: Promise.resolve() };
    queues.set(queryHash, queue);
  }

  const result = queue.tail.then(operation, operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  queue.tail = tail;
  void tail.then(() => {
    if (queue?.tail === tail) queues?.delete(queryHash);
  });
  return result;
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
        enqueueReviewed(context, async () => {
          const request = context.request();
          const result = await context.api.set({
            ...request,
            input: { ...input, reviewed: true },
          });
          request.signal.throwIfAborted();
          await client.cancelQueries({ queryKey: context.key });
          client.setQueryData(context.key, result);
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
        enqueueReviewed(context, async () => {
          const request = context.request();
          const result = await context.api.remove({ ...request, path });
          request.signal.throwIfAborted();
          await client.cancelQueries({ queryKey: context.key });
          client.setQueryData(context.key, result);
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
            await enqueueReviewed(context, async () => {
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
              await client.cancelQueries({ queryKey: context.key });
              // Every response is an authoritative server snapshot. The
              // shared queue keeps newer mutation intent ahead of delayed
              // responses from older operations.
              client.setQueryData(context.key, result);
              return result;
            });
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
