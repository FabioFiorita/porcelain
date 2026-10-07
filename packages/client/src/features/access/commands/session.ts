import type { PairingCode } from '../rules/pairing-link.ts';
import { connectionErrorMessage } from '../rules/connection-error-message.ts';
import { AccessSession } from '../store/session.ts';
import type { pairBrowserSession } from './pairing.ts';
import type { readBrowserSession } from '../queries/session.ts';
import { Cause, Effect, Layer } from 'effect';
import { Atom, AtomRegistry, AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { FileDrafts } from '../../files/store.ts';
import { UNSAVED_DRAFTS_MESSAGE } from '../rules/connection-error-message.ts';

export const disconnectBrowserSession = Atom.family(
  (connection: RuntimeConnection) => {
    const runtime = connection.atoms((get) =>
      Layer.merge(
        get(porcelainClient(connection).runtime.layer),
        FileDrafts.layer,
      ),
    );
    return runtime.fn(
      Effect.fn('BrowserSession.disconnect')(
        function* () {
          const drafts = yield* FileDrafts;
          const client = yield* porcelainClient(connection);
          if (!(yield* drafts.save(connection.environmentId)))
            return yield* Effect.fail(
              new ConnectionError({ message: UNSAVED_DRAFTS_MESSAGE }),
            );
          yield* client.request((api) =>
            api.browserAccess.clearBrowserSession(),
          );
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

export const connectBrowserSession = Effect.fn('BrowserSession.connect')(
  function* (
    registry: AtomRegistry.AtomRegistry,
    pairing: ReturnType<typeof pairBrowserSession>,
    link: PairingCode,
    timeoutMs: number,
  ) {
    const access = yield* AccessSession;
    const complete = yield* access.beginConnection();
    const session = yield* Effect.acquireUseRelease(
      Effect.sync(() => registry.set(pairing, link)),
      () =>
        AtomRegistry.getResult(registry, pairing, { suspendOnWaiting: true }),
      () => Effect.sync(() => registry.set(pairing, Atom.Interrupt)),
    ).pipe(
      Effect.timeoutOrElse({
        duration: timeoutMs,
        orElse: () => Effect.interrupt,
      }),
      Effect.catchCause((cause) =>
        Effect.fail(
          new ConnectionError({
            message: connectionErrorMessage(Cause.squash(cause)),
            cause: Cause.squash(cause),
          }),
        ),
      ),
    );
    if (complete) yield* complete(session);
    if (
      access.state.value.connection?.environmentId !==
      session.inventory.environmentId
    )
      return yield* Effect.fail(
        new ConnectionError({
          message: 'Could not connect to the environment. Try again.',
        }),
      );
  },
);

export const restoreBrowserConnection = Effect.fn(
  'BrowserSession.restoreConnection',
)(function* (
  registry: AtomRegistry.AtomRegistry,
  restoredSession: ReturnType<typeof readBrowserSession>,
) {
  const access = yield* AccessSession;
  if (access.state.value.connection) return true;
  const complete = yield* access.beginConnection(true);
  if (!complete) return false;
  const result = registry.get(restoredSession);
  if (AsyncResult.isFailure(result) && !result.waiting)
    registry.refresh(restoredSession);
  const session = yield* AtomRegistry.getResult(registry, restoredSession, {
    suspendOnWaiting: true,
  });
  if (session === null) return false;
  yield* complete(session);
  return access.state.value.connection !== null;
});
