import { DeviceType, deviceType } from 'expo-device';
import type { DrawerMode } from '../shared/rules/side-drawer';

const tablet = deviceType === DeviceType.TABLET;

export function tabPlacement(_mode: DrawerMode) {
  return tablet
    ? ({ sidebarAdaptable: true, preferredPlacement: 'sidebar' } as const)
    : {};
}
