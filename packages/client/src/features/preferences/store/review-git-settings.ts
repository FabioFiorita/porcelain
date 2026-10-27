import { Context, Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { confirmedResource } from '../../../shared/api/confirmed-resource.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

const settingsResource = Effect.fn('ReviewGitSettingsState.resource')(
  function* (connection: RuntimeConnection) {
    const client = yield* porcelainClient(connection);
    return yield* confirmedResource(
      connection,
      queryKeys.reviewGitSettings(connection.environmentId),
      client.request((api) => api.reviewGitSettings.readReviewGitSettings()),
    );
  },
);

export class ReviewGitSettingsState extends Context.Service<
  ReviewGitSettingsState,
  Effect.Success<ReturnType<typeof settingsResource>>
>()('@porcelain/client/ReviewGitSettingsState') {
  static layer(connection: RuntimeConnection) {
    return Layer.effect(ReviewGitSettingsState, settingsResource(connection));
  }
}

export const reviewGitSettingsRuntime = Atom.family(
  (connection: RuntimeConnection) =>
    connection.atoms((get) =>
      Layer.provideMerge(
        ReviewGitSettingsState.layer(connection),
        get(clientRuntime(connection).layer),
      ),
    ),
);
