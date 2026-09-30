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
import { PairDevice } from './pair-device';
import { PairedDevices } from './paired-devices';
import { RemoteRoutes } from './remote-routes';

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
      <RemoteRoutes connection={connection} remote={remote} />
      <FieldSet>
        <FieldLegend variant="label">Pair a device</FieldLegend>
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <ItemDescription>
                Open the link or scan the code on the other device to connect it
                to {environment.name}. Each link works once, for a few minutes.
              </ItemDescription>
              <PairDevice connection={connection} remote={remote} />
            </ItemContent>
          </Item>
        </ItemGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Paired devices</FieldLegend>
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <PairedDevices connection={connection} />
            </ItemContent>
          </Item>
        </ItemGroup>
      </FieldSet>
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
