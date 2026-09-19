import { useMutation, useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { ApiError, type ReviewScope } from '../api/api';
import type {
  ActionInput,
  CommitGroupsRequest,
  CommitMessageRequest,
  Expectation,
  GitAction,
  Receipt,
} from '../contracts/git-actions';
import { createId } from '../lib/id';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import type { Operation } from './operation-store';
import { useWorkspaceContext } from './workspace-provider';

/**
 * One request per action: the confirm dialog stays in the app, the server checks
 * only what the action depends on (`expected`) and refuses with "changed since you
 * looked" otherwise. Network actions answer `running`; their progress and end arrive
 * on the live channel, and `run` resolves with the final receipt either way.
 */
export function useGitActions(scope: ReviewScope) {
  const { api, operations } = useWorkspaceContext();
  const all = useSyncExternalStore(operations.subscribe, operations.list);
  const mine = all.filter(
    (operation) => operation.worktreeId === scope.worktreeId,
  );

  const run = async (
    input: ActionInput,
    expected: Expectation,
  ): Promise<Receipt> => {
    const requestId = createId();
    operations.start({
      requestId,
      projectId: scope.projectId,
      worktreeId: scope.worktreeId,
      action: input.action,
      progress: [],
    });
    const finished = operations.wait(requestId);
    try {
      const receipt = await api.gitActions.run({
        ...scope,
        input: { requestId, input, expected },
      });
      if (receipt.state !== 'running') operations.finish(receipt);
      return await finished;
    } catch (error) {
      operations.remove(requestId);
      throw error;
    }
  };

  return {
    run,
    /** The newest operation of this worktree for an action, while it runs and after. */
    latest: (action: GitAction): Operation | undefined =>
      mine.filter((operation) => operation.action === action).at(-1),
    running: mine.filter((operation) => operation.receipt == null),
    forget: (requestId: string) => operations.remove(requestId),
  };
}

/**
 * The models the server's agent CLIs can run. Loading, empty (no CLI installed or
 * signed in) and failed are all states the settings and the commit dialog show.
 */
export function useCommitModels() {
  const { api, environmentId } = useWorkspaceContext();
  const query = useQuery({
    queryKey: queryKeys.commitModels(environmentId),
    queryFn: ({ signal }) => api.gitActions.commitModels({ signal }),
    // Installing or signing in to a CLI sends no notice, so Settings and the commit dialog ask again when they open.
    staleTime: 0,
  });
  return {
    models: query.data,
    isPending: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Branches for switch and create; Git refuses a branch another worktree has checked out. */
export function useBranches(scope: ReviewScope, enabled: boolean) {
  const { api, environmentId } = useWorkspaceContext();
  const query = useQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'branches'),
    queryFn: ({ signal }) => api.gitActions.branches({ ...scope, signal }),
    enabled,
  });
  return {
    branches: query.data,
    isPending: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Acknowledges an action interrupted by a server restart, so it is not shown again. */
export function useDismissInterrupted(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return asMutation(
    useMutation({
      mutationFn: (requestId: string) =>
        api.gitActions.dismissInterrupted({ ...scope, requestId }),
    }),
  );
}

/** The files a draft or grouping was asked about changed since the reviewer looked. */
export const isChangedSinceLooked = (error: unknown) =>
  error instanceof ApiError && error.code === 'CHANGED_SINCE_LOOKED';

/** Drafting can be cancelled: closing the dialog aborts `signal` and the server stops the model. */
type Cancellable<T> = T & { signal?: AbortSignal };

/** A commit message drafted from the diffs of exactly these files. */
export function useCommitMessage(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return asMutation(
    useMutation({
      mutationFn: ({ signal, ...input }: Cancellable<CommitMessageRequest>) =>
        api.gitActions.commitMessage({ ...scope, signal, input }),
    }),
  );
}

/** Every uncommitted file split into commits, in the order to make them. */
export function useCommitGroups(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return asMutation(
    useMutation({
      mutationFn: ({ signal, ...input }: Cancellable<CommitGroupsRequest>) =>
        api.gitActions.commitGroups({ ...scope, signal, input }),
    }),
  );
}
