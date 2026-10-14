import { Text } from '../../../components/ui/text';
import { Box } from '../../../components/ui/box';
import { IconButton } from '../../../components/ui/icon-button';
import { Item } from '../../../components/ui/item';
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
  const { status } = useEnvironmentStatus(remote);
  const command = useForgetEnvironment(remote);
  const note = remoteStatusNote(status);
  return (
    <Item
      title={status.kind === 'online' ? status.name : remote.name}
      description={
        status.kind === 'online' && status.version
          ? `${remote.address} · Porcelain ${status.version}`
          : remote.address
      }
      trailing={
        <Box className="flex-row" gap={1}>
          <IconButton
            icon="trash"
            variant="destructive"
            accessibilityLabel="Forget environment"
            disabled={disabled}
            pending={command.result.waiting}
            onPress={() => command.forget()}
          />
        </Box>
      }
    >
      <Box className="flex-row">
        <Badge
          label={remoteStatusText(status)}
          variant={status.kind === 'online' ? 'secondary' : 'outline'}
        />
      </Box>
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
    </Item>
  );
}
