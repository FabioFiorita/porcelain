import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { porcelainClient } from '../../../shared/api/client.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

export const clearPushRegistration = Atom.family(
  (connection: RuntimeConnection) =>
    clientRuntime(connection).fn(
      Effect.fn('PushRegistration.clear')(function* (_: void) {
        const client = yield* porcelainClient(connection);
        yield* client.request((api) =>
          api.pushRegistration.clearPushRegistration(),
        );
      }),
    ),
);
