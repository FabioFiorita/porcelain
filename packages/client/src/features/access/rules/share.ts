import {
  pairingLink,
  type IssuePairingResponse,
  type ListAccessResponse,
  type ReadRemoteAccessResponse,
  type RemoteAccessChange,
  type RenameEnvironmentResponse,
} from '@porcelain/contracts/access';

export type RemoteAccess = ReadRemoteAccessResponse;
export type PairedAccess = ListAccessResponse;
export type { RemoteAccessChange };
export type Environment = RenameEnvironmentResponse;
export type RemoteRouteName = keyof RemoteAccess['routes'];
export type RemoteRoute = RemoteAccess['routes'][RemoteRouteName];
type PairingAddress = { route: RemoteRouteName; url: string };
type PairedDevice = ListAccessResponse['devices'][number];
type DeviceRoute = PairedDevice['route'];
type IssuedLink = {
  id: string;
  label: string;
  link: string;
  expiresAt: string;
};

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

export const remoteRouteDescriptions: Record<RemoteRouteName, string> = {
  lan: 'Phones and computers on the same Wi-Fi or wired network as this computer, on that one network only.',
  tailnet:
    'Your devices signed in to Tailscale, from anywhere, encrypted and over HTTPS at this computer’s Tailscale name. You set up tailscale serve once; Porcelain checks that it reaches here.',
  cloudflare:
    'Your own Cloudflare tunnel and hostname, over HTTPS from anywhere.',
};

export const deviceRouteTitles: Record<DeviceRoute, string> = {
  loopback: 'This computer',
  lan: 'Local network',
  tailnet: 'Tailscale',
  tunnel: 'Cloudflare tunnel',
};

export function protectedRouteNote(route: RemoteRouteName): string {
  return `This device is connected through ${remoteRouteTitles[route]}, so it cannot change it. Change it on the computer that runs Porcelain, or from a device connected another way.`;
}

export const LOCAL_NETWORK_WARNING =
  'Anyone on the same network can read what Porcelain shows and the device credentials it sends. For an encrypted connection, use Tailscale.';

export const ANDROID_EMULATOR_HOST = '10.0.2.2';
const LOOPBACK_IPV4 = /^127(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/;
const LOOPBACK_MAPPED_IPV6 = /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/;

function reachesOwnAddress(
  address: string,
  ownAliases: readonly string[],
): boolean {
  const hostname = new URL(address).hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '::1' ||
    ownAliases.includes(hostname) ||
    LOOPBACK_IPV4.test(hostname) ||
    LOOPBACK_MAPPED_IPV6.test(hostname)
  );
}

export function waysInPermissionShown(device: PairedDevice): boolean {
  return device.route !== 'loopback' || device.canEditWaysIn;
}

export function waysInRefusal(
  address: string,
  ownAliases: readonly string[] = [],
): string {
  return reachesOwnAddress(address, ownAliases)
    ? 'Ways in cannot be seen or changed over this connection, because it reaches the computer that runs Porcelain through that computer’s own address. Change them on that computer, or pair this device through the local network, Tailscale or a Cloudflare tunnel.'
    : 'This device cannot see or change ways in. An owner can let it in Paired devices, under Settings → Computers → This computer, in a browser on the computer that runs Porcelain.';
}

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
    id: first.grant.id,
    label: first.grant.label,
    link: pairingLink(first.link),
    expiresAt: first.grant.expiresAt,
  };
}

export function tailscaleServeCommand(target: string): string {
  return `tailscale serve --bg --https=443 ${target}`;
}

const checkingLabels: Record<RemoteRouteName, string> = {
  lan: 'Starting',
  tailnet: 'Checking the Tailscale name',
  cloudflare: 'Checking the tunnel',
};

export function routeStatusLabel(
  name: RemoteRouteName,
  route: RemoteRoute,
): string | null {
  switch (route.status.kind) {
    case 'off':
      return route.enabled ? 'Starting' : null;
    case 'starting':
      return checkingLabels[name];
    case 'paused':
      return 'Paused on this network';
    case 'failed':
      return 'Failed';
    case 'on':
      return route.enabled ? 'On' : 'Stopping';
  }
}

type HostedRouteName = Exclude<RemoteRouteName, 'lan'>;

const hostnameFields: Record<
  HostedRouteName,
  { label: string; saveLabel: string; placeholder: string }
> = {
  tailnet: {
    label: 'Tailscale name',
    saveLabel: 'Save name',
    placeholder: 'laptop.tail1234.ts.net',
  },
  cloudflare: {
    label: 'Public hostname',
    saveLabel: 'Save hostname',
    placeholder: 'porcelain.example.com',
  },
};

function savedHostname(remote: RemoteAccess, route: HostedRouteName): string {
  return (
    (route === 'tailnet'
      ? remote.tailnetHostname
      : remote.cloudflareHostname) ?? ''
  );
}

function routeFailed(remote: RemoteAccess, route: RemoteRouteName): boolean {
  const { enabled, status } = remote.routes[route];
  return enabled && status.kind === 'failed';
}

function hostnameChange(
  remote: RemoteAccess,
  route: HostedRouteName,
  hostname: string,
): RemoteAccessChange {
  const first = savedHostname(remote, route) === '';
  return route === 'tailnet'
    ? { tailnetHostname: hostname, ...(first ? { tailnet: true } : {}) }
    : {
        cloudflareHostname: hostname,
        ...(first ? { cloudflare: true } : {}),
      };
}

export type HostnameFormInput = {
  route: HostedRouteName;
  remote: RemoteAccess;
  disabled: boolean;
  onChange: (change: RemoteAccessChange) => void;
};

export function hostnameForm(
  remote: RemoteAccess,
  route: HostedRouteName,
  draft: string | null,
) {
  const saved = savedHostname(remote, route);
  const value = draft ?? saved;
  const hostname = value.trim();
  return {
    ...hostnameFields[route],
    value,
    canSave: hostname !== '' && hostname !== saved,
    save: hostnameChange(remote, route, hostname),
    failed: routeFailed(remote, route),
    check:
      route === 'tailnet'
        ? { tailnet: true as const }
        : { cloudflare: true as const },
  };
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
