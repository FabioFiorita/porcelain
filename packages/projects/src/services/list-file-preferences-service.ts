import { Effect, Context, Layer } from 'effect';
import {
  type ListFilePreferencesInput,
  type ListFilePreferencesResult,
} from '../models/list-file-preferences.ts';
import { FilePreferenceStore } from '../ports/file-preference-store.ts';

export class ListFilePreferencesService extends Context.Service<
  ListFilePreferencesService,
  {
    readonly execute: (
      input: ListFilePreferencesInput,
    ) => Effect.Effect<ListFilePreferencesResult, never>;
  }
>()('@porcelain/projects/ListFilePreferencesService') {
  static readonly layer = Layer.effect(
    ListFilePreferencesService,
    Effect.gen(function* () {
      const filePreferenceCapability = yield* FilePreferenceStore;

      return {
        execute: Effect.fn('ListFilePreferencesService.execute')(function* (
          input: ListFilePreferencesInput,
        ): Effect.fn.Return<ListFilePreferencesResult, never> {
          return {
            preferences: yield* filePreferenceCapability.list({
              projectId: input.projectId,
            }),
          };
        }),
      };
    }),
  );
}
