import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import { Host, RNHostView } from '@expo/ui';
import { Text, View } from 'react-native';
import {
  connectionErrorMessage,
  type Remote,
} from '@porcelain/client/access/rules';
import { useEnvironmentStatus } from '../queries/environments';
import { useForgetEnvironment } from '../commands/forget-environment';
import { EnvironmentMenu } from './environment-menu';

export function EnvironmentRow({ remote }: { remote: Remote }) {
  const status = useEnvironmentStatus(remote);
  const description = Option.getOrUndefined(AsyncResult.value(status));
  const command = useForgetEnvironment(remote);
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
        isPending={command.result.waiting}
      >
        <RNHostView matchContents>
          <View className="w-full gap-1 px-4 py-3">
            <View className="flex-row items-center justify-between gap-4">
              <Text className="flex-1 text-base font-medium text-card-foreground">
                {remote.name}
              </Text>
              <Text className="text-xs text-muted-foreground">{label}</Text>
            </View>
            {AsyncResult.isFailure(command.result) ? (
              <Text className="text-sm text-destructive">
                {connectionErrorMessage(Cause.squash(command.result.cause))}
              </Text>
            ) : null}
          </View>
        </RNHostView>
      </EnvironmentMenu>
    </Host>
  );
}
