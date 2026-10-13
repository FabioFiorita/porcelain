import { DeviceType, deviceType } from 'expo-device';
import { TabletLayout } from './tablet-layout';
import { PhoneTabs } from './phone-tabs';

export function RootShell() {
  return deviceType === DeviceType.TABLET ? <TabletLayout /> : <PhoneTabs />;
}
