import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  getLastNotificationResponse,
  setNotificationHandler,
} from 'expo-notifications';

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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
