import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useRemoteAccess } from '../queries/share';
import { connectionErrorMessage } from '../rules/connection-error-message';
import type { ShareConnection } from '../rules/share';
import { useAccessStore } from '../store';
import { PairDevice } from './pair-device';
import { PairedDevices } from './paired-devices';
import { RemoteRoutes } from './remote-routes';

function ShareContent({ connection }: { connection: ShareConnection }) {
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
    <div className="flex flex-col gap-4">
      <RemoteRoutes connection={connection} remote={remote.data} />
      <Separator />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Pair a device</p>
        <p className="text-xs text-muted-foreground">
          Open the link or scan the code on the other device. Each link works
          once, for a few minutes.
        </p>
      </div>
      <PairDevice connection={connection} remote={remote.data} />
      <Separator />
      <p className="text-sm font-medium">Paired devices</p>
      <PairedDevices connection={connection} />
    </div>
  );
}

export function ShareSettings() {
  const connection = useAccessStore((state) => state.connection);
  return connection && <ShareContent connection={connection} />;
}
