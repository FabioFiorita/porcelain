import { DeviceType, deviceType } from 'expo-device';
import { TabletSplit } from './tablet-split';
import { PhoneTabs } from './phone-tabs';

export function RootShell() {
  return deviceType === DeviceType.TABLET ? <TabletSplit /> : <PhoneTabs />;
}
