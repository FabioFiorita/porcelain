import { type MaterialIcon } from 'expo-router/native-tabs';
import { type IconName } from './icon';

const symbols = {
  review: 'merge',
  files: 'folder',
  history: 'history',
  settings: 'settings',
  workspace: 'filter_list',
} satisfies Record<IconName, NonNullable<MaterialIcon['md']>>;

export function tabIcon(name: IconName): MaterialIcon {
  return { md: symbols[name] };
}
