import { Row, Text } from '@expo/ui';
import type { Remote } from '@porcelain/client/access/rules';
import { useEnvironmentStatus } from '../queries/environments';
import { useForgetEnvironment } from '../commands/forget-environment';
import { EnvironmentMenu } from './environment-menu';

export function EnvironmentRow({ remote }: { remote: Remote }) {
  const status = useEnvironmentStatus(remote);
  const command = useForgetEnvironment(remote);
  const label =
    status.data?.kind === 'online'
      ? 'Online'
      : status.data?.kind === 'needs-pairing'
        ? 'Needs pairing'
        : status.data?.kind === 'other-server'
          ? 'Another server'
          : status.data?.kind === 'incompatible'
            ? 'Update needed'
            : status.data?.kind === 'offline' || status.error
              ? 'Offline'
              : 'Checking';
  return (
    <EnvironmentMenu
      onForget={() => command.forget()}
      isPending={command.isPending}
    >
      <Row>
        <Text>{remote.name}</Text>
        <Text>{label}</Text>
        {command.error ? <Text>{command.error.message}</Text> : null}
      </Row>
    </EnvironmentMenu>
  );
}
