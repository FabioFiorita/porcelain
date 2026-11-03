import Constants from 'expo-constants';
import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  getExpoPushTokenAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Linking } from 'react-native';
import {
  pushTokenFailure,
  type PushTokenState,
} from '@porcelain/client/notifications/rules';
import { PUSH_PLATFORM, preparePushChannel } from './push-platform';

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function easProjectId(): string | undefined {
  const extra: unknown = Constants.expoConfig?.extra;
  const eas =
    extra !== null && typeof extra === 'object' && 'eas' in extra
      ? extra.eas
      : undefined;
  const projectId =
    eas !== null && typeof eas === 'object' && 'projectId' in eas
      ? eas.projectId
      : undefined;
  return typeof projectId === 'string'
    ? projectId
    : Constants.easConfig?.projectId;
}

export async function readPushToken(ask: boolean): Promise<PushTokenState> {
  await preparePushChannel();
  const current = await getPermissionsAsync();
  const permission =
    current.granted || !ask || !current.canAskAgain
      ? current
      : await requestPermissionsAsync();
  if (!permission.granted)
    return permission.status === 'undetermined'
      ? { kind: 'unknown' }
      : { kind: 'denied' };
  const projectId = easProjectId();
  if (projectId === undefined) return pushTokenFailure('projectId missing');
  try {
    const token = await getExpoPushTokenAsync({ projectId });
    return { kind: 'ready', token: token.data, platform: PUSH_PLATFORM };
  } catch (error) {
    return pushTokenFailure(
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function openNotificationSettings() {
  await Linking.openSettings();
}

export function observeNotificationTaps(open: (data: unknown) => void) {
  const opened = (data: unknown) => {
    clearLastNotificationResponse();
    open(data);
  };
  const last = getLastNotificationResponse();
  if (last) opened(last.notification.request.content.data);
  const subscription = addNotificationResponseReceivedListener((response) =>
    opened(response.notification.request.content.data),
  );
  return () => subscription.remove();
}
