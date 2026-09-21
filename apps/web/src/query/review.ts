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
import { useEffect, useRef } from 'react';
import type { ReviewPort, ReviewRequest } from '../api/review/port';
import type {
  ChangeList,
  ChangeSelection,
  DiffContent,
  ExpectedFile,
  ReviewChangeItem,
  ReviewedMarksResponse,
  ReviewScope,
  SetReviewedRequest,
  TextFile,
} from '../domain/review';
import { isFingerprintable, reviewMark, reviewStatus } from '../domain/review';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { usePublishedReview } from './published-review';
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
  /** For a read whose answer cannot change: a commit, keyed by its id. */
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

/** Read the current changes for an explicit recovery action, even after its view unmounted. */
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

/**
 * A published layer turns the Changes surface into a review. Keep the plain
 * Changes label while this shared query is loading or has failed.
 */
export function useHasReviewLayers(scope: ReviewScope) {
  return usePublishedReview(scope).data?.active ?? false;
}

function useChangesOptions(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'changes',
    ]),
    // Returning to the window is the natural refresh boundary for everything
    // else, but not here: the list is what a diff and a mark are checked
    // against, so re-reading it under a reader who has not moved would throw
    // away the hunks on screen and the fingerprint they are about to mark.
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

/** Suspense hooks start one read at a time; start them together instead. */
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
  return error instanceof RequestError && error.code === 'CONTENT_CHANGED';
}

export function useReviewReset() {
  return useQueryErrorResetBoundary();
}
type ReadFile = TextFile | { kind: 'unreadable'; reason: string };

/**
 * One read of a file's text, whoever asks. A file the reader has open and an
 * untracked file in the review are the same bytes under the same key, so they
 * share one request and one answer rather than racing two shapes into it.
 */
function readFile(api: ReviewPort, request: ReviewRequest, path: string) {
  return async (): Promise<ReadFile> => {
    try {
      return await api.text({ ...request, path });
    } catch (error) {
      if (error instanceof RequestError && error.status === 422) {
        if (error.code === 'UNSUPPORTED_TEXT')
          return {
            kind: 'unreadable',
            reason: 'This file is binary or uses an unsupported text encoding.',
          };
        if (error.code === 'FILE_TOO_LARGE')
          return {
            kind: 'unreadable',
            reason: 'This file is too large to display as text.',
          };
      }
      throw error;
    }
  };
}

/** The same options wherever a file's text is wanted, so one key, one shape. */
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
/**
 * A commit's files. Read once: a commit is immutable and its id is in the key,
 * so coming back to the window has nothing to find out.
 */
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

/** One request carries at most this many files, as the contract allows. */
const COMMIT_DIFF_BATCH = 200;

/**
 * The patches of the commit's files that are on screen.
 *
 * A commit cannot change, so these need none of the guards a worktree diff
 * carries: the commit id is the whole of what makes the answer correct, and it
 * is in the key. Longer lists are split into batches so a commit touching
 * thousands of files does not ask for thousands of patches at once.
 */
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
    // A patch that failed is not a patch still arriving. Without this the
    // files it covers stay labelled as loading for as long as the commit is
    // open, with nothing to press.
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
    // Selection is by logical file path. Once a path is selected, retain every
    // comparison for it so a staged and an unstaged change to the same file
    // cannot disappear from the surface or from the fingerprint being marked.
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

/**
 * The hunks of the documents on screen, read only once they are on screen.
 *
 * The fingerprints the list was read at go with the request and are part of
 * the key. The observation token alone would not do: it hashes what Git's
 * status prints, which says nothing about the bytes of a file that was
 * already modified, so editing such a file again leaves the token identical
 * while the hunks change. Sending the fingerprints means the server refuses
 * rather than pairing current hunks with an older fingerprint — the one the
 * reader would then click to mark.
 *
 * The caller gets the query's own state because a document that is still
 * loading its diff, or failed to, has to say so rather than render as empty.
 */
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
    // Read once for the observation they belong to; a new list is a new key.
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
  // The worktree moved between reading the list and asking for its hunks. The
  // refusal is the signal to read the list again, not something to hand the
  // reader: a new list carries a new token, which is a new query. Recovered
  // once per token, so a mismatch that is not a passing edit still surfaces.
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
  return error instanceof RequestError && error.code === 'WORKTREE_CHANGED';
}

/**
 * The status an action needs: the change list plus the remote name, source ref
 * and stashes. Those cost two more Git processes and only an action uses them,
 * so this is read when the action panel opens, not when a worktree does.
 */
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

export function useGitStatus(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  const query = useQuery({
    ...gitStatusQuery(scope, api, connection),
    throwOnError: false,
  });
  return { status: query.data, pending: query.isPending };
}

/**
 * The bytes of the new files on screen. An untracked file has no diff — the
 * file is the change — so it is read as a file, which costs no Git process.
 */
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

function useReviewedContext(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    api: api.review.reviewed,
    key: queryKeys.reviewSurface(connection.environmentId, scope, ['reviewed']),
    inventoryKey: queryKeys.inventory(connection.environmentId),
    changesKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'changes',
    ]),
    scope,
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
        entries: readonly ReviewChangeItem[],
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

/**
 * Every name quick open can offer. It is read per opening rather than held:
 * nothing can tell a cache it went stale until step 6's watcher, and a stale
 * name list quietly stops finding files that are there.
 */
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
