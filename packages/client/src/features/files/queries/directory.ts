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

export const readDirectory = Atom.family(
  ({
    connection,
    scope,
    path,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    path: string;
  }) =>
    worktreeRead(
      connection,
      scope,
      ['directory', path],
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        return yield* client
          .request((api) =>
            api.files.listDirectory({
              params: { worktreeId: scope.worktreeId },
              query: { path },
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
      [path],
    ),
);
