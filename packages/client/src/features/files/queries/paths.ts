import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { Effect } from 'effect';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';

export const readWorktreePaths = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    worktreeRead(
      connection,
      scope,
      ['paths'],
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        return yield* client
          .request((api) =>
            api.files.listWorktreePaths({
              params: { worktreeId: scope.worktreeId },
            }),
          )
          .pipe(
            Effect.tap((answer) =>
              currentAnswerEffect(
                connection,
                answer.worktreeId === scope.worktreeId,
              ),
            ),
          );
      }),
      clientRuntime(connection),
    ),
);
