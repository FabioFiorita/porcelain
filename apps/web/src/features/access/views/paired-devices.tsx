import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { devicePlatformName } from '../rules/settings';
import { relativeTime } from '@/shared/lib/relative-time';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useRevokeAccess,
  useSetDeviceTrust,
  useSetWaysInPermission,
} from '../commands/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import {
  deviceRouteTitles,
  type PairedAccess,
} from '@porcelain/client/access/rules';
import { type Connection } from '@/shared/workspace/connection';

export function PairedDevices({
  connection,
  access,
}: {
  connection: Connection;
  access: PairedAccess;
}) {
  const answer = access;
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
            <ItemContent className="basis-48">
              <ItemTitle className="flex-wrap">
                {device.label}
                {device.current && (
                  <Badge variant="secondary">This browser</Badge>
                )}
                <Badge variant="outline">
                  {deviceRouteTitles[device.route]}
                </Badge>
              </ItemTitle>
              <ItemDescription>
                Last seen {relativeTime(device.lastSeenAt)} ·{' '}
                {devicePlatformName(device.platform)}
              </ItemDescription>
              {device.routeInferred && (
                <ItemDescription>
                  Paired before each device was tied to one way in, so it now
                  works only through {deviceRouteTitles[device.route]}, where it
                  was last seen. Pair it again to use another way in.
                </ItemDescription>
              )}
            </ItemContent>
            <ItemActions className="flex-wrap">
              <div className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-1.5">
                <DeviceTrustControl
                  connection={connection}
                  id={device.id}
                  label={device.label}
                  trusted={device.trusted}
                />
                {(device.route !== 'loopback' || device.canEditWaysIn) && (
                  <WaysInPermissionControl
                    connection={connection}
                    id={device.id}
                    label={device.label}
                    allowed={device.canEditWaysIn}
                  />
                )}
              </div>
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
        alone. A device that can edit ways in sees and changes the local
        network, Tailscale and Cloudflare tunnel settings from anywhere it is
        paired, except the way in it is connected through. A device paired
        through this computer’s own address has no such switch: it edits ways in
        only from this computer.
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
        <Alert variant="destructive" className="col-span-2">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(trust.cause))}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
function WaysInPermissionControl({
  connection,
  id,
  label,
  allowed,
}: {
  connection: Connection;
  id: string;
  label: string;
  allowed: boolean;
}) {
  const [permission, setAllowed] = useSetWaysInPermission(connection, id);
  return (
    <>
      <Label aria-hidden>Can edit ways in</Label>
      <Switch
        aria-label={`${label} can edit ways in`}
        checked={allowed}
        disabled={permission.waiting}
        onCheckedChange={setAllowed}
      />
      {AsyncResult.isFailure(permission) && (
        <Alert variant="destructive" className="col-span-2">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(permission.cause))}
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
