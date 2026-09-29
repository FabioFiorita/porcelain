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
  if (!lan.enabled)
    return here
      ? `Turning it on listens on ${networkName(here)} only, and pauses on any other network.`
      : 'This computer is not on a local network right now.';
  if (lan.status.kind !== 'paused')
    return chosen
      ? `Listening on ${networkName(chosen)} only.`
      : 'Listening on this network only.';
  if (!here)
    return chosen
      ? `Paused: this computer is not on a local network. Porcelain listens again when it is back on ${networkName(chosen)}.`
      : 'Paused: this computer is not on a local network.';
  return chosen
    ? `Paused on this network. It was turned on for ${networkName(chosen)}, and listens again there, or here once you turn it on for this network.`
    : 'Paused on this network. It was turned on before Porcelain kept the network it was turned on for; turn it on for this network to listen here.';
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

export function routeFailure(
  route: RemoteRouteName,
  reason: Extract<RemoteRoute['status'], { kind: 'failed' }>['reason'],
): string {
  switch (reason) {
    case 'no-address':
      return route === 'tailnet'
        ? 'Tailscale is not connected on this computer.'
        : 'This computer is not on a local network.';
    case 'address-in-use':
      return 'Another program already listens on this port.';
    case 'address-unavailable':
      return 'This computer could not listen at its address.';
    case 'unreachable':
      return 'Nothing answered at this hostname. Check that cloudflared is running and routes it here.';
    case 'other-server':
      return 'Another server answered at this hostname.';
  }
}
