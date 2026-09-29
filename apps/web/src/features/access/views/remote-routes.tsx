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
import { connectionErrorMessage } from '../rules/connection-error-message';
import {
  localNetworkNote,
  networkName,
  remoteRouteTitles,
  routeFailure,
  type RemoteAccess,
  type RemoteRoute,
  type RemoteRouteName,
  type ShareConnection,
} from '../rules/share';

const descriptions: Record<RemoteRouteName, string> = {
  lan: 'Phones and computers on the same Wi-Fi or wired network as this computer, on that one network only.',
  tailnet:
    'Your devices signed in to Tailscale, from anywhere, encrypted and over HTTPS at this computer’s Tailscale name. Porcelain runs tailscale serve for you while this is on.',
  cloudflare:
    'Your own Cloudflare tunnel and hostname, over HTTPS from anywhere.',
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
        {name === 'cloudflare' ? 'Checking the tunnel' : 'Starting'}
      </Badge>
    );
  if (status.kind === 'paused')
    return <Badge variant="outline">Paused on this network</Badge>;
  if (status.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="destructive">Failed</Badge>
        <p className="text-xs text-muted-foreground">
          {routeFailure(name, status.reason)}
        </p>
      </div>
    );
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="secondary">{route.enabled ? 'On' : 'Stopping'}</Badge>
      {status.urls.map((url) => (
        <div key={url} className="flex max-w-full items-center gap-1">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {url}
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Copy ${url}`}
            onClick={() => copyText(url, 'address')}
          >
            <CopyIcon />
          </Button>
        </div>
      ))}
    </div>
  );
}

function RouteRow({
  name,
  route,
  disabled,
  onChange,
  children,
}: {
  name: RemoteRouteName;
  route: RemoteRoute;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  children?: ReactNode;
}) {
  const title = remoteRouteTitles[name];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{descriptions[name]}</p>
        </div>
        <Switch
          aria-label={title}
          checked={route.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onChange(enabled)}
        />
      </div>
      <RouteStatus name={name} route={route} />
      {children}
    </div>
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
        <AlertDescription>
          Anyone on the same network can read what Porcelain shows and the
          device credentials it sends. For an encrypted connection, use
          Tailscale.
        </AlertDescription>
      </Alert>
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
  const saved = remote.cloudflareHostname ?? '';
  const [draft, setDraft] = useState<string | null>(null);
  const hostname = draft ?? saved;
  const cloudflare = remote.routes.cloudflare;
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
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
          aria-label="Public hostname"
          placeholder="porcelain.example.com"
          value={hostname}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          className="shrink-0"
          disabled={
            disabled || hostname.trim() === '' || hostname.trim() === saved
          }
        >
          Save hostname
        </Button>
        {cloudflare.enabled && cloudflare.status.kind === 'failed' && (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={disabled}
            onClick={onCheck}
          >
            Check again
          </Button>
        )}
      </form>
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
  connection: ShareConnection;
  remote: RemoteAccess;
}) {
  const change = useSetRemoteAccess(connection);
  const disabled = change.isPending;
  return (
    <div className="flex flex-col gap-4">
      <RouteRow
        name="lan"
        route={remote.routes.lan}
        disabled={
          disabled ||
          (!remote.routes.lan.enabled && remote.localNetwork === undefined)
        }
        onChange={(lan) => change.submit({ lan })}
      >
        <LocalNetworkSettings
          remote={remote}
          disabled={disabled}
          onTurnOn={() => change.submit({ lan: true })}
        />
      </RouteRow>
      <RouteRow
        name="tailnet"
        route={remote.routes.tailnet}
        disabled={disabled}
        onChange={(tailnet) => change.submit({ tailnet })}
      />
      <RouteRow
        name="cloudflare"
        route={remote.routes.cloudflare}
        disabled={disabled || remote.cloudflareHostname === undefined}
        onChange={(cloudflare) => change.submit({ cloudflare })}
      >
        <TunnelSettings
          remote={remote}
          disabled={disabled}
          onSave={(cloudflareHostname) =>
            change.submit({
              cloudflareHostname,
              ...(remote.cloudflareHostname === undefined
                ? { cloudflare: true }
                : {}),
            })
          }
          onCheck={() => change.submit({ cloudflare: true })}
        />
      </RouteRow>
      {change.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(change.error)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
