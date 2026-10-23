import { AsyncResult } from 'effect/reactivity';
import { connectionRoutes } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { useEnvironments } from '../store';
import { useRemoveDevelopmentCredential } from '../commands/development-credentials';
import { developmentPairingUrl } from '../api';

function RemoveCredential({
  deviceId,
  label,
}: {
  deviceId: string;
  label: string;
}) {
  const command = useRemoveDevelopmentCredential(deviceId);
  return (
    <Box gap={2}>
      <Button
        label={label}
        variant="outline"
        pending={command.result.waiting}
        onPress={command.remove}
      />
      {AsyncResult.isFailure(command.result) ? (
        <ErrorState message="Could not remove the fixture credential." />
      ) : null}
    </Box>
  );
}

export function DevelopmentCredentials() {
  const remotes = useEnvironments();
  if (!__DEV__ || !developmentPairingUrl) return null;
  return (
    <Box gap={2}>
      {remotes.flatMap((remote) =>
        connectionRoutes(remote).flatMap((route, index) =>
          route.deviceId && URL.parse(route.address)?.hostname === '10.0.2.2'
            ? [
                <RemoveCredential
                  key={route.deviceId}
                  deviceId={route.deviceId}
                  label={`Remove ${remote.name} ${index === 0 ? 'primary' : 'alternate'} fixture key`}
                />,
              ]
            : [],
        ),
      )}
    </Box>
  );
}
