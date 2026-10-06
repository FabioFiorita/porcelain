import { Effect } from 'effect';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';

export const readAsset = Atom.family(
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
      ['asset', path],
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        return yield* requestEffect(
          api.files.readFileAsset({
            params: { worktreeId: scope.worktreeId },
            query: { path },
          }),
        );
      }),
      clientRuntime(connection),
      [path],
    ),
);
