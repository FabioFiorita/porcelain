import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
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
  const answer = Option.getOrUndefined(AsyncResult.value(access));
  if (AsyncResult.isFailure(access))
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {connectionErrorMessage(Cause.squash(access.cause))}
        </AlertDescription>
      </Alert>
    );
  if (!answer) return <Spinner />;
  return (
    <div className="flex flex-col gap-2">
      <ItemGroup role="list" aria-label="Paired devices and links">
        {answer.devices.map((device) => (
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
              <DeviceTrustControl
                connection={connection}
                id={device.id}
                label={device.label}
                trusted={device.trusted}
              />
              {!device.current && (
                <RevokeControl
                  connection={connection}
                  id={device.id}
                  label={device.label}
                  cancelLink={false}
                />
              )}
            </ItemActions>
          </Item>
        ))}
        {answer.grants.map((grant) => (
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
              <RevokeControl
                connection={connection}
                id={grant.id}
                label={grant.label}
                cancelLink
              />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
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

function DeviceTrustControl({
  connection,
  id,
  label,
  trusted,
}: {
  connection: Connection;
  id: string;
  label: string;
  trusted: boolean;
}) {
  const [trust, setTrusted] = useSetDeviceTrust(connection, id);
  return (
    <>
      <Label aria-hidden>Can update</Label>
      <Switch
        aria-label={`${label} can update Porcelain`}
        checked={trusted}
        disabled={trust.waiting}
        onCheckedChange={setTrusted}
      />
      {AsyncResult.isFailure(trust) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(trust.cause))}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
function RevokeControl({
  connection,
  id,
  label,
  cancelLink,
}: {
  connection: Connection;
  id: string;
  label: string;
  cancelLink: boolean;
}) {
  const [revoke, revokeDevice] = useRevokeAccess(connection, id);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        aria-label={
          cancelLink ? `Cancel the link for ${label}` : `Revoke ${label}`
        }
        disabled={revoke.waiting}
        onClick={() => revokeDevice()}
      >
        {cancelLink ? 'Cancel' : 'Revoke'}
      </Button>
      {AsyncResult.isFailure(revoke) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(revoke.cause))}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
