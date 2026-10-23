import { useState } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { MissingCredentialRemote } from '@porcelain/client/access';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { useForgetEnvironment } from '../commands/forget-environment';
import { PairEnvironmentForm } from './pair-environment-form';

export function MissingCredentialRecovery({
  remote,
  disabled,
}: {
  remote: MissingCredentialRemote;
  disabled: boolean;
}) {
  const [pairing, setPairing] = useState(false);
  const command = useForgetEnvironment(remote);
  return (
    <Box gap={2}>
      <Text variant="caption" tone="muted">
        A saved connection credential is missing. Pair that connection again.
        Your other connections are kept.
      </Text>
      {remote.routes.map((route) => (
        <Text key={route.address} variant="caption" tone="muted">
          {route.address}
        </Text>
      ))}
      {pairing ? (
        <PairEnvironmentForm
          environmentId={remote.environmentId}
          onClose={() => setPairing(false)}
        />
      ) : (
        <Box className="flex-row flex-wrap" gap={2}>
          <Button
            label="Pair again"
            variant="outline"
            disabled={disabled || command.result.waiting}
            onPress={() => setPairing(true)}
          />
          <Button
            label="Forget computer"
            variant="destructive"
            disabled={disabled}
            pending={command.result.waiting}
            onPress={() => command.forget()}
          />
        </Box>
      )}
      {AsyncResult.isFailure(command.result) ? (
        <ErrorState
          message={connectionErrorMessage(Cause.squash(command.result.cause))}
        />
      ) : null}
    </Box>
  );
}

export function MissingCredentialRow({
  remote,
  disabled,
}: {
  remote: MissingCredentialRemote;
  disabled: boolean;
}) {
  return (
    <Item
      title={remote.name}
      titleNumberOfLines={1}
      description="Needs pairing"
    >
      <MissingCredentialRecovery remote={remote} disabled={disabled} />
    </Item>
  );
}
