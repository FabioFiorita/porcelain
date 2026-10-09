import { Text } from '../../../components/ui/text';
import { Item } from '../../../components/ui/item';
import { Badge } from '../../../components/ui/badge';
import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import { Host, RNHostView } from '@expo/ui';
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
          <Item
            title={remote.name}
            trailing={<Badge label={label} variant="secondary" />}
          >
            {AsyncResult.isFailure(command.result) ? (
              <Text variant="ui" tone="destructive">
                {connectionErrorMessage(Cause.squash(command.result.cause))}
              </Text>
            ) : null}
          </Item>
        </RNHostView>
      </EnvironmentMenu>
    </Host>
  );
}
