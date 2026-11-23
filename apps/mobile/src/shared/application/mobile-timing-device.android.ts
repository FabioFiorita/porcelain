import { DeviceType, deviceType } from 'expo-device';

export const phoneTimingSupported = deviceType === DeviceType.PHONE;
