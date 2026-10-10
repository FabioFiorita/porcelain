import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { Effect } from 'effect';
import type { FilesScope } from '../rules/scope.ts';
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

export type DirectorySelection = {
  connection: RuntimeConnection;
  scope: FilesScope;
  paths: readonly string[];
};
export const readDirectories = Atom.family((selection: DirectorySelection) =>
  Atom.make((get) =>
    selection.paths.map((path) => get(readDirectory({ ...selection, path }))),
  ),
);
export const refreshDirectories = Atom.family((selection: DirectorySelection) =>
  Atom.fnSync((_: void, get) => {
    for (const path of selection.paths)
      get.refresh(readDirectory({ ...selection, path }));
  }),
);
