import { type SFSymbolIcon } from 'expo-router/native-tabs';
import { type IconName } from './icon';

const symbols = {
  review: 'checkmark.bubble',
  files: 'doc.on.doc',
  history: 'clock.arrow.circlepath',
  settings: 'gearshape',
  workspace: 'line.3.horizontal.decrease.circle',
} satisfies Record<IconName, NonNullable<SFSymbolIcon['sf']>>;

export function tabIcon(name: IconName): SFSymbolIcon {
  return { sf: symbols[name] };
}
