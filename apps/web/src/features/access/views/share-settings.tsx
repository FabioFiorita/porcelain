import type { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { desktopShell } from '@/shared/shell';
import { useRemoteAccess } from '../queries/share';
import { connectionErrorMessage } from '../rules/connection-error-message';
import type {
  Environment,
  RemoteAccess,
  ShareConnection,
} from '../rules/share';
import { useAccessStore } from '../store';
import { EnvironmentName } from './environment-name';
import { PairDevice } from './pair-device';
import { PairedDevices } from './paired-devices';
import { RemoteRoutes } from './remote-routes';

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      {title && (
        <h3 className="px-1 text-sm font-medium text-foreground/70">{title}</h3>
      )}
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card *:px-4 *:py-3">
        {children}
      </div>
    </section>
  );
}

function ShareContent({
  connection,
  environment,
}: {
  connection: ShareConnection;
  environment: Environment;
}) {
  const remote = useRemoteAccess(connection);
  if (remote.managedElsewhere)
    return (
      <p className="text-xs text-muted-foreground">
        Sharing is managed from a browser on the computer that runs Porcelain.
      </p>
    );
  if (remote.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {connectionErrorMessage(remote.error)}
        </AlertDescription>
      </Alert>
    );
  if (!remote.data) return <Spinner />;
  return (
    <ShareSections
      connection={connection}
      environment={environment}
      remote={remote.data}
    />
  );
}

function ShareSections({
  connection,
  environment,
  remote,
}: {
  connection: ShareConnection;
  environment: Environment;
  remote: RemoteAccess;
}) {
  return (
    <>
      <Group>
        <EnvironmentName connection={connection} environment={environment} />
      </Group>
      <RemoteRoutes connection={connection} remote={remote} />
      <Group title="Pair a device">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Open the link or scan the code on the other device to connect it to{' '}
            {environment.name}. Each link works once, for a few minutes.
          </p>
          <PairDevice connection={connection} remote={remote} />
        </div>
      </Group>
      <Group title="Paired devices">
        <PairedDevices connection={connection} />
      </Group>
    </>
  );
}

export function ShareSettings({ environment }: { environment: Environment }) {
  const connection = useAccessStore((state) => state.connection);
  return (
    desktopShell &&
    connection && (
      <ShareContent connection={connection} environment={environment} />
    )
  );
}
