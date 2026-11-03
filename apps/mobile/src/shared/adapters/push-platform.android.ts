import {
  AndroidImportance,
  setNotificationChannelAsync,
} from 'expo-notifications';

export const PUSH_PLATFORM = 'android';

export async function preparePushChannel() {
  await setNotificationChannelAsync('reviews', {
    name: 'Reviews and replies',
    importance: AndroidImportance.HIGH,
  });
}
