import { Clock, Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type {
  ArchivePullRequestRequest,
  MergePullRequestRequest,
  RerunPullChecksRequest,
  CommentOnPullRequestRequest,
} from '@porcelain/contracts/projects';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { requestedReruns } from '../store/pull-request-reruns.ts';
import type { RequestedRerun } from '../rules/pull-request-checks.ts';
const rereadPullRequests = (input: {
  connection: RuntimeConnection;
  projectId: string;
}) =>
  Reactivity.invalidate([
    queryKeys.projectPullRequests(
      input.connection.environmentId,
      input.projectId,
    ),
  ]);

export const archivePullRequest = Atom.family(
  (input: {
    connection: RuntimeConnection;
    projectId: string;
    number: number;
  }) =>
    clientRuntime(input.connection).fn(
      Effect.fn('Projects.archivePullRequest')(function* (
        payload: ArchivePullRequestRequest,
      ) {
        const answer = yield* requestApi(input.connection, (api) =>
          api.pullRequests.archivePullRequest({
            params: { projectId: input.projectId, number: input.number },
            payload,
          }),
        );
        yield* Reactivity.invalidate([
          queryKeys.inventory(input.connection.environmentId),
          queryKeys.projectPullRequests(
            input.connection.environmentId,
            input.projectId,
          ),
        ]);
        return answer;
      }),
    ),
);

export const mergePullRequest = Atom.family(
  (input: {
    connection: RuntimeConnection;
    projectId: string;
    number: number;
  }) =>
    clientRuntime(input.connection).fn(
      Effect.fn('Projects.mergePullRequest')(function* (
        payload: MergePullRequestRequest,
      ) {
        return yield* requestApi(input.connection, (api) =>
          api.pullRequests.mergePullRequest({
            params: { projectId: input.projectId, number: input.number },
            payload,
          }),
        ).pipe(Effect.ensuring(rereadPullRequests(input)));
      }),
    ),
);

export const rerunPullRequestChecks = Atom.family(
  (input: {
    connection: RuntimeConnection;
    projectId: string;
    number: number;
  }) =>
    clientRuntime(input.connection).fn(
      Effect.fn('Projects.rerunPullRequestChecks')(function* (
        request: {
          readonly payload: RerunPullChecksRequest;
          readonly reruns: readonly Omit<RequestedRerun, 'at'>[];
        },
        get: Atom.FnContext,
      ) {
        const answer = yield* requestApi(input.connection, (api) =>
          api.pullRequests.rerunPullRequestChecks({
            params: { projectId: input.projectId, number: input.number },
            payload: request.payload,
          }),
        ).pipe(Effect.tapError(() => rereadPullRequests(input)));
        const pending = requestedReruns({
          environmentId: input.connection.environmentId,
          projectId: input.projectId,
          number: input.number,
        });
        const at = yield* Clock.currentTimeMillis;
        get.set(pending, [
          ...get(pending),
          ...request.reruns.map((rerun) => ({ ...rerun, at })),
        ]);
        return answer;
      }),
    ),
);

export const commentOnPullRequest = Atom.family(
  (input: {
    connection: RuntimeConnection;
    projectId: string;
    number: number;
  }) =>
    clientRuntime(input.connection).fn(
      Effect.fn('Projects.commentOnPullRequest')(function* (
        payload: CommentOnPullRequestRequest,
      ) {
        return yield* requestApi(input.connection, (api) =>
          api.pullRequests.commentOnPullRequest({
            params: { projectId: input.projectId, number: input.number },
            payload,
          }),
        ).pipe(Effect.ensuring(rereadPullRequests(input)));
      }),
    ),
);
