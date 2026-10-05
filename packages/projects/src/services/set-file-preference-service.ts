import { SetFilePreferenceOptions } from '../ports/set-file-preference-options.ts';
import { Effect, Context, Layer } from 'effect';
import { FilePreferenceLimitError } from '../errors/file-preference-limit-error.ts';
import { type FilePreference } from '../models/file-preference.ts';
import {
  type SetFilePreferenceInput,
  type SetFilePreferenceResult,
} from '../models/set-file-preference.ts';
import { FilePreferenceStore } from '../ports/file-preference-store.ts';

export class SetFilePreferenceService extends Context.Service<
  SetFilePreferenceService,
  {
    readonly execute: (
      input: SetFilePreferenceInput,
    ) => Effect.Effect<SetFilePreferenceResult, FilePreferenceLimitError>;
  }
>()('@porcelain/projects/SetFilePreferenceService') {
  static readonly layer = Layer.effect(
    SetFilePreferenceService,
    Effect.gen(function* () {
      const filePreferenceCapability = yield* FilePreferenceStore;
      const optionsCapability = yield* SetFilePreferenceOptions;

      return {
        execute: Effect.fn('SetFilePreferenceService.execute')(function* (
          input: SetFilePreferenceInput,
        ): Effect.fn.Return<SetFilePreferenceResult, FilePreferenceLimitError> {
          const { projectId, path } = input;
          const existing = yield* filePreferenceCapability.find({
            projectId,
            path,
          });
          const next: FilePreference = {
            path,
            pinned: existing?.pinned ?? false,
            hidden: existing?.hidden ?? false,
            [input.flag]: input.value,
          };
          const changed =
            (existing?.pinned ?? false) !== next.pinned ||
            (existing?.hidden ?? false) !== next.hidden;
          if (!changed)
            return {
              preferences: yield* filePreferenceCapability.list({ projectId }),
              changed,
            };
          if (!next.pinned && !next.hidden) {
            yield* filePreferenceCapability.remove({ projectId, path });
          } else {
            if (
              !existing &&
              (yield* filePreferenceCapability.count({ projectId })) >=
                optionsCapability.maxPreferences
            )
              return yield* Effect.fail(new FilePreferenceLimitError());
            yield* filePreferenceCapability.save({
              projectId,
              preference: next,
            });
          }
          return {
            preferences: yield* filePreferenceCapability.list({ projectId }),
            changed,
          };
        }),
      };
    }),
  );
}
