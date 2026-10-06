import { Effect, Schema } from 'effect';
import { Atom } from 'effect/reactivity';
import type { Transport } from '../../../shared/api/transport.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import {
  BootstrapClient,
  bootstrapRuntime,
} from '../../../shared/api/bootstrap-client.ts';
import type { BrowserSession } from '../rules/browser-session.ts';

const restore = Effect.fn('BrowserSession.restore')(
  function* () {
    const api = yield* BootstrapClient;
    const principal = yield* requestEffect(api.session.readSession());
    const inventory = yield* requestEffect(api.projects.readInventory());
    return { principal, inventory } satisfies BrowserSession;
  },
  Effect.catch((error) =>
    error instanceof RequestError && error.status === 401
      ? Effect.succeed(null)
      : Effect.fail(
          error instanceof RequestError || Schema.isSchemaError(error)
            ? new ConnectionError({
                message:
                  'Could not reach Porcelain to restore this browser session.',
                cause: error,
              })
            : error,
        ),
  ),
);

export const readBrowserSession = Atom.family((transport: Transport) =>
  bootstrapRuntime(transport).atom(restore()),
);
