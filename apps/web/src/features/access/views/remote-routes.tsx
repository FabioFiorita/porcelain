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
  localNetworkNote,
  networkName,
  remoteRouteTitles,
  routeFailure,
  tailscaleServeCommand,
  type RemoteAccess,
  type RemoteRoute,
  type RemoteRouteName,
} from '@porcelain/client/access/rules';
import { type Connection } from '@/shared/workspace/connection';

const descriptions: Record<RemoteRouteName, string> = {
  lan: 'Phones and computers on the same Wi-Fi or wired network as this computer, on that one network only.',
  tailnet:
    'Your devices signed in to Tailscale, from anywhere, encrypted and over HTTPS at this computer’s Tailscale name. You set up tailscale serve once; Porcelain checks that it reaches here.',
  cloudflare:
    'Your own Cloudflare tunnel and hostname, over HTTPS from anywhere.',
};

const checkingLabels: Record<RemoteRouteName, string> = {
  lan: 'Starting',
  tailnet: 'Checking the Tailscale name',
  cloudflare: 'Checking the tunnel',
};

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
  if (status.kind === 'off')
    return route.enabled ? (
      <Badge variant="outline">
        <Spinner />
        Starting
      </Badge>
    ) : null;
  if (status.kind === 'starting')
    return (
      <Badge variant="outline">
        <Spinner />
        {checkingLabels[name]}
      </Badge>
    );
  if (status.kind === 'paused')
    return <Badge variant="outline">Paused on this network</Badge>;
  if (status.kind === 'failed')
    return <Badge variant="destructive">Failed</Badge>;
  return (
    <Badge variant="secondary">
      <span aria-hidden className="size-1.5 rounded-full bg-add-fg" />
      {route.enabled ? 'On' : 'Stopping'}
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
        {descriptions[name]}
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
                className="size-5 rounded-sm text-muted-foreground"
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
  onChange,
  setup,
  note,
  children,
}: {
  name: RemoteRouteName;
  route: RemoteRoute;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  setup?: { configured: boolean; open: boolean };
  note?: string;
  children?: ReactNode;
}) {
  const title = remoteRouteTitles[name];
  const encrypted = name !== 'lan' || route.status.kind !== 'on';
  return (
    <Collapsible
      defaultOpen={setup?.open ?? false}
      render={<Item variant="outline" className="min-h-14 gap-x-4 gap-y-2" />}
    >
      <ItemContent>
        <ItemTitle className="flex-wrap gap-x-2 gap-y-1">
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
        {setup && (
          <CollapsibleTrigger
            render={
              <Button
                size="sm"
                variant={setup.configured ? 'ghost' : 'outline'}
                className="group/setup rounded-md px-2.5 text-xs"
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
          disabled={disabled}
          onCheckedChange={(enabled) => onChange(enabled)}
        />
      </ItemActions>
      {children &&
        (setup ? (
          <CollapsibleContent className="basis-full">
            <div className="flex min-w-0 flex-col gap-2">{children}</div>
          </CollapsibleContent>
        ) : (
          <ItemFooter>
            <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
          </ItemFooter>
        ))}
    </Collapsible>
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
          className="self-start rounded-md px-2.5 text-xs"
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
      <Alert
        role="note"
        aria-label="Local network warning"
        className="gap-1.5 rounded-xl border-warn-border bg-warn-soft px-3 pt-2.75 pb-3 text-warn lg:absolute lg:top-7 lg:left-full lg:ml-8 lg:w-62"
      >
        <span
          aria-hidden
          className="absolute top-6.5 -left-6.5 hidden size-1.5 rounded-full bg-warn lg:block"
        />
        <span
          aria-hidden
          className="absolute top-7.25 -left-5 hidden h-px w-5 bg-warn-border lg:block"
        />
        <AlertTitle className="flex items-center gap-1.5 text-xs leading-4 font-semibold">
          <ShieldAlertIcon aria-hidden className="size-3.5" />
          Not encrypted
        </AlertTitle>
        <AlertDescription className="text-xs leading-4.5 text-foreground-2">
          Anyone on the same network can read what Porcelain shows and the
          device credentials it sends. For an encrypted connection, use
          Tailscale.
        </AlertDescription>
      </Alert>
    </>
  );
}

function HostnameForm({
  label,
  saveLabel,
  placeholder,
  saved,
  failed,
  disabled,
  onSave,
  onCheck,
}: {
  label: string;
  saveLabel: string;
  placeholder: string;
  saved: string;
  failed: boolean;
  disabled: boolean;
  onSave: (hostname: string) => void;
  onCheck: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const hostname = draft ?? saved;
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) =>
        submitForm(event, async () => {
          onSave(hostname.trim());
          setDraft(null);
        })
      }
    >
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={hostname}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        type="submit"
        variant="outline"
        className="shrink-0 rounded-md text-ui"
        disabled={
          disabled || hostname.trim() === '' || hostname.trim() === saved
        }
      >
        {saveLabel}
      </Button>
      {failed && (
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-md text-ui"
          disabled={disabled}
          onClick={onCheck}
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
  onSave,
  onCheck,
}: {
  remote: RemoteAccess;
  disabled: boolean;
  onSave: (hostname: string) => void;
  onCheck: () => void;
}) {
  const tailnet = remote.routes.tailnet;
  const command =
    remote.tailnetTarget === undefined
      ? undefined
      : tailscaleServeCommand(remote.tailnetTarget);
  return (
    <div className="flex flex-col gap-2">
      <HostnameForm
        label="Tailscale name"
        saveLabel="Save name"
        placeholder="laptop.tail1234.ts.net"
        saved={remote.tailnetHostname ?? ''}
        failed={tailnet.enabled && tailnet.status.kind === 'failed'}
        disabled={disabled}
        onSave={onSave}
        onCheck={onCheck}
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
  onSave,
  onCheck,
}: {
  remote: RemoteAccess;
  disabled: boolean;
  onSave: (hostname: string) => void;
  onCheck: () => void;
}) {
  const cloudflare = remote.routes.cloudflare;
  return (
    <div className="flex flex-col gap-2">
      <HostnameForm
        label="Public hostname"
        saveLabel="Save hostname"
        placeholder="porcelain.example.com"
        saved={remote.cloudflareHostname ?? ''}
        failed={cloudflare.enabled && cloudflare.status.kind === 'failed'}
        disabled={disabled}
        onSave={onSave}
        onCheck={onCheck}
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
  const [change, setRemote] = useSetRemoteAccess(connection);
  const disabled = change.waiting;
  return (
    <>
      <ItemGroup>
        <RouteRow
          name="lan"
          route={remote.routes.lan}
          note={localNetworkNote(remote)}
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
          disabled={disabled || remote.tailnetHostname === undefined}
          onChange={(tailnet) => setRemote({ tailnet })}
        >
          <TailnetSettings
            remote={remote}
            disabled={disabled}
            onSave={(tailnetHostname) =>
              setRemote({
                tailnetHostname,
                ...(remote.tailnetHostname === undefined
                  ? { tailnet: true }
                  : {}),
              })
            }
            onCheck={() => setRemote({ tailnet: true })}
          />
        </RouteRow>
        <RouteRow
          name="cloudflare"
          route={remote.routes.cloudflare}
          setup={{
            configured: remote.cloudflareHostname !== undefined,
            open: remote.routes.cloudflare.status.kind === 'failed',
          }}
          disabled={disabled || remote.cloudflareHostname === undefined}
          onChange={(cloudflare) => setRemote({ cloudflare })}
        >
          <TunnelSettings
            remote={remote}
            disabled={disabled}
            onSave={(cloudflareHostname) =>
              setRemote({
                cloudflareHostname,
                ...(remote.cloudflareHostname === undefined
                  ? { cloudflare: true }
                  : {}),
              })
            }
            onCheck={() => setRemote({ cloudflare: true })}
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
