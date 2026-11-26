import { type MaterialIcon } from 'expo-router/native-tabs';
import { type TabIconName } from './icon';

const symbols = {
  walkthrough: 'checklist',
  changes: 'difference',
  files: 'folder',
  history: 'history',
  settings: 'settings',
} satisfies Record<TabIconName, NonNullable<MaterialIcon['md']>>;

export function tabIcon(name: TabIconName): MaterialIcon {
  return { md: symbols[name] };
}
