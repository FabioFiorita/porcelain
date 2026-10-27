import { Cause, Effect, Option, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { reviewGitSettingsView } from '../rules/review-git-settings.ts';
import {
  ReviewGitSettingsState,
  reviewGitSettingsRuntime,
} from '../store/review-git-settings.ts';

const readReviewGitSettings = Atom.family((connection: RuntimeConnection) =>
  reviewGitSettingsRuntime(connection)
    .atom(
      Stream.unwrap(
        Effect.map(ReviewGitSettingsState, (settings) => settings.stream),
      ),
    )
    .pipe(
      Atom.map((result) => AsyncResult.flatMap(result, (answer) => answer)),
      Atom.setIdleTTL(0),
    ),
);

export const readReviewGitSettingsView = Atom.family(
  (connection: RuntimeConnection) =>
    Atom.map(readReviewGitSettings(connection), (result) =>
      reviewGitSettingsView({
        confirmed: Option.getOrUndefined(AsyncResult.value(result)),
        failure: AsyncResult.isFailure(result)
          ? { error: Cause.squash(result.cause) }
          : undefined,
      }),
    ),
);
