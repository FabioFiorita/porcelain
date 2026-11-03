import { Uniwind } from 'uniwind';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtomRef, useAtomSet } from '@effect/atom-react';
import { PreferencesStore } from '@porcelain/client/preferences';
import type { PreferenceChange } from '@porcelain/client/preferences';
import {
  clientRuntime,
  preferencesState,
} from '../../shared/application/store';

const read = clientRuntime.fn((_: void) =>
  Effect.flatMap(PreferencesStore, (store) => store.load()),
);
const change = clientRuntime.fn(
  (preferences: PreferenceChange) =>
    Effect.flatMap(PreferencesStore, (store) => store.change(preferences)),
  { concurrent: true },
);

export function usePreferences() {
  return {
    ...useAtomRef(preferencesState),
    read: useAtomSet(read),
    setPreferences: useAtomSet(change),
  };
}

export const preferenceTheme = Atom.make((get) => {
  const update = () =>
    Uniwind.setTheme(preferencesState.value.preferences.appearance);
  get.addFinalizer(preferencesState.subscribe(update));
  get.mount(read);
  get.set(read, undefined);
  update();
});
