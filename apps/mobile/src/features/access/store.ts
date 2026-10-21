import { useAtomRef } from '@effect/atom-react';
import { AtomRef } from 'effect/reactivity';
import { accessState } from '../../shared/application/store';

type SettingsCategory = 'general' | 'reviews-git' | 'computers' | 'development';
const settingsCategory = AtomRef.make<SettingsCategory>('general');
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
