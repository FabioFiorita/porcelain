import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
export const readWalkthroughWriterSettings = Atom.family(
  (connection: RuntimeConnection) =>
    clientRuntime(connection)
      .atom(
        requestApi(connection, (api) =>
          api.walkthroughs.readWalkthroughWriterSettings(),
        ),
      )
      .pipe(
        connection.atoms.withReactivity([
          queryKeys.inventory(connection.environmentId),
        ]),
        Atom.setIdleTTL(0),
      ),
);
