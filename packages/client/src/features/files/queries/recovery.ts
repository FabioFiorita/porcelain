import type { QueryFunctionContext } from '@tanstack/query-core';
import type {
  listDirectoryEndpoint,
  listWorktreePathsEndpoint,
  readTextFileEndpoint,
} from '@porcelain/contracts/files';
import { isEndpointError } from '../../../shared/api/request.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { inventoryQueryOptions } from '../../projects/queries/inventory.ts';

type ReadContext = Pick<QueryFunctionContext, 'signal' | 'client'>;

export function recoverFileReadQueryOptions<Result>(input: {
  queryKey: readonly unknown[];
  queryFn: (context: ReadContext) => Promise<Result>;
  endpoint:
    | typeof listDirectoryEndpoint
    | typeof listWorktreePathsEndpoint
    | typeof readTextFileEndpoint;
  scope: WorktreeScope;
  connection: WorktreeConnection;
  refresh?: (context: ReadContext) => Promise<unknown>;
}) {
  return {
    queryKey: input.queryKey,
    retry: false as const,
    queryFn: async (context: ReadContext) => {
      try {
        return await input.queryFn(context);
      } catch (error) {
        const signal = input.connection.request(context.signal).signal;
        assertCurrentAnswer(signal);
        if (!isEndpointError(error, input.endpoint, 'worktree_changed'))
          throw error;
        const inventory = inventoryQueryOptions(input.connection);
        const current = await context.client.query({
          ...inventory,
          retry: false,
          staleTime: 0,
        });
        assertCurrentAnswer(signal);
        const project = current.projects.find(
          (candidate) => candidate.id === input.scope.projectId,
        );
        const worktree = project?.worktrees.find(
          (candidate) => candidate.id === input.scope.worktreeId,
        );
        if (!project?.available || !worktree?.available) throw error;
        await input.refresh?.({ ...context, signal });
        assertCurrentAnswer(signal);
        return input.queryFn({ ...context, signal });
      }
    },
  };
}
