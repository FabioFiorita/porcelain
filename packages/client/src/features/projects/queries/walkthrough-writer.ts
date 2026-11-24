import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';

const writerSettings = Atom.family((connection: RuntimeConnection) =>
  Atom.family((projectId: string | undefined) =>
    clientRuntime(connection)
      .atom(
        requestApi(connection, (api) =>
          api.walkthroughs.readWalkthroughWriterSettings({
            query: { projectId },
          }),
        ),
      )
      .pipe(
        connection.atoms.withReactivity([
          queryKeys.inventory(connection.environmentId),
        ]),
        Atom.setIdleTTL(0),
      ),
  ),
);

export function readWalkthroughWriterSettings(
  connection: RuntimeConnection,
  projectId?: string,
) {
  return writerSettings(connection)(projectId);
}
