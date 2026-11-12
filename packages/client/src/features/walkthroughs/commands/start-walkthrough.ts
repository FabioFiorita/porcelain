import type { ListPullRequestsResponse } from '@porcelain/contracts/projects';
import {
  walkthroughStartRequest,
  walkthroughStartFailure,
} from '../rules/walkthrough.ts';
import { Cause, Effect, Option, type Exit } from 'effect';
import { AsyncResult, Atom, Reactivity } from 'effect/reactivity';
import type { StartWalkthroughRequest } from '@porcelain/contracts/walkthroughs';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

export const startWalkthrough = Atom.family((selection: WorktreeSelection) =>
  clientRuntime(selection.connection).fn(
    Effect.fn('Walkthroughs.start')(function* (
      payload: StartWalkthroughRequest,
    ) {
      const run = yield* requestApi(selection.connection, (api) =>
        api.walkthroughs.startWalkthrough({
          params: { worktreeId: selection.scope.worktreeId },
          payload,
        }),
      );
      yield* Reactivity.invalidate([
        queryKeys.reviewSurface(
          selection.connection.environmentId,
          selection.scope,
          ['walkthrough'],
        ),
      ]);
      return run;
    }),
  ),
);

export function walkthroughStartBinding<
  A extends { readonly branch?: string | undefined } | undefined,
  E,
  PE,
>(
  [result, send]: readonly [
    AsyncResult.AsyncResult<A, E>,
    (request: StartWalkthroughRequest) => Promise<Exit.Exit<A, E>>,
  ],
  input: Omit<Parameters<typeof walkthroughStartRequest>[0], 'pullRequests'> & {
    pulls: AsyncResult.AsyncResult<ListPullRequestsResponse, PE>;
  },
) {
  const available = Option.getOrUndefined(AsyncResult.value(input.pulls));
  const request = walkthroughStartRequest({
    ...input,
    pullRequests:
      available?.kind === 'available' ? available.pullRequests : undefined,
  });
  const accepted = Option.getOrUndefined(AsyncResult.value(result));
  return {
    accepted: accepted?.branch === input.branch ? accepted : undefined,
    waiting: AsyncResult.isWaiting(result),
    failure: AsyncResult.isFailure(result)
      ? walkthroughStartFailure(Cause.squash(result.cause))
      : undefined,
    start: () => void send(request),
  };
}
