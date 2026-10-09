import { Text } from '../../../components/ui/text';
import { ItemMenu } from '../../../components/ui/item-menu';
import { Badge } from '../../../components/ui/badge';
import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import {
  connectionErrorMessage,
  type Remote,
} from '@porcelain/client/access/rules';
import { useEnvironmentStatus } from '../queries/environments';
import { useForgetEnvironment } from '../commands/forget-environment';

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
    <ItemMenu
      title={remote.name}
      trailing={<Badge label={label} variant="secondary" />}
      actions={[
        {
          id: 'forget',
          label: 'Forget environment',
          destructive: true,
          disabled: command.result.waiting,
          onPress: () => command.forget(),
        },
      ]}
    >
      {AsyncResult.isFailure(command.result) ? (
        <Text variant="ui" tone="destructive">
          {connectionErrorMessage(Cause.squash(command.result.cause))}
        </Text>
      ) : null}
    </ItemMenu>
  );
}
