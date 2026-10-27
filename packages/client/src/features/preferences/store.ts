import { persistedState } from '../persistence/store.ts';
import { Context, Effect, Layer } from 'effect';
import type { AtomRef } from 'effect/reactivity';
import { type WriteNotSentError } from '../../shared/api/write-queue.ts';
import type { ConnectionError } from '../../shared/api/connection-error.ts';
import { PreferenceStorage } from './ports/preference-storage.ts';
import {
  defaultPreferences,
  type PreferenceChange,
  type Preferences,
} from './store/saved-preferences.ts';
import type { PersistedReadState } from '../persistence/rules/read-state.ts';

type PreferencesState = PersistedReadState & {
  readonly preferences: Preferences;
};

type WriteFailure = ConnectionError | WriteNotSentError;

export class PreferencesStore extends Context.Service<
  PreferencesStore,
  {
    readonly state: AtomRef.ReadonlyRef<PreferencesState>;
    readonly load: () => Effect.Effect<void, WriteFailure>;
    readonly change: (
      change: PreferenceChange,
    ) => Effect.Effect<void, WriteFailure>;
  }
>()('@porcelain/client/PreferencesStore') {
  static readonly layer = Layer.effect(
    PreferencesStore,
    Effect.gen(function* () {
      const storage = yield* PreferenceStorage;
      const owner = yield* persistedState({
        initial: { preferences: defaultPreferences },
        read: () =>
          Effect.map(storage.read(), (preferences) => ({ preferences })),
        write: ({ preferences }) => storage.write(preferences),
        messages: {
          beforeRead: 'Saved preferences must be read before changing them.',
          readFailed:
            'Saved preferences could not be read. Try reading them again.',
          writeFailed:
            'Preferences could not be saved. Read them again before changing them.',
        },
      });
      return {
        state: owner.state,
        load: owner.load,
        change: Effect.fn('PreferencesStore.change')(
          (change: PreferenceChange) =>
            owner.write(({ preferences }) =>
              Effect.succeed({ preferences: { ...preferences, ...change } }),
            ),
        ),
      };
    }),
  );
}
