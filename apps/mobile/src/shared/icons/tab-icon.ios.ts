import { type SFSymbolIcon } from 'expo-router/native-tabs';
import { type IconName } from './icon';

const symbols = {
  review: 'plus.minus.capsule',
  files: 'folder',
  history: 'clock.arrow.circlepath',
  settings: 'gearshape',
} satisfies Record<IconName, NonNullable<SFSymbolIcon['sf']>>;

export function tabIcon(name: IconName) {
  return { sf: symbols[name] };
}
