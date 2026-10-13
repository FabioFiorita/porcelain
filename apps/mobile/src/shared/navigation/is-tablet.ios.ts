import { DeviceType, deviceType } from 'expo-device';

export const isTablet = deviceType === DeviceType.TABLET;
