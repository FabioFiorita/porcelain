import { DeviceType, deviceType } from 'expo-device';

export const reviewPanes = deviceType === DeviceType.TABLET;
