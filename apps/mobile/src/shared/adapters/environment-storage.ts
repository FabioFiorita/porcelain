import { SQLiteStorage } from 'expo-sqlite/kv-store';
import {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} from 'expo-secure-store';
import { createEnvironmentStorage } from './credential-storage';

const metadata = new SQLiteStorage('porcelain-environments.db');
const key = (deviceId: string) => `porcelain.device.${deviceId}`;

export const { storage: environmentStorage, removeDevelopmentCredential } =
  createEnvironmentStorage({
    readMetadata: () => metadata.getItemAsync('environments'),
    writeMetadata: (value) => metadata.setItemAsync('environments', value),
    readCredential: (deviceId) => getItemAsync(key(deviceId)),
    writeCredential: (deviceId, value) =>
      setItemAsync(key(deviceId), value, {
        keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    forgetCredential: (deviceId) => deleteItemAsync(key(deviceId)),
    developmentFixtures: () =>
      __DEV__ && Boolean(process.env.EXPO_PUBLIC_PORCELAIN_DEV_PAIR_URL),
  });
