import { type SFSymbolIcon } from 'expo-router/native-tabs';
import { type IconName } from './icon';

const symbols = {
  review: 'point.topleft.down.curvedto.point.bottomright.up',
  files: 'folder',
  history: 'clock.arrow.circlepath',
  settings: 'gearshape',
  workspace: 'line.3.horizontal.decrease',
} satisfies Record<IconName, NonNullable<SFSymbolIcon['sf']>>;

export function tabIcon(name: IconName) {
  return { sf: symbols[name] };
}
