import { useAtomRef } from '@effect/atom-react';
import { AtomRef } from 'effect/reactivity';
import { accessState } from '../../shared/application/store';

type SettingsCategory = 'appearance' | 'environments' | 'development';
const settingsCategory = AtomRef.make<SettingsCategory>('appearance');
const selectSettingsCategory = (category: SettingsCategory) =>
  settingsCategory.set(category);

export function useSettingsCategory() {
  return {
    category: useAtomRef(settingsCategory),
    select: selectSettingsCategory,
  };
}

export function useEnvironments() {
  return useAtomRef(accessState).remotes;
}

export function useEnvironmentStorageStatus() {
  const { status, error } = useAtomRef(accessState);
  return { status, error };
}
