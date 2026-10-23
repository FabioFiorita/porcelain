import { connectionRoutes } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { useEnvironments } from '../store';

export function ThisDevice() {
  const remotes = useEnvironments();
  const routes = remotes.flatMap((remote) =>
    connectionRoutes(remote).flatMap((route) =>
      route.deviceId ? [{ remote, route, deviceId: route.deviceId }] : [],
    ),
  );
  if (routes.length === 0) return null;
  return (
    <Box gap={3}>
      <Text variant="subheading" tone="muted">
        This device
      </Text>
      {routes.map(({ remote, route, deviceId }) => (
        <Box key={`${remote.environmentId}:${route.address}`} gap={1}>
          <Text variant="caption" tone="muted">
            On {remote.name}
            {(remote.alternateRoutes?.length ?? 0) > 0
              ? ` · ${route.address}`
              : ''}
          </Text>
          <Text
            selectable
            variant="code"
            tone="muted"
            accessibilityLabel={`Device ID on ${remote.name}: ${deviceId}. Touch and hold to copy.`}
          >
            {deviceId}
          </Text>
        </Box>
      ))}
      <Text variant="small" tone="muted">
        Touch and hold a device ID to copy.
      </Text>
    </Box>
  );
}
