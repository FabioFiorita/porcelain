import { useAtomRef } from '@effect/atom-react';
import { Cause } from 'effect';
import { AsyncResult, type AtomRef } from 'effect/reactivity';
import {
  connectionRoutes,
  connectionRouteTitle,
  connectionErrorMessage,
  type Remote,
  type ConnectionRoute,
} from '@porcelain/client/access/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { useManageConnection } from '../commands/pairing';
import { PairEnvironmentForm } from './pair-environment-form';

function ActiveRoute({
  state,
  address,
}: {
  state: AtomRef.ReadonlyRef<ConnectionRoute | undefined>;
  address: string;
}) {
  const active = useAtomRef(state);
  return active?.address === address ? (
    <Badge label="Active" variant="secondary" />
  ) : null;
}

export function EnvironmentConnections({
  remote,
  disabled,
  adding,
  setAdding,
}: {
  remote: Remote;
  disabled: boolean;
  adding: boolean;
  setAdding: (value: boolean) => void;
}) {
  const command = useManageConnection(remote.environmentId);
  const connections = useAtomRef(remoteConnectionState);
  const connection = connections.find(
    (entry) => entry.remote.environmentId === remote.environmentId,
  )?.connection;
  const routes = connectionRoutes(remote);
  const unavailable = disabled || command.result.waiting || adding;
  return (
    <Box gap={3}>
      <Text variant="caption" tone="muted">
        Connections are tried in this order when reconnecting. A healthy
        connection stays in use.
      </Text>
      {routes.map((route, index) => (
        <Box key={route.address} gap={2}>
          <Box className="flex-row flex-wrap items-center" gap={2}>
            <Text variant="ui" weight="medium">
              {connectionRouteTitle(route.address)}
            </Text>
            {index === 0 ? <Badge label="Preferred" variant="outline" /> : null}
            {connection?.activeRoute ? (
              <ActiveRoute
                state={connection.activeRoute}
                address={route.address}
              />
            ) : null}
          </Box>
          <Text variant="caption" tone="muted">
            {route.address}
          </Text>
          <Box className="flex-row flex-wrap" gap={2}>
            {index > 0 ? (
              <Button
                variant="outline"
                label="Prefer"
                accessibilityLabel={`Prefer connection ${route.address}`}
                disabled={unavailable}
                onPress={() =>
                  command.run({ address: route.address, kind: 'prefer' })
                }
              />
            ) : null}
            <Button
              variant="ghost"
              label="Remove connection"
              accessibilityLabel={`Remove connection ${route.address}`}
              disabled={unavailable || routes.length === 1}
              onPress={() =>
                command.run({ address: route.address, kind: 'remove' })
              }
            />
          </Box>
        </Box>
      ))}
      {routes.length === 1 ? (
        <Text variant="caption" tone="muted">
          Use Forget computer to remove the last connection.
        </Text>
      ) : null}
      {AsyncResult.isFailure(command.result) ? (
        <Text accessibilityRole="alert" variant="ui" tone="destructive">
          {connectionErrorMessage(Cause.squash(command.result.cause))}
        </Text>
      ) : null}
      {adding ? (
        <PairEnvironmentForm
          environmentId={remote.environmentId}
          onClose={() => setAdding(false)}
        />
      ) : (
        <Button
          variant="outline"
          label="Add connection"
          disabled={unavailable}
          onPress={() => setAdding(true)}
        />
      )}
    </Box>
  );
}
