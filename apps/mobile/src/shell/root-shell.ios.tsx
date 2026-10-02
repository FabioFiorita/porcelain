import { DeviceType, deviceType } from 'expo-device';
import { TabletSplit } from './tablet-split';
import { WorkspaceTabs } from './workspace-tabs';

export function RootShell() {
  return deviceType === DeviceType.TABLET ? <TabletSplit /> : <WorkspaceTabs />;
}
