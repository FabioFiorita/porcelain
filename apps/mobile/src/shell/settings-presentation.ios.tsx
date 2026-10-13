import { DeviceType, deviceType } from 'expo-device';
import type { ReactNode } from 'react';
import { SettingsScreen } from '../features/access';
import { TabletSettings, TabletSettingsLayout } from './tablet-settings';
import { DestinationLayout } from './destination-layout';
import type { SettingsPresentationProps } from './settings-presentation-props';

export function SettingsNavigator({ children }: { children: ReactNode }) {
  return deviceType === DeviceType.TABLET ? (
    <TabletSettingsLayout>{children}</TabletSettingsLayout>
  ) : (
    <DestinationLayout name="settings" title="Settings">
      {children}
    </DestinationLayout>
  );
}

export function SettingsPresentation(props: SettingsPresentationProps) {
  return deviceType === DeviceType.TABLET ? (
    <TabletSettings />
  ) : (
    <SettingsScreen {...props} />
  );
}
