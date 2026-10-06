import { Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { FileDrafts, fileDraftRuntime } from '../../files/store.ts';
import { UNSAVED_DRAFTS_MESSAGE } from '../rules/connection-error-message.ts';

export const disconnectBrowserSession = Atom.family(
  (connection: RuntimeConnection) => {
    const runtime = connection.atoms((get) =>
      Layer.merge(
        get(porcelainClient(connection).runtime.layer),
        Layer.succeed(FileDrafts, fileDraftRuntime.runSync(FileDrafts)),
      ),
    );
    return runtime.fn(
      Effect.fn('BrowserSession.disconnect')(
        function* () {
          const drafts = yield* FileDrafts;
          const api = yield* porcelainClient(connection);
          if (!(yield* drafts.save(connection.environmentId)))
            return yield* Effect.fail(
              new ConnectionError({ message: UNSAVED_DRAFTS_MESSAGE }),
            );
          yield* requestEffect(api.browserAccess.clearBrowserSession());
        },
        Effect.mapError((error) =>
          error instanceof ConnectionError
            ? error
            : new ConnectionError({
                message:
                  'Could not disconnect. Check the connection and try again.',
                cause: error,
              }),
        ),
      ),
    );
  },
);
