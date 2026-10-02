import { Host, RNHostView } from '@expo/ui';
import { Text, View } from 'react-native';
import type { Remote } from '@porcelain/client/access/rules';
import { useEnvironmentStatus } from '../queries/environments';
import {
  useForgetEnvironment,
  type ProjectCleanup,
} from '../commands/forget-environment';
import { EnvironmentMenu } from './environment-menu';

export function EnvironmentRow({
  remote,
  forgetProjectEnvironment,
}: {
  remote: Remote;
  forgetProjectEnvironment: ProjectCleanup;
}) {
  const status = useEnvironmentStatus(remote);
  const command = useForgetEnvironment(remote, forgetProjectEnvironment);
  const label =
    status.data?.kind === 'online'
      ? 'Online'
      : status.data?.kind === 'needs-pairing'
        ? 'Needs pairing'
        : status.data?.kind === 'other-server'
          ? 'Another server'
          : status.data?.kind === 'incompatible'
            ? 'Update needed'
            : status.data?.kind === 'offline' || status.error
              ? 'Offline'
              : 'Checking';
  return (
    <Host matchContents={{ vertical: true }}>
      <EnvironmentMenu
        onForget={() => command.forget()}
        isPending={command.isPending}
      >
        <RNHostView matchContents>
          <View className="w-full gap-1 px-4 py-3">
            <View className="flex-row items-center justify-between gap-4">
              <Text className="flex-1 text-base font-medium text-card-foreground">
                {remote.name}
              </Text>
              <Text className="text-xs text-muted-foreground">{label}</Text>
            </View>
            {command.error ? (
              <Text className="text-sm text-destructive">
                {command.error.message}
              </Text>
            ) : null}
          </View>
        </RNHostView>
      </EnvironmentMenu>
    </Host>
  );
}
