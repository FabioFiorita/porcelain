import { type SFSymbolIcon } from 'expo-router/native-tabs';
import { type HeaderIconName } from './icon';

const symbols = {
  workspace: 'line.3.horizontal.decrease',
  refresh: 'arrow.clockwise',
  done: 'checkmark',
  compareParent: 'arrow.triangle.merge',
  add: 'plus',
} satisfies Record<HeaderIconName, NonNullable<SFSymbolIcon['sf']>>;

export function headerIcon(name: HeaderIconName) {
  return symbols[name];
}
