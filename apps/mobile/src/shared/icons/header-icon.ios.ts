import { type SFSymbolIcon } from 'expo-router/native-tabs';
import { type HeaderIconName } from './icon';

const symbols = {
  sidebar: 'sidebar.left',
  inspector: 'sidebar.right',
  add: 'plus',
  workspace: 'line.3.horizontal.decrease',
  refresh: 'arrow.clockwise',
  done: 'checkmark',
  close: 'xmark',
  compareParent: 'arrow.triangle.merge',
} satisfies Record<HeaderIconName, NonNullable<SFSymbolIcon['sf']>>;

export function headerIcon(name: HeaderIconName) {
  return symbols[name];
}
