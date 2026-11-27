import type { DrawerMode } from '../shared/rules/side-drawer';

export function tabPlacement(mode: DrawerMode) {
  return { hidden: mode !== 'overlay' };
}
