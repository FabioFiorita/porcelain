import {
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, type ReviewScope } from '../api/api';
import type { GitChange, TextRangeRequest } from '../contracts/git-status';
import { changePath, diffSelection } from '../domain/review';
import { queryKeys } from './keys';
import { useWorkspaceContext } from './workspace-provider';

/** The list of changes, with fingerprints and branch tracking. About one Git process. */
export function useChanges(scope: ReviewScope) {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'changes'),
    queryFn: ({ signal }) => api.review.changes({ ...scope, signal }),
  }).data;
}

/** Look again: reloads the list of changes now, after a "changed since you looked" refusal. */
export function useRefreshChanges(scope: ReviewScope) {
  const { environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  return () =>
    client.refetchQueries({
      queryKey: queryKeys.resource(environmentId, scope, 'changes'),
    });
}

/**
 * The agent's review, or null. Read once when the worktree opens, then only when
 * the live channel says its revision (or the code under it) moved.
 */
export function useReview(scope: ReviewScope) {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'review'),
    queryFn: ({ signal }) => api.review.review({ ...scope, signal }),
  }).data;
}

/**
 * Whether the agent published a review, which is what makes the Changes surface a
 * review. Reads the same query as `useReview` without suspending: undefined while
 * loading or after a failure.
 */
export function useHasReview(scope: ReviewScope) {
  const { api, environmentId } = useWorkspaceContext();
  return useQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'review'),
    queryFn: ({ signal }) => api.review.review({ ...scope, signal }),
    select: (review) => review != null,
  }).data;
}

/**
 * One diff per changed file, keyed by the file's fingerprint so a new version of
 * the file never shows an old diff. Each is one Git call; nothing loads all diffs.
 */
export function useDiffs(scope: ReviewScope, changes: readonly GitChange[]) {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQueries({
    queries: changes.map((change) => {
      const selection = diffSelection(change);
      const path = changePath(change);
      return {
        queryKey: queryKeys.resource(
          environmentId,
          scope,
          'diff',
          path,
          change.fingerprint,
        ),
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          if (selection == null)
            throw new ApiError(
              'UNSUPPORTED_CHANGE',
              'This change cannot be shown as a diff.',
            );
          return api.review.diff({
            ...scope,
            signal,
            input: { change: selection, fingerprint: change.fingerprint },
          });
        },
      };
    }),
  }).map((result) => result.data);
}

/** A few lines at the last commit or on disk: a context step, or code around a hunk. */
export function useTextRanges(
  scope: ReviewScope,
  inputs: readonly TextRangeRequest[],
) {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQueries({
    queries: inputs.map((input) => ({
      queryKey: queryKeys.resource(
        environmentId,
        scope,
        'range',
        input.path,
        input.at,
        input.startLine,
        input.endLine,
      ),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.review.range({ ...scope, signal, input }),
    })),
  }).map((result) => result.data);
}

export const isHistoryRewritten = (error: unknown) =>
  error instanceof ApiError && error.code === 'HISTORY_REWRITTEN';

/**
 * The current branch's history, newest first. The next page is "commits before the
 * last one shown". If that commit left the branch (rebase, reset), the list restarts
 * from the top and `rewritten` says so for a moment.
 */
export function useHistory(scope: ReviewScope) {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  const queryKey = queryKeys.resource(environmentId, scope, 'history');
  const query = useSuspenseInfiniteQuery({
    queryKey,
    queryFn: ({ signal, pageParam }) =>
      api.review.history({ ...scope, signal, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.hasMore ? page.commits.at(-1)?.oid : undefined,
    select: (data) => {
      const last = data.pages[data.pages.length - 1];
      return {
        head: data.pages[0]?.head,
        commits: data.pages.flatMap((page) => page.commits),
        boundary: last?.boundary ?? null,
      };
    },
  });
  const rewritten =
    query.isFetchNextPageError && isHistoryRewritten(query.error);
  const [rewrittenAt, setRewrittenAt] = useState<number | null>(null);
  const { projectId, worktreeId } = scope;
  useEffect(() => {
    // An older page no longer exists: start again from the newest commit.
    if (!rewritten) return;
    void client
      .resetQueries({
        queryKey: queryKeys.resource(
          environmentId,
          { projectId, worktreeId },
          'history',
        ),
      })
      .then(() => setRewrittenAt(Date.now()));
  }, [rewritten, client, environmentId, projectId, worktreeId]);
  return {
    ...query.data,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError && !rewritten,
    rewritten,
    /** When the list last restarted because the branch was rewritten; the view shows a note for a while. */
    rewrittenAt,
    fetchNextPage: query.fetchNextPage,
  };
}

/** A commit's files against `parent` (1-based); the diffs are separate reads. */
export function useCommitFiles(scope: ReviewScope, oid: string, parent = 1) {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.resource(
      environmentId,
      scope,
      'commit-files',
      oid,
      parent,
    ),
    queryFn: ({ signal }) =>
      api.review.commitFiles({
        ...scope,
        signal,
        oid,
        parent: parent === 1 ? undefined : parent,
      }),
  }).data;
}

/** One commit file's diff: one Git call each. */
export function useCommitDiffs(
  scope: ReviewScope,
  oid: string,
  paths: readonly string[],
  parent = 1,
) {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQueries({
    queries: paths.map((path) => ({
      queryKey: queryKeys.resource(
        environmentId,
        scope,
        'commit-diff',
        oid,
        path,
        parent,
      ),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.review.commitDiff({
          ...scope,
          signal,
          oid,
          path,
          parent: parent === 1 ? undefined : parent,
        }),
    })),
  }).map((result) => result.data);
}

export function reviewErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong loading this. Try again.';
}
