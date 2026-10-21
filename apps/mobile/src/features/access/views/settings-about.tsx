import { osName } from 'expo-device';
import { connectionRoutes } from '@porcelain/client/access/rules';
import { mobileVersion } from '../../../shared/adapters/app-version';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { useEnvironments } from '../store';

export function SettingsAbout() {
  const remotes = useEnvironments();
  return (
    <Box gap={2} padding={4}>
      <Text variant="caption" tone="muted" className="text-center">
        Porcelain for {osName ?? 'mobile'} {mobileVersion}
      </Text>
      {remotes.flatMap((remote) =>
        connectionRoutes(remote).map((route) =>
          route.deviceId ? (
            <Box key={`${remote.environmentId}:${route.address}`} gap={1}>
              <Text variant="small" tone="muted" className="text-center">
                This device on {remote.name}
                {(remote.alternateRoutes?.length ?? 0) > 0
                  ? ` · ${route.address}`
                  : ''}
              </Text>
              <Text
                selectable
                variant="code"
                tone="muted"
                className="text-center"
                accessibilityLabel={`Device ID on ${remote.name}: ${route.deviceId}. Touch and hold to copy.`}
              >
                {route.deviceId}
              </Text>
            </Box>
          ) : null,
        ),
      )}
      {remotes.length > 0 ? (
        <Text variant="small" tone="muted" className="text-center">
          Touch and hold a device ID to copy.
        </Text>
      ) : null}
    </Box>
  );
}
