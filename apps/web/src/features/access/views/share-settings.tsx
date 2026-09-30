import type { ReactNode } from 'react';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from '@/components/ui/item';
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
import { ServiceUpdateSettings } from './service-update';
import { PairDevice } from './pair-device';
import { PairedDevices } from './paired-devices';
import { RemoteRoutes } from './remote-routes';

function RemoteAccessGate({
  connection,
  children,
}: {
  connection: ShareConnection;
  children: (remote: RemoteAccess) => ReactNode;
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
  return children(remote.data);
}

function useDesktopConnection() {
  const connection = useAccessStore((state) => state.connection);
  return desktopShell ? connection : null;
}

export function ComputerSettings({
  environment,
}: {
  environment: Environment;
}) {
  const connection = useDesktopConnection();
  return (
    connection && (
      <>
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <EnvironmentName
                connection={connection}
                environment={environment}
              />
            </ItemContent>
          </Item>
        </ItemGroup>
        <FieldSet>
          <FieldLegend variant="label">Updates</FieldLegend>
          <ItemGroup>
            <Item variant="outline">
              <ItemContent>
                <ServiceUpdateSettings />
              </ItemContent>
            </Item>
          </ItemGroup>
        </FieldSet>
      </>
    )
  );
}

export function WaysInSettings() {
  const connection = useDesktopConnection();
  return (
    connection && (
      <RemoteAccessGate connection={connection}>
        {(remote) => <RemoteRoutes connection={connection} remote={remote} />}
      </RemoteAccessGate>
    )
  );
}

export function DevicesSettings({ environment }: { environment: Environment }) {
  const connection = useDesktopConnection();
  return (
    connection && (
      <RemoteAccessGate connection={connection}>
        {(remote) => (
          <>
            <FieldSet>
              <FieldLegend variant="label">Pair a device</FieldLegend>
              <ItemGroup>
                <Item variant="outline">
                  <ItemContent>
                    <ItemDescription>
                      Open the link or scan the code on the other device to
                      connect it to {environment.name}. Each link works once,
                      for a few minutes.
                    </ItemDescription>
                    <PairDevice connection={connection} remote={remote} />
                  </ItemContent>
                </Item>
              </ItemGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Paired devices</FieldLegend>
              <PairedDevices connection={connection} />
            </FieldSet>
          </>
        )}
      </RemoteAccessGate>
    )
  );
}
