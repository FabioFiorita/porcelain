import {
  pairingLink,
  type IssuePairingResponse,
  type ListAccessResponse,
  type ReadRemoteAccessResponse,
  type RenameEnvironmentResponse,
} from '@porcelain/contracts/access';

export type ShareConnection = {
  environmentId: string;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
};

export type RemoteAccess = ReadRemoteAccessResponse;
export type Environment = RenameEnvironmentResponse;
export type RemoteRouteName = keyof RemoteAccess['routes'];
export type RemoteRoute = RemoteAccess['routes'][RemoteRouteName];
type PairingAddress = { route: RemoteRouteName; url: string };
type DeviceRoute = ListAccessResponse['devices'][number]['route'];
type IssuedLink = { label: string; link: string; expiresAt: string };

const remoteRouteNames: readonly RemoteRouteName[] = [
  'lan',
  'tailnet',
  'cloudflare',
];

export const remoteRouteTitles: Record<RemoteRouteName, string> = {
  lan: 'Local network',
  tailnet: 'Tailscale',
  cloudflare: 'Cloudflare tunnel',
};

export const deviceRouteTitles: Record<DeviceRoute, string> = {
  loopback: 'This computer',
  lan: 'Local network',
  tailnet: 'Tailscale',
  tunnel: 'Cloudflare tunnel',
};

type Network = NonNullable<RemoteAccess['localNetwork']>;

export function networkName(network: Network): string {
  return `${network.subnet} on ${network.interfaceName}`;
}

export function localNetworkNote(remote: RemoteAccess): string {
  const { lan } = remote.routes;
  const here = remote.localNetwork;
  const chosen = remote.lanNetwork;
  const unidentified =
    'Porcelain cannot tell this network from another one yet, because the hardware address of its router is not known.';
  if (!lan.enabled) {
    if (!here) return 'This computer is not on a local network right now.';
    return here.gatewayHardware
      ? `Turning it on listens on ${networkName(here)} only, and pauses on any other network.`
      : `${unidentified} Try again in a moment.`;
  }
  if (lan.status.kind !== 'paused')
    return chosen
      ? `Listening on ${networkName(chosen)} only.`
      : 'Listening on this network only.';
  if (!here)
    return chosen
      ? `Paused: this computer is not on a local network. Porcelain listens again when it is back on ${networkName(chosen)}.`
      : 'Paused: this computer is not on a local network.';
  if (!here.gatewayHardware) return `Paused. ${unidentified}`;
  if (!chosen)
    return 'Paused on this network. It was turned on before Porcelain kept the network it was turned on for; turn it on for this network to listen here.';
  if (networkName(chosen) === networkName(here))
    return `Paused on this network. It looks like ${networkName(chosen)}, but its router is another one, so this is another network; turn it on for this network to listen here.`;
  return `Paused on this network. It was turned on for ${networkName(chosen)}, and listens again there, or here once you turn it on for this network.`;
}

export function routesSettling(
  remote: RemoteAccess | null | undefined,
): boolean {
  if (!remote) return false;
  return remoteRouteNames.some((name) => {
    const route = remote.routes[name];
    return route.enabled
      ? route.status.kind === 'starting' || route.status.kind === 'off'
      : route.status.kind !== 'off';
  });
}

export function pairingAddresses(
  remote: RemoteAccess | undefined,
): PairingAddress[] {
  if (remote === undefined) return [];
  return remoteRouteNames.flatMap((route) => {
    const { status } = remote.routes[route];
    return status.kind === 'on'
      ? status.urls.map((url) => ({ route, url }))
      : [];
  });
}

export function issuedLink(issued: IssuePairingResponse): IssuedLink | null {
  const [first] = issued.grants;
  if (!first) return null;
  return {
    label: first.grant.label,
    link: pairingLink(first.link),
    expiresAt: first.grant.expiresAt,
  };
}

export function tailscaleServeCommand(target: string): string {
  return `tailscale serve --bg --https=443 ${target}`;
}

export function routeFailure(
  route: RemoteRouteName,
  reason: Extract<RemoteRoute['status'], { kind: 'failed' }>['reason'],
): string {
  const freshPort =
    'Your devices may reach that program instead of Porcelain: run tailscale serve --https=443 off now, then turn Tailscale off and on here to pick a free port and run the new command Porcelain names.';
  switch (reason) {
    case 'address-in-use':
      return route === 'tailnet'
        ? `Another program already listens on the port Tailscale forwards to. ${freshPort}`
        : 'Another program already listens on this port.';
    case 'address-unavailable':
      return route === 'tailnet'
        ? `Porcelain could not open the local listener Tailscale forwards to. ${freshPort}`
        : 'This computer could not listen at its address.';
    case 'unreachable':
      return route === 'tailnet'
        ? 'Nothing answered at this Tailscale name yet. Check that you ran the command below, that Tailscale is connected on this computer and uses MagicDNS, and that MagicDNS and HTTPS Certificates are on in the Tailscale admin console. Porcelain keeps checking.'
        : 'Nothing answered at this hostname. Check that cloudflared is running and routes it here.';
    case 'other-server':
      return route === 'tailnet'
        ? 'Another server answered at this Tailscale name. Run the command below so Tailscale forwards to this Porcelain; Porcelain keeps checking.'
        : 'Another server answered at this hostname.';
  }
}
