import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type { ArchivePullRequestRequest } from '@porcelain/contracts/projects';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
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
