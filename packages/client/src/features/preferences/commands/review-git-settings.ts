import { Cause, Effect, Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { SaveReviewGitSettingsRequest } from '@porcelain/contracts/access';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import {
  reviewGitSettingsImportKept,
  reviewGitSettingsSaveMessage,
} from '../rules/review-git-settings.ts';
import {
  ReviewGitSettingsState,
  reviewGitSettingsRuntime,
} from '../store/review-git-settings.ts';

export const saveReviewGitSettings = Atom.family(
  (connection: RuntimeConnection) =>
    reviewGitSettingsRuntime(connection).fn(
      (input: SaveReviewGitSettingsRequest) =>
        Effect.gen(function* () {
          const client = yield* porcelainClient(connection);
          const settings = yield* ReviewGitSettingsState;
          const answer = yield* settings.confirm(
            client.request((api) =>
              input.kind === 'initialize'
                ? api.reviewGitSettings.saveReviewGitSettings({
                    payload: input,
                  })
                : api.reviewGitSettings.saveReviewGitSettings({
                    payload: input,
                  }),
            ),
            (_, saved) => Option.some(saved),
          );
          return {
            answer,
            kept:
              input.kind === 'initialize' &&
              reviewGitSettingsImportKept(input.settings, answer.settings),
          };
        }),
      { concurrent: true },
    ),
);

export const refreshReviewGitSettings = Atom.family(
  (connection: RuntimeConnection) =>
    reviewGitSettingsRuntime(connection).fn(
      (_input: void) =>
        Effect.gen(function* () {
          const client = yield* porcelainClient(connection);
          const settings = yield* ReviewGitSettingsState;
          yield* settings.refresh(
            client.request((api) =>
              api.reviewGitSettings.readReviewGitSettings(),
            ),
          );
        }),
      { concurrent: true },
    ),
);

export const reviewGitSettingsSaving = Atom.family(
  (connection: RuntimeConnection) =>
    Atom.map(saveReviewGitSettings(connection), (result) => ({
      saving: result.waiting,
      kept: AsyncResult.isSuccess(result) && result.value.kept,
      failure: AsyncResult.isFailure(result)
        ? reviewGitSettingsSaveMessage(Cause.squash(result.cause))
        : undefined,
    })),
);
