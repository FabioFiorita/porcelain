import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
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
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { Environment, RemoteAccess } from '@porcelain/client/access/rules';
import { useLocalConnection } from '../store';

import { useDesktopCapabilities } from '../queries/app-update';
import { EnvironmentName } from './environment-name';
import { ServiceUpdateSettings } from './service-update';
import { AppUpdateSettings } from './app-update';
import { PairDevice } from './pair-device';
import { PairedDevices } from './paired-devices';
import { RemoteRoutes } from './remote-routes';
import { type Connection } from '@/shared/workspace/connection';

function RemoteAccessGate({
  connection,
  children,
}: {
  connection: Connection;
  children: (remote: RemoteAccess) => ReactNode;
}) {
  const remote = useRemoteAccess(connection);
  const answer = Option.getOrUndefined(AsyncResult.value(remote));
  if (answer === null)
    return (
      <p className="text-xs text-muted-foreground">
        Sharing is managed from a browser on the computer that runs Porcelain.
      </p>
    );
  if (AsyncResult.isFailure(remote))
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {connectionErrorMessage(Cause.squash(remote.cause))}
        </AlertDescription>
      </Alert>
    );
  if (!answer) return <Spinner />;
  return children(answer);
}

function useDesktopConnection() {
  const connection = useLocalConnection();
  return desktopShell ? connection : null;
}

function UpdateSettings({ desktop }: { desktop: boolean | undefined }) {
  if (desktop === true) return <AppUpdateSettings />;
  if (desktop === false) return <ServiceUpdateSettings />;
  return <Spinner />;
}

export function ComputerSettings({
  environment,
}: {
  environment: Environment;
}) {
  const connection = useDesktopConnection();
  const desktop = Option.getOrUndefined(
    AsyncResult.value(useDesktopCapabilities()),
  );
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
                <UpdateSettings desktop={desktop?.isDesktopShell} />
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
