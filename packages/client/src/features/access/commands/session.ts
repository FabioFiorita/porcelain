import { Effect } from 'effect';
import type { Transport } from '../../../shared/api/transport.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { FileDrafts, fileDraftRuntime } from '../../files/store.ts';
import { UNSAVED_DRAFTS_MESSAGE } from '../rules/connection-error-message.ts';
import { accessApi } from '../api.ts';

export function disconnectBrowserSession(
  transport: Transport,
  environmentId?: string,
) {
  return Effect.gen(function* () {
    if (
      environmentId &&
      !(yield* fileDraftRuntime.runSync(FileDrafts).save(environmentId))
    )
      return yield* Effect.fail(
        new ConnectionError({ message: UNSAVED_DRAFTS_MESSAGE }),
      );
    yield* requestEffect(
      accessApi({ transport }).browserAccess.clearBrowserSession(),
    );
  }).pipe(
    Effect.mapError((error) =>
      error instanceof ConnectionError
        ? error
        : new ConnectionError({
            message:
              'Could not disconnect. Check the connection and try again.',
            cause: error,
          }),
    ),
  );
}
