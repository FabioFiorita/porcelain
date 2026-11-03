import { type SFSymbolIcon } from 'expo-router/native-tabs';
import { type IconName } from './icon';

const symbols = {
  reviews: 'checklist',
  worktrees: 'folder',
} satisfies Record<IconName, NonNullable<SFSymbolIcon['sf']>>;

export function tabIcon(name: IconName) {
  return { sf: symbols[name] };
}
