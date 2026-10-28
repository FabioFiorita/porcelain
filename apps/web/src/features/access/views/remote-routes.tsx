import { TruncatedText } from '@/shared/views/truncated-text';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { CopyIcon, ShieldAlertIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { copyText } from '@/shared/workspace/copy';
import { submitForm } from '@/shared/lib/submit-form';
import { useSetRemoteAccess } from '../commands/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import {
  LOCAL_NETWORK_WARNING,
  hostnameForm,
  localNetworkNote,
  networkName,
  protectedRouteNote,
  remoteRouteDescriptions,
  remoteRouteTitles,
  routeFailure,
  routeStatusLabel,
  tailscaleServeCommand,
  type HostnameFormInput,
  type RemoteAccess,
  type RemoteAccessChange,
  type RemoteRoute,
  type RemoteRouteName,
} from '@porcelain/client/access/rules';
import { type Connection } from '@/shared/workspace/connection';

function RouteStatus({
  name,
  route,
}: {
  name: RemoteRouteName;
  route: RemoteRoute;
}) {
  const { status } = route;
  const label = routeStatusLabel(name, route);
  if (label === null) return null;
  if (status.kind === 'off' || status.kind === 'starting')
    return (
      <Badge variant="outline">
        <Spinner />
        {label}
      </Badge>
    );
  if (status.kind === 'paused') return <Badge variant="outline">{label}</Badge>;
  if (status.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="destructive">{label}</Badge>
        <p className="text-xs text-muted-foreground">
          {routeFailure(name, status.reason)}
        </p>
      </div>
    );
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="secondary">{label}</Badge>
      {status.urls.map((url) => (
        <div key={url} className="flex max-w-full items-center gap-1">
          <TruncatedText
            className="font-mono text-xs text-muted-foreground"
            text={url}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Copy ${url}`}
                  onClick={() => copyText(url, 'address')}
                >
                  <CopyIcon />
                </Button>
              }
            />
            <TooltipContent
              role="tooltip"
              className="break-all"
            >{`Copy ${url}`}</TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}

function RouteRow({
  name,
  route,
  disabled,
  connectedThrough,
  onChange,
  children,
}: {
  name: RemoteRouteName;
  route: RemoteRoute;
  disabled: boolean;
  connectedThrough: boolean;
  onChange: (enabled: boolean) => void;
  children?: ReactNode;
}) {
  const title = remoteRouteTitles[name];
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{remoteRouteDescriptions[name]}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Switch
          aria-label={title}
          checked={route.enabled}
          disabled={disabled || connectedThrough}
          onCheckedChange={(enabled) => onChange(enabled)}
        />
      </ItemActions>
      <ItemFooter>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <RouteStatus name={name} route={route} />
          {connectedThrough ? (
            <p className="text-xs text-muted-foreground">
              {protectedRouteNote(name)}
            </p>
          ) : (
            children
          )}
        </div>
      </ItemFooter>
    </Item>
  );
}

function LocalNetworkSettings({
  remote,
  disabled,
  onTurnOn,
}: {
  remote: RemoteAccess;
  disabled: boolean;
  onTurnOn: () => void;
}) {
  const { lan } = remote.routes;
  const here = remote.localNetwork;
  const paused = lan.enabled && lan.status.kind === 'paused';
  return (
    <div className="flex flex-col gap-2">
      {paused && here && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={disabled}
          onClick={onTurnOn}
        >
          Turn on for {networkName(here)}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {localNetworkNote(remote)}
      </p>
      <Alert role="note" aria-label="Local network warning">
        <ShieldAlertIcon />
        <AlertTitle>Not encrypted</AlertTitle>
        <AlertDescription>{LOCAL_NETWORK_WARNING}</AlertDescription>
      </Alert>
    </div>
  );
}

function HostnameForm({
  route,
  remote,
  disabled,
  onChange,
}: HostnameFormInput) {
  const [draft, setDraft] = useState<string | null>(null);
  const form = hostnameForm(remote, route, draft);
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) =>
        submitForm(event, async () => {
          onChange(form.save);
          setDraft(null);
        })
      }
    >
      <Input
        aria-label={form.label}
        placeholder={form.placeholder}
        value={form.value}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        type="submit"
        variant="outline"
        className="shrink-0"
        disabled={disabled || !form.canSave}
      >
        {form.saveLabel}
      </Button>
      {form.failed && (
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={disabled}
          onClick={() => onChange(form.check)}
        >
          Check again
        </Button>
      )}
    </form>
  );
}

function TailnetSettings({
  remote,
  disabled,
  onChange,
}: {
  remote: RemoteAccess;
  disabled: boolean;
  onChange: (change: RemoteAccessChange) => void;
}) {
  const tailnet = remote.routes.tailnet;
  const command =
    remote.tailnetTarget === undefined
      ? undefined
      : tailscaleServeCommand(remote.tailnetTarget);
  return (
    <div className="flex flex-col gap-2">
      <HostnameForm
        route="tailnet"
        remote={remote}
        disabled={disabled}
        onChange={onChange}
      />
      {remote.tailnetHostname === undefined && (
        <p className="text-xs text-muted-foreground">
          Save this computer’s name on your tailnet, as tailscale status or the
          Tailscale admin console shows it, to turn this on. Porcelain then
          names the one command to run.
        </p>
      )}
      {remote.tailnetHostname !== undefined && !tailnet.enabled && (
        <p className="text-xs text-muted-foreground">
          If you set up tailscale serve for Porcelain, remove it with tailscale
          serve --https=443 off, or Tailscale keeps forwarding to a port
          Porcelain no longer holds.
        </p>
      )}
      {command !== undefined && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Run this once on this computer. Tailscale keeps it across restarts;
            remove it with tailscale serve --https=443 off.
          </p>
          <div className="flex max-w-full items-center gap-1">
            <TruncatedText
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
              render={<code />}
              text={command}
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Copy the tailscale serve command"
                    onClick={() => copyText(command, 'command')}
                  >
                    <CopyIcon />
                  </Button>
                }
              />
              <TooltipContent role="tooltip" className="break-all">
                Copy the tailscale serve command
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}

function TunnelSettings({
  remote,
  disabled,
  onChange,
}: {
  remote: RemoteAccess;
  disabled: boolean;
  onChange: (change: RemoteAccessChange) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <HostnameForm
        route="cloudflare"
        remote={remote}
        disabled={disabled}
        onChange={onChange}
      />
      <p className="text-xs text-muted-foreground">
        In Cloudflare, publish this hostname from your tunnel to{' '}
        <span className="font-mono">{remote.serviceUrl}</span>, and run
        cloudflared on this computer as a service. Porcelain answers to the
        hostname only while this is on.
      </p>
    </div>
  );
}

export function RemoteRoutes({
  connection,
  remote,
}: {
  connection: Connection;
  remote: RemoteAccess;
}) {
  const [change, save] = useSetRemoteAccess(connection);
  const disabled = change.waiting;
  const connectedThrough = (name: RemoteRouteName) =>
    remote.editing.protectedRoute === name;
  const setRemote = (edit: RemoteAccessChange) =>
    save({ expected: remote.editing.fingerprint, change: edit });
  return (
    <>
      <ItemGroup>
        <RouteRow
          name="lan"
          route={remote.routes.lan}
          connectedThrough={connectedThrough('lan')}
          disabled={
            disabled ||
            (!remote.routes.lan.enabled && remote.localNetwork === undefined)
          }
          onChange={(lan) => setRemote({ lan })}
        >
          <LocalNetworkSettings
            remote={remote}
            disabled={disabled}
            onTurnOn={() => setRemote({ lan: true })}
          />
        </RouteRow>
        <RouteRow
          name="tailnet"
          route={remote.routes.tailnet}
          connectedThrough={connectedThrough('tailnet')}
          disabled={disabled || remote.tailnetHostname === undefined}
          onChange={(tailnet) => setRemote({ tailnet })}
        >
          <TailnetSettings
            remote={remote}
            disabled={disabled}
            onChange={setRemote}
          />
        </RouteRow>
        <RouteRow
          name="cloudflare"
          route={remote.routes.cloudflare}
          connectedThrough={connectedThrough('cloudflare')}
          disabled={disabled || remote.cloudflareHostname === undefined}
          onChange={(cloudflare) => setRemote({ cloudflare })}
        >
          <TunnelSettings
            remote={remote}
            disabled={disabled}
            onChange={setRemote}
          />
        </RouteRow>
      </ItemGroup>
      {AsyncResult.isFailure(change) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(change.cause))}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
