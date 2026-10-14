import { Effect } from 'effect';
import { AtomRef } from 'effect/reactivity';
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

const sidebarVisible = AtomRef.make<boolean | undefined>(undefined);
const setSidebarVisible = (visible: boolean | undefined) =>
  sidebarVisible.set(visible);
const toggleSidebar = () => sidebarVisible.update((visible) => !visible);

export function useAppSidebar() {
  const visible = useAtomRef(sidebarVisible);
  return {
    sidebar: visible === undefined ? null : { visible, toggle: toggleSidebar },
    setSidebarVisible,
  };
}

export function usePreferences() {
  return {
    ...useAtomRef(preferencesState),
    read: useAtomSet(read),
    setPreferences: useAtomSet(change),
  };
}
