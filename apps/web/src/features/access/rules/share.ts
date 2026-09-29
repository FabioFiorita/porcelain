import {
  pairingLink,
  type IssuePairingResponse,
  type ReadRemoteAccessResponse,
} from '@porcelain/contracts/access';

export type ShareConnection = {
  environmentId: string;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
};

export type RemoteAccess = ReadRemoteAccessResponse;
export type RemoteRouteName = keyof RemoteAccess['routes'];
export type RemoteRoute = RemoteAccess['routes'][RemoteRouteName];
type PairingAddress = { route: RemoteRouteName; url: string };
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

export function linkAddresses(
  chosen: string,
  addresses: readonly PairingAddress[],
): string[] {
  return [
    chosen,
    ...addresses.map(({ url }) => url).filter((url) => url !== chosen),
  ];
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
