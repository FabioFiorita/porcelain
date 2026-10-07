import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';

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
        const api = yield* porcelainClient(connection);
        return yield* requestEffect(
          api.projects.browseProjectFolders({
            query: path === undefined ? {} : { path },
          }),
          connection.request,
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
