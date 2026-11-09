import { Alert, ScrollView } from 'react-native';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useAtomRef, useAtomSet, useAtomValue } from '@effect/atom-react';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { syncPushRegistration } from '@porcelain/client/notifications';
import {
  NOTIFICATIONS_EXPLANATION,
  notificationKinds,
  notificationsMessage,
  type NotificationPreferences,
} from '@porcelain/client/notifications/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { CardRows } from '../../../components/ui/card';
import { ErrorState } from '../../../components/ui/error-state';
import { GroupHeader } from '../../../components/ui/group-header';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';
import { openNotificationSettings } from '../../../shared/adapters/push-notifications';
import { remoteConnectionState } from '../../../shared/application/store';
import { PreferenceSwitch, usePreferences } from '../../preferences';
import { pushTokenState, refreshPushToken } from '../store';

const switches = [
  {
    key: 'reviewReady',
    testID: 'notifications-reviewReady',
    title: 'Reviews ready',
    description: 'An agent publishes a review for you.',
  },
  {
    key: 'agentReply',
    testID: 'notifications-agentReply',
    title: 'Agent replies',
    description: 'An agent replies to your comment.',
  },
] as const;

function registrationDescription(
  result: AsyncResult.AsyncResult<readonly unknown[], unknown>,
  waiting: boolean,
) {
  if (waiting) return 'Registers once this phone has a notification token';
  if (result.waiting) return 'Registering…';
  if (AsyncResult.isFailure(result))
    return connectionErrorMessage(Cause.squash(result.cause));
  if (!AsyncResult.isSuccess(result)) return 'Not registered yet';
  return result.value.length > 0 ? 'Notifies this phone' : 'Off';
}

function ComputerRegistration({
  connection,
  name,
  waiting,
}: {
  connection: RuntimeConnection;
  name: string;
  waiting: boolean;
}) {
  const result = useAtomValue(syncPushRegistration(connection));
  const description = registrationDescription(result, waiting);
  return (
    <Item
      testID={`notifications-computer-${connection.environmentId}`}
      title={name}
      description={description}
      accessibilityLabel={`${name}, ${description}`}
    />
  );
}

export function NotificationsSettings() {
  const { preferences, status, setPreferences } = usePreferences();
  const token = useAtomValue(pushTokenState);
  const ask = useAtomSet(refreshPushToken, { mode: 'promise' });
  const computers = useAtomRef(remoteConnectionState);
  const notifications = preferences.notifications;
  const disabled = status !== 'ready';
  const message = notificationsMessage(notifications, token);
  const on = notificationKinds(notifications).length > 0;
  const change = (next: Partial<NotificationPreferences>) =>
    setPreferences({ notifications: { ...notifications, ...next } });
  const turn = (key: keyof NotificationPreferences, value: boolean) => {
    if (!value || token.kind !== 'unknown') {
      change({ [key]: value });
      return;
    }
    Alert.alert('Allow notifications?', NOTIFICATIONS_EXPLANATION, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          void ask(true)
            .catch(() => undefined)
            .then(() => change({ [key]: true }));
        },
      },
    ]);
  };
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box className="w-full max-w-2xl self-center" gap={6} padding={4}>
        <Box gap={2}>
          <CardRows>
            {switches.map(({ key, testID, title, description }) => (
              <PreferenceSwitch
                key={key}
                testID={testID}
                label={title}
                description={description}
                checked={notifications[key]}
                disabled={disabled}
                onChange={(value) => turn(key, value)}
              />
            ))}
          </CardRows>
          <Text variant="caption" tone="muted">
            Each paired computer sends these to this phone through Expo’s
            notification service, with the project and a short line of text.
          </Text>
        </Box>
        {message ? <ErrorState message={message} /> : null}
        {on && token.kind === 'denied' ? (
          <Button
            label="Open Settings"
            variant="tonal"
            onPress={() => void openNotificationSettings()}
          />
        ) : null}
        {on && computers.length > 0 ? (
          <Box>
            <GroupHeader variant="section" label="Computers" />
            <CardRows>
              {computers.map(({ remote, connection }) => (
                <ComputerRegistration
                  key={remote.environmentId}
                  connection={connection}
                  name={remote.name}
                  waiting={token.kind !== 'ready'}
                />
              ))}
            </CardRows>
          </Box>
        ) : null}
      </Box>
    </ScrollView>
  );
}
