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
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { ChevronDownIcon, CopyIcon, ShieldAlertIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

const reachNotes: Record<RemoteRouteName, string | undefined> = {
  lan: undefined,
  tailnet: 'Encrypted, from anywhere',
  cloudflare: 'Encrypted, from anywhere',
};

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
    return <Badge variant="destructive">{label}</Badge>;
  return (
    <Badge variant="secondary">
      <span aria-hidden className="size-1.5 rounded-full bg-add-fg" />
      {label}
    </Badge>
  );
}

function RouteReach({
  name,
  route,
  note,
}: {
  name: RemoteRouteName;
  route: RemoteRoute;
  note: string | undefined;
}) {
  const { status } = route;
  if (status.kind === 'failed')
    return (
      <p className="text-xs leading-4.5 text-muted-foreground">
        {routeFailure(name, status.reason)}
      </p>
    );
  if (status.kind !== 'on' || status.urls.length === 0)
    return (
      <p className="text-xs leading-4.5 text-muted-foreground">
        {remoteRouteDescriptions[name]}
      </p>
    );
  return status.urls.map((url) => (
    <div
      key={url}
      className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs leading-4.5 text-muted-foreground"
    >
      <span className="flex min-w-0 max-w-full items-center gap-1">
        <TruncatedText className="font-mono text-foreground-2" text={url} />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-5"
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
      </span>
      {(note ?? reachNotes[name]) && <span>{note ?? reachNotes[name]}</span>}
    </div>
  ));
}

function RouteRow({
  name,
  route,
  disabled,
  connectedThrough,
  onChange,
  setup,
  note,
  children,
}: {
  name: RemoteRouteName;
  route: RemoteRoute;
  disabled: boolean;
  connectedThrough: boolean;
  onChange: (enabled: boolean) => void;
  setup?: { configured: boolean; open: boolean };
  note?: string;
  children?: ReactNode;
}) {
  const title = remoteRouteTitles[name];
  const [open, setOpen] = useState(false);
  const encrypted = name !== 'lan' || route.status.kind !== 'on';
  return (
    <Item variant="outline">
      <Collapsible
        open={open || (setup?.open ?? false)}
        onOpenChange={setOpen}
        className="contents"
      >
        <ItemContent>
          <ItemTitle className="flex-wrap">
            {title}
            <RouteStatus name={name} route={route} />
            {!encrypted && (
              <span className="flex items-center gap-1 text-xs leading-4 font-medium text-warn">
                <ShieldAlertIcon aria-hidden className="size-3.5" />
                Not encrypted
              </span>
            )}
          </ItemTitle>
          <RouteReach name={name} route={route} note={note} />
        </ItemContent>
        <ItemActions>
          {setup && !connectedThrough && (
            <CollapsibleTrigger
              render={
                <Button
                  size="sm"
                  variant={setup.configured ? 'ghost' : 'outline'}
                  aria-label={
                    setup.configured ? `${title} setup` : `Set up ${title}`
                  }
                  className="group/setup"
                />
              }
            >
              {setup.configured ? 'Setup' : 'Set up'}
              {setup.configured && (
                <ChevronDownIcon
                  aria-hidden
                  className="size-3.5 text-muted-foreground transition-transform group-data-panel-open/setup:rotate-180"
                />
              )}
            </CollapsibleTrigger>
          )}
          <Switch
            aria-label={title}
            checked={route.enabled}
            disabled={disabled || connectedThrough}
            onCheckedChange={(enabled) => onChange(enabled)}
          />
        </ItemActions>
        {connectedThrough ? (
          <ItemFooter>
            <p className="text-xs leading-4.5 text-muted-foreground">
              {protectedRouteNote(name)}
            </p>
          </ItemFooter>
        ) : (
          children &&
          (setup ? (
            <CollapsibleContent className="basis-full">
              <div className="flex min-w-0 flex-col gap-2">{children}</div>
            </CollapsibleContent>
          ) : (
            <ItemFooter>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {children}
              </div>
            </ItemFooter>
          ))
        )}
      </Collapsible>
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
    <>
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
      {lan.status.kind !== 'on' && (
        <p className="text-xs leading-4.5 text-muted-foreground">
          {localNetworkNote(remote)}
        </p>
      )}
      <div className="settings-margin-note lg:absolute lg:top-0 lg:left-full lg:ml-8 lg:w-62">
        <span
          aria-hidden
          className="absolute top-6.5 -left-6.5 hidden size-1.5 rounded-full bg-warn lg:block"
        />
        <span
          aria-hidden
          className="absolute top-7.25 -left-5 hidden h-px w-5 bg-warn-border lg:block"
        />
        <Alert role="note" aria-label="Local network warning">
          <AlertTitle>
            <ShieldAlertIcon aria-hidden />
            Not encrypted
          </AlertTitle>
          <AlertDescription>{LOCAL_NETWORK_WARNING}</AlertDescription>
        </Alert>
      </div>
    </>
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
          note={localNetworkNote(remote)}
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
          setup={{
            configured: remote.tailnetHostname !== undefined,
            open: remote.routes.tailnet.status.kind === 'failed',
          }}
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
          setup={{
            configured: remote.cloudflareHostname !== undefined,
            open: remote.routes.cloudflare.status.kind === 'failed',
          }}
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
