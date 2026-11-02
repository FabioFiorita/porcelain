import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  deviceKind,
  devicePlatformName,
  type DeviceKind,
} from '../rules/settings';
import { relativeTime } from '@/shared/lib/relative-time';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlobeIcon, LinkIcon, SmartphoneIcon, TabletIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import {
  useRevokeAccess,
  useSetDeviceTrust,
  useSetWaysInPermission,
  useSetManagementPermission,
} from '../commands/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import {
  deviceRouteTitles,
  waysInPermissionShown,
  type PairedAccess,
} from '@porcelain/client/access/rules';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { type Connection } from '@/shared/workspace/connection';

const deviceIcons: Record<DeviceKind, ReactNode> = {
  phone: <SmartphoneIcon aria-hidden />,
  tablet: <TabletIcon aria-hidden />,
  browser: <GlobeIcon aria-hidden />,
};

export function PairedDevices({
  connection,
  access,
  disabled = false,
}: {
  connection: Connection;
  access: PairedAccess;
  disabled?: boolean;
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
            <ItemMedia variant="icon">
              {deviceIcons[deviceKind(device.platform)]}
            </ItemMedia>
            <ItemContent className="basis-48">
              <ItemTitle className="flex-wrap">
                {device.label}
                {device.current && (
                  <Badge variant="secondary">This device</Badge>
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
                <DeviceManagementControl
                  disabled={disabled}
                  connection={connection}
                  id={device.id}
                  label={device.label}
                  allowed={device.canManageSharing === true}
                />
                <DeviceTrustControl
                  disabled={disabled}
                  connection={connection}
                  id={device.id}
                  label={device.label}
                  trusted={device.trusted}
                />
                {!device.canManageSharing && waysInPermissionShown(device) && (
                  <WaysInPermissionControl
                    disabled={disabled}
                    connection={connection}
                    id={device.id}
                    label={device.label}
                    allowed={device.canEditWaysIn}
                  />
                )}
              </div>
              {!device.current && (
                <RevokeControl
                  disabled={disabled}
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
            <ItemMedia variant="icon">
              <LinkIcon aria-hidden />
            </ItemMedia>
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
                disabled={disabled}
                connection={connection}
                id={grant.id}
                label={grant.label}
                cancelLink
              />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      <p className="text-xs leading-4.5 text-muted-foreground">
        Each device has separate access. Revoking signs it out.
      </p>
      <Collapsible>
        <CollapsibleTrigger render={<Button size="sm" variant="ghost" />}>
          About device permissions
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="text-xs leading-4.5 text-muted-foreground">
            Sharing managers can pair devices, revoke access and configure ways
            in. Update permission is separate. Each credential works only
            through the way in it paired over. Pair again to add another way in.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function DeviceTrustControl({
  connection,
  id,
  label,
  trusted,
  disabled,
}: {
  connection: Connection;
  id: string;
  label: string;
  trusted: boolean;
  disabled: boolean;
}) {
  const [result, onChange] = useSetDeviceTrust(connection, id);
  return (
    <PermissionControl
      caption="Can update"
      name={`${label} can update Porcelain`}
      checked={trusted}
      result={result}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

function WaysInPermissionControl({
  connection,
  id,
  label,
  allowed,
  disabled,
}: {
  connection: Connection;
  id: string;
  label: string;
  allowed: boolean;
  disabled: boolean;
}) {
  const [result, onChange] = useSetWaysInPermission(connection, id);
  return (
    <PermissionControl
      caption="Can edit ways in"
      name={`${label} can edit ways in`}
      checked={allowed}
      result={result}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

function PermissionControl({
  caption,
  name,
  checked,
  result,
  disabled,
  onChange,
}: {
  caption: string;
  name: string;
  checked: boolean;
  result: AsyncResult.AsyncResult<unknown, unknown>;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <>
      <span aria-hidden className="text-xs text-muted-foreground">
        {caption}
      </span>
      <Switch
        aria-label={name}
        checked={checked}
        disabled={disabled || result.waiting}
        onCheckedChange={onChange}
      />
      {AsyncResult.isFailure(result) && (
        <Alert variant="destructive" className="col-span-2">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(result.cause))}
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
  disabled = false,
}: {
  connection: Connection;
  id: string;
  label: string;
  cancelLink: boolean;
  disabled?: boolean;
}) {
  const [revoke, revokeDevice] = useRevokeAccess(connection, id);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="ml-1"
        aria-label={
          cancelLink ? `Cancel the link for ${label}` : `Revoke ${label}`
        }
        disabled={disabled || revoke.waiting}
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

function DeviceManagementControl({
  connection,
  id,
  label,
  allowed,
  disabled,
}: {
  connection: Connection;
  id: string;
  label: string;
  allowed: boolean;
  disabled: boolean;
}) {
  const [result, onChange] = useSetManagementPermission(connection, id);
  return (
    <PermissionControl
      caption="Manage sharing"
      name={`${label} can manage sharing`}
      checked={allowed}
      result={result}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
