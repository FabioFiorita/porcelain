import type {
  ListenOutcome,
  NetworkAddress,
  RemoteAccess,
  RemoteAccessChange,
  RemoteAccessDecision,
  RemoteAccessSettings,
  RouteState,
  RouteStates,
  TunnelAnswer,
} from '../models/remote-access.ts';

const PRIVATE_IPV4 = [/^10\./, /^192\.168\./, /^172\.(?:1[6-9]|2\d|3[01])\./];
const TAILNET_IPV4 = /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;
const TAILNET_IPV6 = /^fd7a:115c:a1e0:/i;
const TAILSCALE_INTERFACE = 'tailscale0';
const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NUMERIC_LABEL = /^\d+$/;

export function isTailnetAddress(address: string): boolean {
  return TAILNET_IPV4.test(address) || TAILNET_IPV6.test(address);
}

function tailnetInterfaces(addresses: readonly NetworkAddress[]): Set<string> {
  return new Set(
    addresses
      .filter(
        (entry) =>
          entry.interfaceName === TAILSCALE_INTERFACE ||
          (entry.family === 'IPv6' && TAILNET_IPV6.test(entry.address)),
      )
      .map((entry) => entry.interfaceName),
  );
}

export function tailnetAddresses(
  addresses: readonly NetworkAddress[],
): string[] {
  const interfaces = tailnetInterfaces(addresses);
  const found = addresses.filter(
    (entry) =>
      !entry.internal &&
      interfaces.has(entry.interfaceName) &&
      (entry.family === 'IPv4'
        ? TAILNET_IPV4.test(entry.address)
        : TAILNET_IPV6.test(entry.address)),
  );
  return [
    ...found.filter((entry) => entry.family === 'IPv4'),
    ...found.filter((entry) => entry.family !== 'IPv4'),
  ].map((entry) => entry.address);
}

export function lanAddresses(addresses: readonly NetworkAddress[]): string[] {
  const interfaces = tailnetInterfaces(addresses);
  return addresses
    .filter(
      (entry) =>
        !entry.internal &&
        entry.family === 'IPv4' &&
        !interfaces.has(entry.interfaceName) &&
        PRIVATE_IPV4.some((range) => range.test(entry.address)),
    )
    .map((entry) => entry.address);
}

export function tunnelHostname(
  value: string,
  maxLength: number,
): string | undefined {
  const trimmed = value.trim();
  const url = URL.parse(
    trimmed.includes('://') ? trimmed : `https://${trimmed}`,
  );
  if (
    !url ||
    url.protocol !== 'https:' ||
    trimmed.includes('@') ||
    url.port !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.pathname !== '/'
  )
    return undefined;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const labels = hostname.split('.');
  if (
    hostname.length > maxLength ||
    !hostname.includes('.') ||
    NUMERIC_LABEL.test(labels.at(-1) ?? '') ||
    !labels.every((label) => HOSTNAME_LABEL.test(label))
  )
    return undefined;
  return hostname;
}

export function tunnelOrigin(hostname: string): string {
  return `https://${hostname}`;
}

export function tunnelHosts(settings: RemoteAccessSettings): string[] {
  return settings.cloudflare && settings.cloudflareHostname !== undefined
    ? [settings.cloudflareHostname]
    : [];
}

export function answeredTunnelHosts(
  settings: RemoteAccessSettings,
  states: RouteStates,
): string[] {
  const tunnel = states.cloudflare;
  return tunnel.kind === 'failed' && tunnel.reason === 'other-server'
    ? []
    : tunnelHosts(settings);
}

function routeUrl(address: string, port: number): string {
  return address.includes(':')
    ? `http://[${address}]:${port}`
    : `http://${address}:${port}`;
}

export function listenedState(
  addresses: readonly string[],
  outcome: ListenOutcome,
): RouteState {
  if (addresses.length === 0) return { kind: 'failed', reason: 'no-address' };
  if (outcome.bound.length === 0)
    return {
      kind: 'failed',
      reason: outcome.failure ?? 'address-unavailable',
    };
  return {
    kind: 'on',
    urls: outcome.bound.map((address) => routeUrl(address, outcome.port)),
  };
}

export function tunnelState(
  answer: TunnelAnswer,
  environmentId: string,
  origin: string,
): RouteState {
  if (answer.kind === 'unreachable')
    return { kind: 'failed', reason: 'unreachable' };
  return answer.kind === 'answered' && answer.environmentId === environmentId
    ? { kind: 'on', urls: [origin] }
    : { kind: 'failed', reason: 'other-server' };
}

export function tunnelNeedsCheck(state: RouteState): boolean {
  return state.kind === 'off' || state.kind === 'starting';
}

export function reachableOrigins(states: RouteStates): string[] {
  return [states.lan, states.tailnet, states.cloudflare].flatMap((state) =>
    state.kind === 'on' ? state.urls : [],
  );
}

export function changedRemoteAccess(
  current: RemoteAccessSettings,
  change: RemoteAccessChange,
  hostnameLength: number,
): RemoteAccessDecision {
  const hostname =
    change.cloudflareHostname === undefined
      ? current.cloudflareHostname
      : tunnelHostname(change.cloudflareHostname, hostnameLength);
  if (change.cloudflareHostname !== undefined && hostname === undefined)
    return { kind: 'invalid-hostname' };
  const cloudflare = change.cloudflare ?? current.cloudflare;
  if (cloudflare && hostname === undefined) return { kind: 'missing-hostname' };
  return {
    kind: 'settings',
    settings: {
      lan: change.lan ?? current.lan,
      tailnet: change.tailnet ?? current.tailnet,
      cloudflare,
      ...(hostname === undefined ? {} : { cloudflareHostname: hostname }),
    },
  };
}

export function requestedStates(
  states: RouteStates,
  change: RemoteAccessChange,
  settings: RemoteAccessSettings,
): RouteStates {
  const starting: RouteState = { kind: 'starting' };
  return {
    lan: change.lan === true ? starting : states.lan,
    tailnet: change.tailnet === true ? starting : states.tailnet,
    cloudflare:
      settings.cloudflare &&
      (change.cloudflare === true || change.cloudflareHostname !== undefined)
        ? starting
        : states.cloudflare,
  };
}

export function remoteAccessView(
  settings: RemoteAccessSettings,
  states: RouteStates,
  serviceUrl: string,
): RemoteAccess {
  return {
    routes: {
      lan: { enabled: settings.lan, status: states.lan },
      tailnet: { enabled: settings.tailnet, status: states.tailnet },
      cloudflare: { enabled: settings.cloudflare, status: states.cloudflare },
    },
    ...(settings.cloudflareHostname === undefined
      ? {}
      : { cloudflareHostname: settings.cloudflareHostname }),
    serviceUrl,
  };
}
