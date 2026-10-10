import { Text } from '../../../components/ui/text';
import { ItemMenu } from '../../../components/ui/item-menu';
import { Badge } from '../../../components/ui/badge';
import { AsyncResult } from 'effect/reactivity';
import { Cause } from 'effect';
import {
  connectionErrorMessage,
  remoteStatusNote,
  remoteStatusText,
  type Remote,
} from '@porcelain/client/access/rules';
import { useEnvironmentStatus } from '../queries/environments';
import { useForgetEnvironment } from '../commands/forget-environment';

export function EnvironmentRow({
  remote,
  disabled,
}: {
  remote: Remote;
  disabled: boolean;
}) {
  const { status, read } = useEnvironmentStatus(remote);
  const command = useForgetEnvironment(remote);
  const note =
    status.kind === 'offline'
      ? 'It did not answer. Check that it is running and that your device can reach its address.'
      : remoteStatusNote(status);
  return (
    <ItemMenu
      title={status.kind === 'online' ? status.name : remote.name}
      description={
        status.kind === 'online' && status.version
          ? `${remote.address} · Porcelain ${status.version}`
          : remote.address
      }
      trailing={
        <Badge
          label={remoteStatusText(status)}
          variant={status.kind === 'online' ? 'secondary' : 'outline'}
        />
      }
      actions={[
        {
          id: 'check',
          label: 'Check connection',
          disabled: status.kind === 'checking',
          onPress: read,
        },
        {
          id: 'forget',
          label: 'Forget environment',
          destructive: true,
          disabled: disabled || command.result.waiting,
          onPress: () => command.forget(),
        },
      ]}
    >
      {note ? (
        <Text variant="caption" tone="muted">
          {note}
        </Text>
      ) : null}
      {AsyncResult.isFailure(command.result) ? (
        <Text variant="ui" tone="destructive">
          {connectionErrorMessage(Cause.squash(command.result.cause))}
        </Text>
      ) : null}
    </ItemMenu>
  );
}
