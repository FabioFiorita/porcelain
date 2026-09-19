import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ReviewScope } from '../api/api';
import type {
  MarksResponse,
  MarkTarget,
  ReviewedMark,
} from '../contracts/marks';
import { markKey } from '../domain/review';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

/** Every mark of the worktree by `markKey`: layers in a review, files in plain Changes. */
export function useMarks(
  scope: ReviewScope,
): ReadonlyMap<string, ReviewedMark> {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'marks'),
    queryFn: ({ signal }) => api.marks.list({ ...scope, signal }),
    select: selectMarks,
  }).data;
}

const selectMarks = (
  response: MarksResponse,
): ReadonlyMap<string, ReviewedMark> =>
  new Map(response.marks.map((mark) => [markKey(mark.target), mark]));

export type SetMark = {
  target: MarkTarget;
  reviewed: boolean;
  fingerprint: string;
};

/**
 * Ticks or unticks layers and files in one request ("mark all" included). A database
 * write, no Git. Optimistic: the tick flips at once and rolls back if refused.
 */
export function useSetMarks(scope: ReviewScope) {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  const key = queryKeys.resource(environmentId, scope, 'marks');
  return asMutation(
    useMutation({
      mutationFn: (marks: SetMark[]) =>
        api.marks.set({ ...scope, input: { marks } }),
      onMutate: async (marks) => {
        await client.cancelQueries({ queryKey: key });
        const previous = client.getQueryData<MarksResponse>(key);
        if (previous != null) {
          const next = new Map(
            previous.marks.map((mark) => [markKey(mark.target), mark]),
          );
          for (const mark of marks) {
            if (mark.reviewed) {
              next.set(markKey(mark.target), {
                target: mark.target,
                fingerprint: mark.fingerprint,
                reviewedAt: new Date().toISOString(),
                stale: false,
              });
            } else next.delete(markKey(mark.target));
          }
          client.setQueryData<MarksResponse>(key, {
            ...previous,
            marks: [...next.values()],
          });
        }
        return { previous };
      },
      onError: (_error, _marks, context) => {
        if (context?.previous != null)
          client.setQueryData(key, context.previous);
      },
      onSuccess: (response) => client.setQueryData(key, response),
    }),
  );
}
