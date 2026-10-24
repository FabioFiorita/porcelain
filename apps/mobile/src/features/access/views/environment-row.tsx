import type { MissingCredentialRemote } from '@porcelain/client/access';
import { MissingCredentialRecovery } from './missing-credential-row';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
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
            ? `${remote.address} · Porcelain ${status.version}`
            : remote.address
        }
        trailing={
          missing ? undefined : (
            <Box className="flex-row" gap={1}>
              <IconButton
                icon="trash"
                variant="destructive"
                accessibilityLabel="Forget computer"
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
          <Text variant="ui" tone="destructive">
            {connectionErrorMessage(Cause.squash(command.result.cause))}
          </Text>
        ) : null}
      </Item>
      <Box paddingX={4} paddingY={3} gap={3}>
        <ComputerUpdate environmentId={remote.environmentId} />
        <Button
          variant="outline"
          label="This computer"
          accessibilityLabel={`Open This computer, ${remote.name}`}
          onPress={onOpenComputer}
          disabled={disabled || Boolean(missing)}
        />
        <Button
          variant="ghost"
          label={managing ? 'Hide connections' : 'Manage connections'}
          accessibilityLabel={`${managing ? 'Hide' : 'Manage'} connections for ${remote.name}`}
          onPress={() => setManaging(!managing)}
          disabled={disabled || adding}
        />
        {managing ? (
          <EnvironmentConnections
            remote={remote}
            disabled={disabled}
            adding={adding}
            setAdding={setAdding}
          />
        ) : null}
      </Box>
    </Box>
  );
}
