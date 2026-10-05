import { formatDistanceToNowStrict } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRevokeAccess, useSetDeviceTrust } from '../commands/share';
import { usePairedAccess } from '../queries/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { deviceRouteTitles } from '@porcelain/client/access/rules';
import { type Connection } from '@/shared/workspace/connection';

export function PairedDevices({ connection }: { connection: Connection }) {
  const access = usePairedAccess(connection);
  const revoke = useRevokeAccess(connection);
  const trust = useSetDeviceTrust(connection);
  if (access.isPending) return <Spinner />;
  if (access.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {connectionErrorMessage(access.error)}
        </AlertDescription>
      </Alert>
    );
  return (
    <div className="flex flex-col gap-2">
      <ItemGroup role="list" aria-label="Paired devices and links">
        {access.data.devices.map((device) => (
          <Item
            key={device.id}
            variant="outline"
            size="sm"
            role="listitem"
            aria-label={device.label}
          >
            <ItemContent className="min-w-0">
              <ItemTitle>
                {device.label}
                {device.current && (
                  <Badge variant="secondary">This browser</Badge>
                )}
                <Badge variant="outline">
                  {deviceRouteTitles[device.route]}
                </Badge>
              </ItemTitle>
              <ItemDescription>
                Last seen{' '}
                {formatDistanceToNowStrict(new Date(device.lastSeenAt), {
                  addSuffix: true,
                })}{' '}
                · {device.platform}
              </ItemDescription>
              {device.routeInferred && (
                <ItemDescription>
                  Paired before each device was tied to one way in, so it now
                  works only through {deviceRouteTitles[device.route]}, where it
                  was last seen. Pair it again to use another way in.
                </ItemDescription>
              )}
            </ItemContent>
            <ItemActions>
              <Label aria-hidden>Can update</Label>
              <Switch
                aria-label={`${device.label} can update Porcelain`}
                checked={device.trusted}
                disabled={trust.pendingId === device.id}
                onCheckedChange={(trusted) =>
                  trust.onSubmit({ id: device.id, trusted })
                }
              />
              {!device.current && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Revoke ${device.label}`}
                  disabled={revoke.pendingId === device.id}
                  onClick={() => revoke.onSubmit(device.id)}
                >
                  Revoke
                </Button>
              )}
            </ItemActions>
          </Item>
        ))}
        {access.data.grants.map((grant) => (
          <Item
            key={grant.id}
            variant="outline"
            size="sm"
            role="listitem"
            aria-label={grant.label}
          >
            <ItemContent className="min-w-0">
              <ItemTitle>
                {grant.label}
                <Badge variant="outline">Pending link</Badge>
              </ItemTitle>
              <ItemDescription>
                Works once, until{' '}
                {new Date(grant.expiresAt).toLocaleTimeString()}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Cancel the link for ${grant.label}`}
                disabled={revoke.pendingId === grant.id}
                onClick={() => revoke.onSubmit(grant.id)}
              >
                Cancel
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      {trust.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(trust.error)}
          </AlertDescription>
        </Alert>
      )}
      {revoke.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(revoke.error)}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">
        Each device has its own credential, which works only through the way in
        it was paired over, so a credential seen on one network cannot be used
        through another. A phone that uses two ways in is paired once through
        each. Revoking a device signs it out at once and leaves the others
        alone.
      </p>
    </div>
  );
}
