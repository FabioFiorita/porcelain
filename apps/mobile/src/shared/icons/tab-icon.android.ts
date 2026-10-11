import { type MaterialIcon } from 'expo-router/native-tabs';
import { type IconName } from './icon';

const symbols = {
  review: 'exposure',
  files: 'folder',
  history: 'history',
  settings: 'settings',
} satisfies Record<IconName, NonNullable<MaterialIcon['md']>>;

export function tabIcon(name: IconName): MaterialIcon {
  return { md: symbols[name] };
}
