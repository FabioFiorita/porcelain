import { Effect } from 'effect';
import { Atom, AtomRef } from 'effect/reactivity';
import { useAtomRef, useAtomSet } from '@effect/atom-react';
import {
  defaultPreferences,
  type Preferences,
} from '../../shared/rules/preferences';
import { preferenceStorage } from './adapters/storage';

type PreferenceState = {
  preferences: Preferences;
  status: 'loading' | 'ready' | 'unreadable';
  error: string | undefined;
};

const state = AtomRef.make<PreferenceState>({
  preferences: defaultPreferences,
  status: 'loading',
  error: undefined,
});

const read = Atom.fn((_: void) =>
  preferenceStorage.read().pipe(
    Effect.match({
      onSuccess: (preferences) =>
        state.set({ preferences, status: 'ready', error: undefined }),
      onFailure: () =>
        state.update((current) => ({
          ...current,
          status: 'unreadable',
          error: 'Saved preferences could not be read. Try reading them again.',
        })),
    }),
  ),
);

const write = Atom.fn((change: Partial<Preferences>) =>
  Effect.gen(function* () {
    if (state.value.status !== 'ready') return;
    const preferences = { ...state.value.preferences, ...change };
    yield* preferenceStorage.write(preferences).pipe(
      Effect.match({
        onSuccess: () =>
          state.set({ preferences, status: 'ready', error: undefined }),
        onFailure: () =>
          state.update((current) => ({
            ...current,
            error:
              'Preferences could not be saved. Your previous settings are still in use.',
          })),
      }),
    );
  }),
);

export function usePreferences() {
  const snapshot = useAtomRef(state);
  const load = useAtomSet(read);
  const save = useAtomSet(write);
  return {
    ...snapshot,
    read: load,
    setPreferences: save,
  };
}
