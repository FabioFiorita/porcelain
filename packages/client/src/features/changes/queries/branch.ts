import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';

type Selection = { connection: RuntimeConnection; scope: WorktreeScope };
export const readBranchChanges = Atom.family(
  ({ connection, scope, base }: Selection & { base?: string }) =>
    worktreeRead(
      connection,
      scope,
      ['branch', base ?? null],
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        const answer = yield* client.request((api) =>
          api.changes.readBranchChanges({
            params: { worktreeId: scope.worktreeId },
            query: { base },
          }),
        );
        yield* currentAnswerEffect(
          connection.request().signal,
          answer.worktreeId === scope.worktreeId,
        );
        return answer;
      }),
      clientRuntime(connection),
    ),
);
export const readBranchBases = Atom.family(({ connection, scope }: Selection) =>
  worktreeRead(
    connection,
    scope,
    ['branch-bases'],
    Effect.gen(function* () {
      const client = yield* porcelainClient(connection);
      return yield* client.request((api) =>
        api.changes.listBranchBases({
          params: { worktreeId: scope.worktreeId },
        }),
      );
    }),
    clientRuntime(connection),
  ),
);
