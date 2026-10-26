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
  closed: 'archivebox',
  compareParent: 'arrow.triangle.merge',
  resolve: 'checkmark.circle',
  reopen: 'arrow.uturn.backward',
} satisfies Record<HeaderIconName, NonNullable<SFSymbolIcon['sf']>>;

export function headerIcon(name: HeaderIconName) {
  return symbols[name];
}
