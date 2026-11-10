import type { MissingCredentialRemote } from '@porcelain/client/access';
import { MissingCredentialRecovery } from './missing-credential-row';
import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { Separator } from '../../../components/ui/separator';
import { ComputerUpdate } from './computer-update';
import { EnvironmentConnections } from './environment-connections';
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
  missing,
  onOpenComputer,
}: {
  remote: Remote;
  disabled: boolean;
  missing?: MissingCredentialRemote | undefined;
  onOpenComputer: () => void;
}) {
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const { status } = useEnvironmentStatus(remote);
  const command = useForgetEnvironment(remote);
  const note = remoteStatusNote(status);
  return (
    <Box>
      <Item
        title={status.kind === 'online' ? status.name : remote.name}
        description={
          status.kind === 'online' && status.version
            ? `${remote.address} · ${status.version}`
            : remote.address
        }
        trailing={
          missing ? undefined : (
            <Box className="flex-row" gap={1}>
              <IconButton
                icon="trash"
                variant="destructivePlain"
                accessibilityLabel={`Forget ${remote.name}`}
                disabled={disabled || adding}
                pending={command.result.waiting}
                onPress={() => command.forget()}
              />
            </Box>
          )
        }
      >
        <Box className="flex-row">
          <Badge
            label={missing ? 'Needs pairing' : remoteStatusText(status)}
            variant={
              !missing && status.kind === 'online' ? 'secondary' : 'outline'
            }
          />
        </Box>
        {missing ? (
          <MissingCredentialRecovery
            remote={missing}
            disabled={disabled || adding}
          />
        ) : null}
        {note ? (
          <Text variant="caption" tone="muted">
            {note}
          </Text>
        ) : null}
        {!missing && AsyncResult.isFailure(command.result) ? (
          <Text variant="secondary" tone="destructive">
            {connectionErrorMessage(Cause.squash(command.result.cause))}
          </Text>
        ) : null}
      </Item>
      <ComputerUpdate environmentId={remote.environmentId} />
      <Separator />
      <Item
        title="This computer"
        leading={<Icon name="laptop" tone="muted" />}
        trailing={<Icon name="chevron" tone="muted" />}
        accessibilityLabel={`Open This computer, ${remote.name}`}
        onPress={onOpenComputer}
        disabled={disabled || Boolean(missing)}
      />
      <Separator />
      <Item
        title={managing ? 'Hide connections' : 'Manage connections'}
        leading={<Icon name="sliders" tone="muted" />}
        trailing={<Icon name={managing ? 'collapse' : 'down'} tone="muted" />}
        accessibilityLabel={`${managing ? 'Hide' : 'Manage'} connections for ${remote.name}`}
        onPress={() => setManaging(!managing)}
        disabled={disabled || adding}
      />
      {managing ? (
        <Box paddingX={4} paddingY={2}>
          <EnvironmentConnections
            remote={remote}
            disabled={disabled}
            adding={adding}
            setAdding={setAdding}
          />
        </Box>
      ) : null}
    </Box>
  );
}
