import { type SFSymbolIcon } from 'expo-router/native-tabs';
import { type TabIconName } from './icon';

const symbols = {
  walkthrough: 'checklist',
  changes: 'plus.forwardslash.minus',
  files: 'folder',
  history: 'clock.arrow.circlepath',
  settings: 'gearshape',
} satisfies Record<TabIconName, NonNullable<SFSymbolIcon['sf']>>;

export function tabIcon(name: TabIconName) {
  return { sf: symbols[name] };
}
