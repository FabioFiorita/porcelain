import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

const folders = Atom.family(
  ({
    connection,
    path,
  }: {
    connection: RuntimeConnection;
    path: string | undefined;
  }) =>
    clientRuntime(connection).atom(
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        return yield* client.request((api) =>
          api.projects.browseProjectFolders({
            query: path === undefined ? {} : { path },
          }),
        );
      }),
    ),
);
export function readProjectFolder(
  connection: RuntimeConnection,
  path: string | undefined,
) {
  return folders({ connection, path });
}
