import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
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
  const description = Option.getOrUndefined(AsyncResult.value(status));
  const command = useForgetEnvironment(remote, forgetProjectEnvironment);
  const label =
    description?.kind === 'online'
      ? 'Online'
      : description?.kind === 'needs-pairing'
        ? 'Needs pairing'
        : description?.kind === 'other-server'
          ? 'Another server'
          : description?.kind === 'incompatible'
            ? 'Update needed'
            : description?.kind === 'offline' || AsyncResult.isFailure(status)
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
