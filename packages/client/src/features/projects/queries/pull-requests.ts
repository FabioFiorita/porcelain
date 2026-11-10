import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi, type PorcelainApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { retainRead } from '../../../shared/api/worktree-read.ts';

type ProjectInput = { connection: RuntimeConnection; projectId: string };
type PullInput = ProjectInput & { number: number };
function query<A, E>(
  input: ProjectInput,
  request: (api: PorcelainApi) => Effect.Effect<A, E>,
  accepts: (answer: A) => boolean = () => true,
) {
  return clientRuntime(input.connection)
    .atom(
      Effect.gen(function* () {
        const answer = yield* requestApi(input.connection, request);
        yield* currentAnswerEffect(input.connection, accepts(answer));
        return answer;
      }),
    )
    .pipe(
      input.connection.atoms.withReactivity([
        queryKeys.environment(input.connection.environmentId),
        queryKeys.inventory(input.connection.environmentId),
        queryKeys.projectPullRequests(
          input.connection.environmentId,
          input.projectId,
        ),
      ]),
      Atom.setIdleTTL(0),
    );
}
export const readProjectPullRequest = Atom.family((input: PullInput) =>
  query(
    input,
    (api) =>
      api.pullRequests.readProjectPullRequest({
        params: { projectId: input.projectId, number: input.number },
      }),
    (answer) =>
      answer.kind !== 'available' || answer.pullRequest.number === input.number,
  ),
);
export const readProjectPullChecks = Atom.family((input: PullInput) =>
  query(
    input,
    (api) =>
      api.pullRequests.readProjectPullChecks({
        params: { projectId: input.projectId, number: input.number },
      }),
    (answer) => answer.kind !== 'available' || answer.number === input.number,
  ).pipe(retainRead),
);
export const readProjectPullRequests = Atom.family((input: ProjectInput) =>
  query(input, (api) =>
    api.pullRequests.listProjectPullRequests({
      params: { projectId: input.projectId },
    }),
  ),
);
export const readProjectGitHubAccount = Atom.family((input: ProjectInput) =>
  query(input, (api) =>
    api.pullRequests.readProjectGitHubAccount({
      params: { projectId: input.projectId },
    }),
  ).pipe(retainRead),
);
