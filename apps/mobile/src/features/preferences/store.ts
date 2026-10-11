import { Effect } from 'effect';
import { useAtomRef, useAtomSet } from '@effect/atom-react';
import { PreferencesStore } from '@porcelain/client/preferences';
import type { Preferences } from '@porcelain/client/preferences';
import {
  clientRuntime,
  preferencesState,
} from '../../shared/application/store';

const read = clientRuntime.fn((_: void) =>
  Effect.flatMap(PreferencesStore, (store) => store.load()),
);
const change = clientRuntime.fn(
  (preferences: Partial<Preferences>) =>
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
