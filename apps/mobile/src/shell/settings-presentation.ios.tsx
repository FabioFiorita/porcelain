import { DeviceType, deviceType } from 'expo-device';
import { SettingsScreen } from '../features/access';
import { TabletSettings } from './tablet-settings';
import type { SettingsPresentationProps } from './settings-presentation-props';

export function SettingsPresentation(props: SettingsPresentationProps) {
  return deviceType === DeviceType.TABLET ? (
    <TabletSettings />
  ) : (
    <SettingsScreen {...props} />
  );
}
